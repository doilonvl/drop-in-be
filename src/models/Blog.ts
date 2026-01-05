import mongoose, { Document, Schema } from "mongoose";
import type { LocalizedString } from "../i18n/types";
import { LocalizedStringSchema } from "./Common";
import { normalizeSlug, type TocItem } from "../utils/blogContent";

export type BlogStatus = "draft" | "published" | "scheduled" | "archived";
export type RichDocJSON = Record<string, any>;

export interface BlogImage {
  url: string;
  publicId?: string;
  alt_i18n?: LocalizedString;
}

export interface BlogGalleryItem extends BlogImage {
  caption_i18n?: LocalizedString;
}

export interface IBlog extends Document {
  slug: string;
  slug_i18n: {
    vi: string;
    en: string;
  };

  title_i18n: LocalizedString;
  excerpt_i18n?: LocalizedString;
  content_i18n: {
    vi: RichDocJSON;
    en: RichDocJSON;
  };

  coverImage?: BlogImage;
  gallery?: BlogGalleryItem[];

  tags?: string[];

  status: BlogStatus;
  publishedAt?: Date | null;
  scheduledAt?: Date | null;
  isFeatured: boolean;
  sortOrder: number;

  seoTitle_i18n?: LocalizedString;
  seoDescription_i18n?: LocalizedString;
  canonicalUrl?: string;
  ogImageUrl?: string;
  robots?: {
    index: boolean;
    follow: boolean;
  };

  toc_i18n: {
    vi: TocItem[];
    en: TocItem[];
  };
  plainText_i18n: {
    vi: string;
    en: string;
  };
  readingTimeMinutes: number;
  stats: {
    viewCount: number;
  };

  authorName: string;
  createdBy?: mongoose.Types.ObjectId | null;
  updatedBy?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const SlugI18nSchema = new Schema(
  {
    vi: { type: String, required: true, trim: true, lowercase: true },
    en: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const ImageI18nSchema = new Schema<BlogImage>(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true },
    alt_i18n: { type: LocalizedStringSchema, default: undefined },
  },
  { _id: false }
);

const GalleryItemSchema = new Schema<BlogGalleryItem>(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true },
    alt_i18n: { type: LocalizedStringSchema, default: undefined },
    caption_i18n: { type: LocalizedStringSchema, default: undefined },
  },
  { _id: false }
);

const TocItemSchema = new Schema<TocItem>(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    level: { type: Number, enum: [2, 3], required: true },
  },
  { _id: false }
);

const BlogSchema = new Schema<IBlog>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    slug_i18n: { type: SlugI18nSchema, required: true },

    title_i18n: { type: LocalizedStringSchema, required: true },
    excerpt_i18n: { type: LocalizedStringSchema, default: undefined },
    content_i18n: {
      vi: { type: Schema.Types.Mixed, required: true },
      en: { type: Schema.Types.Mixed, required: true },
    },

    coverImage: { type: ImageI18nSchema, default: undefined },
    gallery: { type: [GalleryItemSchema], default: [] },

    tags: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: ["draft", "published", "scheduled", "archived"],
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },

    seoTitle_i18n: { type: LocalizedStringSchema, default: undefined },
    seoDescription_i18n: { type: LocalizedStringSchema, default: undefined },
    canonicalUrl: { type: String, trim: true },
    ogImageUrl: { type: String, trim: true },
    robots: {
      index: { type: Boolean, default: true },
      follow: { type: Boolean, default: true },
    },

    toc_i18n: {
      vi: { type: [TocItemSchema], default: [] },
      en: { type: [TocItemSchema], default: [] },
    },
    plainText_i18n: {
      vi: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    readingTimeMinutes: { type: Number, default: 0, min: 0 },
    stats: {
      viewCount: { type: Number, default: 0, min: 0 },
    },

    authorName: { type: String, trim: true, default: "DropInCafe" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

BlogSchema.pre("validate", function (next) {
  const doc: any = this;
  if (!doc.slug) {
    const base = doc.slug_i18n?.vi || doc.slug_i18n?.en;
    if (base) {
      doc.slug = normalizeSlug(base);
    }
  }
  if (doc.slug) {
    doc.slug = normalizeSlug(doc.slug);
  }
  if (doc.slug_i18n?.vi) {
    doc.slug_i18n.vi = normalizeSlug(doc.slug_i18n.vi);
  }
  if (doc.slug_i18n?.en) {
    doc.slug_i18n.en = normalizeSlug(doc.slug_i18n.en);
  }
  next();
});

BlogSchema.index({ "slug_i18n.vi": 1 }, { unique: true });
BlogSchema.index({ "slug_i18n.en": 1 }, { unique: true });
BlogSchema.index({ slug: 1 }, { unique: true, sparse: true });
BlogSchema.index({ status: 1, publishedAt: -1, isFeatured: -1 });
BlogSchema.index({ status: 1, deletedAt: 1, publishedAt: -1 });
BlogSchema.index({ deletedAt: 1 });
BlogSchema.index({
  "title_i18n.vi": "text",
  "title_i18n.en": "text",
  "excerpt_i18n.vi": "text",
  "excerpt_i18n.en": "text",
  "plainText_i18n.vi": "text",
  "plainText_i18n.en": "text",
});

export const Blog =
  mongoose.models.Blog || mongoose.model<IBlog>("Blog", BlogSchema);
