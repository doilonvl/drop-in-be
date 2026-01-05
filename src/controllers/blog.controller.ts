import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import { Types } from "mongoose";
import { blogRepo } from "../repositories/blog.repo";
import { detectLocale, localizeDoc } from "../i18n/localize";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "../i18n/types";
import type { BlogStatus } from "../models/Blog";
import type { AuthAdminRequest } from "../middlewares/authAdmin";

const BLOG_STATUSES = new Set<BlogStatus>([
  "draft",
  "published",
  "scheduled",
  "archived",
]);
const ADMIN_SORTS = new Set([
  "updatedAt",
  "-updatedAt",
  "publishedAt",
  "-publishedAt",
  "sortOrder",
  "-sortOrder",
]);
const PUBLIC_SORTS = new Set([
  "publishedAt",
  "-publishedAt",
  "sortOrder",
  "-sortOrder",
]);

const L_FIELDS = ["title", "excerpt", "seoTitle", "seoDescription"];
const MAX_RICH_DOC_BYTES = 2 * 1024 * 1024;

function shouldLocalize(
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
): boolean {
  if (req.query && (req.query as any).locale) return true;
  const acceptLang = req.headers["accept-language"];
  return typeof acceptLang === "string" && acceptLang.trim().length > 0;
}

const buildLocalePriority = (locale?: string) =>
  Array.from(
    new Set(
      [locale, "en", DEFAULT_LOCALE, "vi"].filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0
      )
    )
  );

function pickLocalizedValue(value: any, locales: string[]): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;

  for (const loc of locales) {
    const v = value?.[loc];
    if (typeof v === "string" && v.trim().length > 0) {
      return v;
    }
  }
  return undefined;
}

function normalizeMetaDescription(input?: string) {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

function ensureCanonicalSlug(doc: any, locale: Locale) {
  if (doc?.slug) return doc;
  if (doc?.slug_i18n) {
    doc.slug =
      doc.slug_i18n?.[locale] || doc.slug_i18n?.[DEFAULT_LOCALE] || doc.slug;
  }
  return doc;
}

function attachMetaFields(blog: any, locale: string) {
  const locales = buildLocalePriority(locale);
  const metaTitle =
    pickLocalizedValue(blog?.seoTitle_i18n, locales) ||
    pickLocalizedValue(blog?.title_i18n, locales);
  const metaDescription = normalizeMetaDescription(
    pickLocalizedValue(blog?.seoDescription_i18n, locales) ||
      pickLocalizedValue(blog?.excerpt_i18n, locales) ||
      pickLocalizedValue(blog?.plainText_i18n, locales)
  );
  const ogImage = blog?.ogImageUrl || blog?.coverImage?.url;

  return { ...blog, metaTitle, metaDescription, ogImage };
}

function localizeBlog(
  blog: any,
  locale: Locale,
  opts: { includeContent: boolean }
) {
  const localized = localizeDoc(blog, locale, {
    fields: L_FIELDS,
    includeSlugI18n: false,
  }) as any;

  ensureCanonicalSlug(localized, locale);

  localized.toc =
    blog?.toc_i18n?.[locale] || blog?.toc_i18n?.[DEFAULT_LOCALE] || [];
  localized.plainText =
    blog?.plainText_i18n?.[locale] ||
    blog?.plainText_i18n?.[DEFAULT_LOCALE] ||
    "";

  if (opts.includeContent) {
    localized.content =
      blog?.content_i18n?.[locale] ||
      blog?.content_i18n?.[DEFAULT_LOCALE] ||
      null;
  }

  return localized;
}

const isPlainObject = (value: any) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseBody = (input: any) => {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input;
};

const parseDateValue = (input: any): Date | null | undefined => {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    if (!Number.isNaN(d.valueOf())) return d;
  }
  return undefined;
};

const validateContentSize = (content: any, field: string) => {
  const json = JSON.stringify(content);
  const size = Buffer.byteLength(json, "utf8");
  if (size > MAX_RICH_DOC_BYTES) {
    const error: any = new Error(
      `${field} exceeds ${MAX_RICH_DOC_BYTES} bytes`
    );
    error.code = "BLOG_CONTENT_TOO_LARGE";
    throw error;
  }
};

