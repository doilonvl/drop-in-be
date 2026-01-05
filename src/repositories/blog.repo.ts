import type { FilterQuery, Model } from "mongoose";
import type { Locale } from "../i18n/types";
import { Blog, type IBlog, type BlogStatus } from "../models/Blog";
import { extractRichDocSummary } from "../utils/blogContent";

const BlogModel = Blog as unknown as Model<IBlog>;
const WORDS_PER_MINUTE = 200;

export type BlogAdminListOpts = {
  page?: number;
  limit?: number;
  q?: string;
  status?: BlogStatus;
  tag?: string;
  sort?: "updatedAt" | "-updatedAt" | "publishedAt" | "-publishedAt" | "sortOrder" | "-sortOrder";
  withCount?: boolean;
};

export type BlogPublicListOpts = {
  page?: number;
  limit?: number;
  tag?: string;
  sort?: "publishedAt" | "-publishedAt" | "sortOrder" | "-sortOrder";
};

const buildDerivedFields = (content_i18n: IBlog["content_i18n"]) => {
  const vi = extractRichDocSummary(content_i18n?.vi);
  const en = extractRichDocSummary(content_i18n?.en);
  const wordCount = Math.max(vi.wordCount, en.wordCount);
  const readingTimeMinutes = wordCount
    ? Math.ceil(wordCount / WORDS_PER_MINUTE)
    : 0;

  return {
    toc_i18n: { vi: vi.toc, en: en.toc },
    plainText_i18n: { vi: vi.plainText, en: en.plainText },
    readingTimeMinutes,
  };
};

const hasOwn = (obj: any, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

const normalizeStatusFields = (
  data: Partial<IBlog>,
  existing?: IBlog
) => {
  const now = new Date();
  const incomingStatus =
    (data.status as BlogStatus | undefined) ||
    (data.scheduledAt ? "scheduled" : existing?.status) ||
    "draft";

  const scheduledAt = hasOwn(data, "scheduledAt")
    ? (data.scheduledAt as Date | null | undefined)
    : existing?.scheduledAt ?? null;
  const publishedAt = hasOwn(data, "publishedAt")
    ? (data.publishedAt as Date | null | undefined)
    : existing?.publishedAt ?? null;

  if (incomingStatus === "published") {
    return {
      status: incomingStatus,
      scheduledAt: null,
      publishedAt: publishedAt || now,
    };
  }

  if (incomingStatus === "scheduled") {
    if (!scheduledAt) {
      const error: any = new Error("scheduledAt is required for scheduled status");
      error.code = "BLOG_SCHEDULED_AT_REQUIRED";
      throw error;
    }
    return {
      status: incomingStatus,
      scheduledAt,
      publishedAt: null,
    };
  }

  if (incomingStatus === "draft") {
    return {
      status: incomingStatus,
      scheduledAt: null,
      publishedAt: null,
    };
  }

  return {
    status: incomingStatus,
    scheduledAt: null,
    publishedAt,
  };
};

const buildSort = (
  sort: string | undefined,
  fallback: Record<string, 1 | -1>
) => {
  if (!sort) return fallback;
  const field = sort.startsWith("-") ? sort.slice(1) : sort;
  const dir: 1 | -1 = sort.startsWith("-") ? -1 : 1;
  return { [field]: dir };
};

export const blogRepo = {
  async create(data: Partial<IBlog>) {
    const derived = buildDerivedFields(data.content_i18n as any);
    const normalized = normalizeStatusFields(data);

    const doc = new BlogModel({
      ...data,
      ...derived,
      ...normalized,
    });

    return doc.save();
  },

  async update(id: string, data: Partial<IBlog>) {
    const doc = await BlogModel.findOne({ _id: id, deletedAt: null });
    if (!doc) return null;

    let nextContent = doc.content_i18n;
    if (data.content_i18n) {
      nextContent = {
        vi: (data.content_i18n as any)?.vi ?? doc.content_i18n?.vi,
        en: (data.content_i18n as any)?.en ?? doc.content_i18n?.en,
      };
    }

    const derived = data.content_i18n
      ? buildDerivedFields(nextContent as any)
      : null;

    const normalized = normalizeStatusFields(data, doc);

    Object.assign(doc, data, normalized);
    if (data.content_i18n) {
      doc.content_i18n = nextContent as any;
    }
    if (derived) {
      doc.toc_i18n = derived.toc_i18n as any;
      doc.plainText_i18n = derived.plainText_i18n as any;
      doc.readingTimeMinutes = derived.readingTimeMinutes;
    }

    return doc.save();
  },

  async softDelete(id: string, updatedBy?: string) {
    return BlogModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { deletedAt: new Date(), updatedBy: updatedBy || null },
      { new: true }
    );
  },

  async getById(id: string) {
    return BlogModel.findOne({ _id: id, deletedAt: null });
  },

  async getPublicBySlug(slug: string, locale: Locale, now = new Date()) {
    const slugField = locale === "en" ? "slug_i18n.en" : "slug_i18n.vi";
    const filter: FilterQuery<IBlog> = {
      status: "published",
      deletedAt: null,
      publishedAt: { $lte: now },
      $or: [{ slug }, { [slugField]: slug }],
    };
    return BlogModel.findOne(filter);
  },

  async listAdmin(opts: BlogAdminListOpts = {}) {
    const {
      page = 1,
      limit = 20,
      q,
      status,
      tag,
      sort,
      withCount = true,
    } = opts;

    const filter: FilterQuery<IBlog> = { deletedAt: null };
    if (status) filter.status = status;
    if (tag) filter.tags = tag;
    if (q?.trim()) filter.$text = { $search: q.trim() };

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = (page - 1) * safeLimit;

    const sortObj = buildSort(sort, { updatedAt: -1 });

    const [items, total] = await Promise.all([
      BlogModel.find(filter)
        .select("-content_i18n")
        .sort(sortObj)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      withCount ? BlogModel.countDocuments(filter) : Promise.resolve(0),
    ]);

    return {
      items,
      total: withCount ? total : items.length,
      page,
      limit: safeLimit,
    };
  },

  async listPublic(opts: BlogPublicListOpts = {}) {
    const { page = 1, limit = 20, tag, sort } = opts;
    const now = new Date();

    const filter: FilterQuery<IBlog> = {
      status: "published",
      deletedAt: null,
      publishedAt: { $lte: now },
    };

    if (tag) filter.tags = tag;

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const skip = (page - 1) * safeLimit;

    const sortObj = buildSort(sort, { publishedAt: -1 });

    const [items, total] = await Promise.all([
      BlogModel.find(filter)
        .select("-content_i18n")
        .sort(sortObj)
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      BlogModel.countDocuments(filter),
    ]);

    return { items, total, page, limit: safeLimit };
  },

  async incrementViewCount(id: string) {
    return BlogModel.findOneAndUpdate(
      {
        _id: id,
        deletedAt: null,
        status: "published",
        publishedAt: { $lte: new Date() },
      },
      { $inc: { "stats.viewCount": 1 } },
      { new: true }
    );
  },

  async publishScheduled(now = new Date()) {
    return BlogModel.updateMany(
      {
        status: "scheduled",
        deletedAt: null,
        scheduledAt: { $lte: now },
      },
      {
        $set: {
          status: "published",
          publishedAt: now,
          scheduledAt: null,
        },
      }
    );
  },
};
