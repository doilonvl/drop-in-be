import type { FilterQuery, Model } from "mongoose";
import { Product, IProduct, ProductCategory } from "../models/Product";
import type { LocalizedString } from "../i18n/types";
import { DEFAULT_LOCALE } from "../i18n/types";

const ProductModel = Product as unknown as Model<IProduct>;

export type ProductListOpts = {
  page?: number;
  limit?: number;
  q?: string;
  category?: ProductCategory;
  published?: boolean;
  isBestSeller?: boolean;
  isSignatureLineup?: boolean;
  sort?:
    | "name"
    | "-name"
    | "createdAt"
    | "-createdAt"
    | "bestSellerOrder"
    | "-bestSellerOrder"
    | "signatureOrder"
    | "-signatureOrder";
};

const DEFAULT_CATEGORY: ProductCategory = "coffee";

const slugify = (text: string) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

async function ensureUniqueName(
  category: ProductCategory | undefined,
  name: LocalizedString | undefined,
  excludeId?: string
) {
  if (!category || !name) return;

  const or: any[] = [];
  if (name.vi) or.push({ "name_i18n.vi": name.vi });
  if (name.en) or.push({ "name_i18n.en": name.en });

  if (!or.length) return;

  const filter: any = { category, $or: or };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existed = await ProductModel.exists(filter);
  if (existed) {
    const error: any = new Error(
      "Product name already exists in this category"
    );
    error.code = "PRODUCT_NAME_DUPLICATE";
    throw error;
  }
}

export const productRepo = {
  async create(data: Partial<IProduct>) {
    const category = (data.category as ProductCategory) || DEFAULT_CATEGORY;
    const name = data.name_i18n as LocalizedString | undefined;

    await ensureUniqueName(category, name);

    const doc = new ProductModel({
      ...data,
      category,
    });

    return doc.save();
  },

  async update(id: string, data: Partial<IProduct>) {
    const doc = await ProductModel.findById(id);
    if (!doc) return null;

    const oldNameBase =
      doc.name_i18n?.en ||
      doc.name_i18n?.[DEFAULT_LOCALE] ||
      doc.name_i18n?.vi ||
      "";

    const newCategory =
      (data.category as ProductCategory) || (doc.category as ProductCategory);

    const newName =
      (data.name_i18n as LocalizedString | undefined) || doc.name_i18n;

    await ensureUniqueName(newCategory, newName, String(doc._id));

    Object.assign(doc, data);

    const newNameBase =
      doc.name_i18n?.en ||
      doc.name_i18n?.[DEFAULT_LOCALE] ||
      doc.name_i18n?.vi ||
      "";

    const hasSlugInBody =
      Object.prototype.hasOwnProperty.call(data, "slug") &&
      typeof data.slug === "string" &&
      (data.slug as string).trim().length > 0;

    if (hasSlugInBody) {
      doc.slug = slugify(data.slug as string);
    } else if (newNameBase && newNameBase !== oldNameBase) {
      doc.slug = slugify(newNameBase);
    }

    return doc.save();
  },

  async delete(id: string) {
    return ProductModel.findByIdAndDelete(id);
  },

  async getById(id: string) {
    return ProductModel.findById(id);
  },

  async getBySlug(slug: string) {
    return ProductModel.findOne({ slug, isPublished: true });
  },

  async list(opts: ProductListOpts = {}) {
    const {
      page = 1,
      limit = 20,
      q,
      category,
      published,
      isBestSeller,
      isSignatureLineup,
      sort,
    } = opts;

    const filter: FilterQuery<IProduct> = {};

    if (typeof published === "boolean") {
      filter.isPublished = published;
    }

    if (category) {
      filter.category = category;
    }

    if (typeof isBestSeller === "boolean") {
      filter.isBestSeller = isBestSeller;
    }

    if (typeof isSignatureLineup === "boolean") {
      filter.isSignatureLineup = isSignatureLineup;
    }

    if (q?.trim()) {
      filter.$text = { $search: q.trim() };
    }

    let sortObj: Record<string, 1 | -1> = {};
    if (sort) {
      const field = sort.startsWith("-") ? sort.slice(1) : sort;
      const dir: 1 | -1 = sort.startsWith("-") ? -1 : 1;
      sortObj = { [field]: dir };
    } else if (isBestSeller) {
      sortObj = { bestSellerOrder: 1, createdAt: -1 };
    } else if (isSignatureLineup) {
      sortObj = { signatureOrder: 1, createdAt: -1 };
    } else {
      sortObj = { createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      ProductModel.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
      ProductModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async listBestSellers(limit = 6, category?: ProductCategory) {
    const filter: FilterQuery<IProduct> = {
      isPublished: true,
      isBestSeller: true,
    };
    if (category) filter.category = category;

    return ProductModel.find(filter)
      .sort({ bestSellerOrder: 1, createdAt: -1 })
      .limit(limit)
      .lean();
  },

  async listSignatureLineup(limit = 6, category?: ProductCategory) {
    const filter: FilterQuery<IProduct> = {
      isPublished: true,
      isSignatureLineup: true,
    };
    if (category) filter.category = category;

    return ProductModel.find(filter)
      .sort({ signatureOrder: 1, createdAt: -1 })
      .limit(limit)
      .lean();
  },
};