const sanitizePublic = (doc: any) => {
  const sanitized = { ...doc };
  delete sanitized.content_i18n;
  delete sanitized.toc_i18n;
  delete sanitized.plainText_i18n;
  return sanitized;
};

export const blogController = {
  async createBlog(req: AuthAdminRequest, res: Response) {
    try {
      const body = parseBody(req.body);
      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      if (
        !body.slug_i18n ||
        typeof body.slug_i18n?.vi !== "string" ||
        typeof body.slug_i18n?.en !== "string" ||
        !body.slug_i18n.vi.trim() ||
        !body.slug_i18n.en.trim()
      ) {
        return res.status(400).json({
          message: "slug_i18n.vi and slug_i18n.en are required",
        });
      }

      if (!body.title_i18n || (!body.title_i18n.vi && !body.title_i18n.en)) {
        return res.status(400).json({
          message: "At least one localized title (vi/en) is required",
        });
      }

      if (
        !body.content_i18n ||
        !isPlainObject(body.content_i18n.vi) ||
        !isPlainObject(body.content_i18n.en)
      ) {
        return res.status(400).json({
          message: "content_i18n.vi and content_i18n.en must be JSON objects",
        });
      }

      validateContentSize(body.content_i18n.vi, "content_i18n.vi");
      validateContentSize(body.content_i18n.en, "content_i18n.en");

      if (
        body.tags !== undefined &&
        (!Array.isArray(body.tags) ||
          !body.tags.every((tag: any) => typeof tag === "string"))
      ) {
        return res.status(400).json({
          message: "tags must be an array of strings",
        });
      }

      if (body.status && !BLOG_STATUSES.has(body.status)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }

      const scheduledAt = parseDateValue(body.scheduledAt);
      const publishedAt = parseDateValue(body.publishedAt);

      if (scheduledAt === undefined && body.scheduledAt !== undefined) {
        return res.status(400).json({ message: "Invalid scheduledAt" });
      }

      if (publishedAt === undefined && body.publishedAt !== undefined) {
        return res.status(400).json({ message: "Invalid publishedAt" });
      }

      const doc = await blogRepo.create({
        ...body,
        scheduledAt,
        publishedAt,
        createdBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
        updatedBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
      });

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const obj = (doc as any).toObject?.() || doc;
      const withMeta = attachMetaFields(obj, locale);
      ensureCanonicalSlug(withMeta, locale);

      if (!shouldLocalize(req)) {
        return res.status(201).json(withMeta);
      }

      const localized = localizeDoc(withMeta, locale, {
        fields: L_FIELDS,
        includeSlugI18n: false,
      });
      return res.status(201).json(ensureCanonicalSlug(localized, locale));
    } catch (err: any) {
      console.error("[BLOG CREATE]", err);

      if (err?.code === 11000) {
        return res.status(409).json({
          message: "Slug already exists",
        });
      }

      if (err?.code === "BLOG_SCHEDULED_AT_REQUIRED") {
        return res.status(400).json({ message: err.message });
      }

      if (err?.code === "BLOG_CONTENT_TOO_LARGE") {
        return res.status(413).json({ message: err.message });
      }

      res.status(400).json({ message: err?.message || "Create blog failed" });
    }
  },

  async updateBlog(req: AuthAdminRequest, res: Response) {
    try {
      const body = parseBody(req.body);
      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      if (body.slug_i18n) {
        if (
          typeof body.slug_i18n?.vi !== "string" ||
          typeof body.slug_i18n?.en !== "string"
        ) {
          return res.status(400).json({
            message: "slug_i18n.vi and slug_i18n.en are required when provided",
          });
        }
      }

      if (body.content_i18n) {
        if (
          !isPlainObject(body.content_i18n.vi) ||
          !isPlainObject(body.content_i18n.en)
        ) {
          return res.status(400).json({
            message: "content_i18n.vi and content_i18n.en must be JSON objects",
          });
        }

        validateContentSize(body.content_i18n.vi, "content_i18n.vi");
        validateContentSize(body.content_i18n.en, "content_i18n.en");
      }

      if (
        body.tags !== undefined &&
        (!Array.isArray(body.tags) ||
          !body.tags.every((tag: any) => typeof tag === "string"))
      ) {
        return res.status(400).json({
          message: "tags must be an array of strings",
        });
      }

      if (body.status && !BLOG_STATUSES.has(body.status)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }

      const scheduledAt = parseDateValue(body.scheduledAt);
      const publishedAt = parseDateValue(body.publishedAt);

      if (scheduledAt === undefined && body.scheduledAt !== undefined) {
        return res.status(400).json({ message: "Invalid scheduledAt" });
      }

      if (publishedAt === undefined && body.publishedAt !== undefined) {
        return res.status(400).json({ message: "Invalid publishedAt" });
      }

      const updated = await blogRepo.update(req.params.id, {
        ...body,
        scheduledAt,
        publishedAt,
        updatedBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
      });

      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const obj = (updated as any).toObject?.() || updated;
      const withMeta = attachMetaFields(obj, locale);
      ensureCanonicalSlug(withMeta, locale);

      if (!shouldLocalize(req)) {
        return res.json(withMeta);
      }

      const localized = localizeDoc(withMeta, locale, {
        fields: L_FIELDS,
        includeSlugI18n: false,
      });
      return res.json(ensureCanonicalSlug(localized, locale));
    } catch (err: any) {
      console.error("[BLOG UPDATE]", err);

      if (err?.code === 11000) {
        return res.status(409).json({
          message: "Slug already exists",
        });
      }

      if (err?.code === "BLOG_SCHEDULED_AT_REQUIRED") {
        return res.status(400).json({ message: err.message });
      }

      if (err?.code === "BLOG_CONTENT_TOO_LARGE") {
        return res.status(413).json({ message: err.message });
      }

      res.status(400).json({ message: err?.message || "Update failed" });
    }
  },

  async deleteBlog(req: AuthAdminRequest, res: Response) {
    try {
      const deleted = await blogRepo.softDelete(
        req.params.id,
        req.adminUser?.id
      );
      if (!deleted) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json({ message: "Deleted successfully" });
    } catch (err: any) {
      console.error("[BLOG DELETE]", err);
      res.status(400).json({ message: err?.message || "Delete failed" });
    }
  },

  async getBlogsAdmin(req: Request, res: Response) {
    try {
      const { page, limit, q, status, tag, sort, withCount } = req.query as any;

      let statusValue: BlogStatus | undefined;
      if (typeof status === "string" && status !== "all") {
        if (!BLOG_STATUSES.has(status as BlogStatus)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        statusValue = status as BlogStatus;
      }

      const result = await blogRepo.listAdmin({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        q: q ? String(q) : undefined,
        status: statusValue,
        tag: tag ? String(tag) : undefined,
        withCount: withCount !== "false",
        sort:
          typeof sort === "string" && ADMIN_SORTS.has(sort)
            ? (sort as any)
            : "-updatedAt",
      });

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const itemsWithMeta = result.items.map((item: any) =>
        attachMetaFields(item, locale)
      );
      itemsWithMeta.forEach((item: any) => ensureCanonicalSlug(item, locale));

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json({ ...result, items: itemsWithMeta });
      }

      const localizedItems = itemsWithMeta.map((item: any) =>
        ensureCanonicalSlug(
          localizeDoc(item, locale, {
            fields: L_FIELDS,
            includeSlugI18n: false,
          }),
          locale
        )
      );
      return res.json({
        ...result,
        items: localizedItems,
      });
    } catch (err: any) {
      console.error("[BLOG LIST ADMIN]", err);
      res.status(500).json({ message: "Failed to list blogs (admin)" });
    }
  },

  async getBlogById(req: Request, res: Response) {
    try {
      const blog = await blogRepo.getById(req.params.id);
      if (!blog) {
        return res.status(404).json({ message: "Not found" });
      }

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const obj = (blog as any).toObject?.() || blog;
      const withMeta = attachMetaFields(obj, locale);
      ensureCanonicalSlug(withMeta, locale);

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json(withMeta);
      }

      const localized = localizeDoc(withMeta, locale, {
        fields: L_FIELDS,
        includeSlugI18n: false,
      });
      return res.json(ensureCanonicalSlug(localized, locale));
    } catch (err: any) {
      console.error("[BLOG GET]", err);
      res.status(500).json({ message: "Failed to get blog" });
    }
  },

  async publishBlog(req: AuthAdminRequest, res: Response) {
    try {
      const updated = await blogRepo.update(req.params.id, {
        status: "published",
        publishedAt: new Date(),
        scheduledAt: null,
        updatedBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
      });

      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("[BLOG PUBLISH]", err);
      res.status(400).json({ message: err?.message || "Publish failed" });
    }
  },

  async archiveBlog(req: AuthAdminRequest, res: Response) {
    try {
      const updated = await blogRepo.update(req.params.id, {
        status: "archived",
        updatedBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
      });

      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("[BLOG ARCHIVE]", err);
      res.status(400).json({ message: err?.message || "Archive failed" });
    }
  },

  async scheduleBlog(req: AuthAdminRequest, res: Response) {
    try {
      const body = parseBody(req.body);
      const scheduledAt = parseDateValue(body?.scheduledAt);
      if (!scheduledAt) {
        return res.status(400).json({ message: "scheduledAt is required" });
      }

      const updated = await blogRepo.update(req.params.id, {
        status: "scheduled",
        scheduledAt,
        updatedBy: req.adminUser?.id
          ? new Types.ObjectId(req.adminUser.id)
          : null,
      });

      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }

      res.json(updated);
    } catch (err: any) {
      console.error("[BLOG SCHEDULE]", err);
      res.status(400).json({ message: err?.message || "Schedule failed" });
    }
  },

  async listPublicBlogs(req: Request, res: Response) {
    try {
      const { page, limit, tag, sort } = req.query as any;
      const locale = normalizeLocale(
        (req.query.locale as any) ||
          detectLocale(req.headers["accept-language"] as string)
      );

      const result = await blogRepo.listPublic({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        tag: tag ? String(tag) : undefined,
        sort:
          typeof sort === "string" && PUBLIC_SORTS.has(sort)
            ? (sort as any)
            : "-publishedAt",
      });

      const itemsWithMeta = result.items.map((item: any) =>
        attachMetaFields(item, locale)
      );

      const localized = itemsWithMeta.map((item: any) => {
        const localizedItem = sanitizePublic(
          localizeBlog(item, locale, { includeContent: false })
        );
        delete localizedItem.toc;
        delete localizedItem.plainText;
        return localizedItem;
      });

      res.setHeader("Vary", "Accept-Language");
      res.json({ ...result, items: localized });
    } catch (err: any) {
      console.error("[BLOG LIST PUBLIC]", err);
      res.status(500).json({ message: "Failed to list blogs" });
    }
  },

  async getPublicBlogBySlug(req: Request, res: Response) {
    try {
      const locale = normalizeLocale(
        (req.query.locale as any) ||
          detectLocale(req.headers["accept-language"] as string)
      );

      const { slug } = req.params;
      const blog = await blogRepo.getPublicBySlug(slug, locale);
      if (!blog) {
        return res.status(404).json({ message: "Not found" });
      }

      const obj = (blog as any).toObject?.() || blog;
      const withMeta = attachMetaFields(obj, locale);
      const localized = localizeBlog(withMeta, locale, {
        includeContent: true,
      });

      res.setHeader("Vary", "Accept-Language");
      return res.json(sanitizePublic(localized));
    } catch (err: any) {
      console.error("[BLOG GET PUBLIC]", err);
      res.status(500).json({ message: "Failed to get blog" });
    }
  },

  async incrementViewCount(req: Request, res: Response) {
    try {
      const updated = await blogRepo.incrementViewCount(req.params.id);
      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json({ viewCount: updated.stats?.viewCount || 0 });
    } catch (err: any) {
      console.error("[BLOG VIEW COUNT]", err);
      res.status(400).json({ message: err?.message || "Update failed" });
    }
  },
};
