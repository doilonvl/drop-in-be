import mongoose, { Document, Schema } from "mongoose";
import { LocalizedString, DEFAULT_LOCALE } from "../i18n/types";
import { LocalizedStringSchema } from "./Common";

export type ProductCategory =
  | "coffee"
  | "tea"
  | "cake"
  | "other drinks"
  | "espresso"
  | "cold brew"
  | "chocolate"
  | "green teas"
  | "other teas"
  | "matcha";
export type TemperatureOption = "hot" | "iced" | "both" | "warm";

export interface ProductStat {
  label: LocalizedString;
  value: number;
}

export interface IProduct extends Document {
  name_i18n: LocalizedString;
  shortDescription_i18n?: LocalizedString;
  description_i18n?: LocalizedString;

  slug: string;
  slug_i18n?: LocalizedString;

  seoTitle_i18n?: LocalizedString;
  seoDescription_i18n?: LocalizedString;

  category?: ProductCategory;
  tags?: string[];
  price: number;
  temperatureOptions?: TemperatureOption[];

  image?: {
    url: string;
    alt_i18n?: LocalizedString;
  };

  isBestSeller: boolean;
  bestSellerOrder?: number;
  bestSellerStats?: ProductStat[];

  isSignatureLineup: boolean;
  signatureOrder?: number;

  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductStatSchema = new Schema<ProductStat>(
  {
    label: { type: LocalizedStringSchema, required: true },
    value: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name_i18n: {
      type: LocalizedStringSchema,
      required: true,
    },
    shortDescription_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },
    description_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: [160, "Slug cannot exceed 160 characters"],
    },
    slug_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },

    seoTitle_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },
    seoDescription_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },

    category: {
      type: String,
      enum: [
        "coffee",
        "tea",
        "cake",
        "other drinks",
        "espresso",
        "cold brew",
        "chocolate",
        "green teas",
        "other teas",
        "matcha",
      ],
      default: "coffee",
    },
    tags: [{ type: String, trim: true }],
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    temperatureOptions: {
      type: [String],
      enum: ["hot", "iced", "both", "warm"],
      default: [],
    },

    image: {
      url: { type: String, trim: true },
      alt_i18n: { type: LocalizedStringSchema, default: undefined },
    },

    isBestSeller: { type: Boolean, default: false },
    bestSellerOrder: { type: Number },
    bestSellerStats: { type: [ProductStatSchema], default: [] },

    isSignatureLineup: { type: Boolean, default: false },
    signatureOrder: { type: Number },

    isPublished: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

const slugify = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/**
 * Đảm bảo slug unique, thêm -2, -3 nếu trùng
 */
async function ensureUniqueSlug(doc: any) {
  const ProductModel = doc.constructor;

  const nameEn = doc.name_i18n?.en;
  const nameDefault = doc.name_i18n?.[DEFAULT_LOCALE];
  const nameVi = doc.name_i18n?.vi;

  const baseInput = doc.slug || nameEn || nameDefault || nameVi || "product";
  const base = slugify(baseInput);
  let candidate = base || "product";
  let i = 2;

  while (
    await ProductModel.exists({
      slug: candidate,
      _id: { $ne: doc._id },
    })
  ) {
    candidate = `${base}-${i++}`;
  }

  doc.slug = candidate;
}

ProductSchema.pre("validate", function (next) {
  const doc: any = this;

  if (!doc.slug) {
    const nameEn = doc.name_i18n?.en;
    const nameDefault = doc.name_i18n?.[DEFAULT_LOCALE];
    const nameVi = doc.name_i18n?.vi;
    const baseInput = nameEn || nameDefault || nameVi || "product";
    doc.slug = slugify(baseInput);
  } else {
    doc.slug = slugify(doc.slug);
  }

  next();
});

ProductSchema.pre("save", async function (next) {
  try {
    const doc: any = this;
    if (doc.isNew || doc.isModified("slug")) {
      await ensureUniqueSlug(doc);
    }
    next();
  } catch (err) {
    next(err as any);
  }
});

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ isPublished: 1, category: 1, isBestSeller: 1 });

ProductSchema.index({
  "name_i18n.vi": "text",
  "name_i18n.en": "text",
  "shortDescription_i18n.vi": "text",
  "shortDescription_i18n.en": "text",
  "description_i18n.vi": "text",
  "description_i18n.en": "text",
  tags: "text",
});

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);
