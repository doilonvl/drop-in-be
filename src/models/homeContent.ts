import mongoose, { Document, Schema } from "mongoose";
import { LocalizedString } from "../i18n/types";
import { LocalizedStringSchema } from "./Common";

export type HomePageKey = "home";

export interface ImageI18n {
  url: string;
  alt_i18n?: LocalizedString;
}

export interface HeroSlide {
  product?: mongoose.Types.ObjectId;
  title_i18n?: LocalizedString;
  subtitle_i18n?: LocalizedString;
  description_i18n?: LocalizedString;
  image?: ImageI18n;

  order: number;
  isActive: boolean;
}

export interface CounterItem {
  label_i18n: LocalizedString;
  value: string;
}

export interface StorySection {
  title_i18n?: LocalizedString;
  headline_i18n?: LocalizedString;
  paragraphs_i18n?: LocalizedString[];
  image?: ImageI18n;
}

export interface SignatureSection {
  title_i18n: LocalizedString;
  subtitle_i18n?: LocalizedString;
  body_i18n?: LocalizedString;
  backgroundImage?: ImageI18n;
}

export interface IHomeContent extends Document {
  pageKey: HomePageKey;

  heroTitle_i18n: LocalizedString;
  heroSubtitle_i18n?: LocalizedString;
  heroBody_i18n?: LocalizedString[];
  heroBackgroundImage?: ImageI18n;

  heroSlides: HeroSlide[];

  counters: CounterItem[];

  storySection?: StorySection;

  signatureSection: SignatureSection;

  seoTitle_i18n?: LocalizedString;
  seoDescription_i18n?: LocalizedString;
  seoImageUrl?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ImageI18nSchema = new Schema<ImageI18n>(
  {
    url: { type: String, required: true, trim: true },
    alt_i18n: { type: LocalizedStringSchema, default: undefined },
  },
  { _id: false }
);

const HeroSlideSchema = new Schema<HeroSlide>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product" },

    title_i18n: { type: LocalizedStringSchema, default: undefined },
    subtitle_i18n: { type: LocalizedStringSchema, default: undefined },
    description_i18n: { type: LocalizedStringSchema, default: undefined },

    image: { type: ImageI18nSchema, default: undefined },

    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const CounterItemSchema = new Schema<CounterItem>(
  {
    label_i18n: { type: LocalizedStringSchema, required: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const StorySectionSchema = new Schema<StorySection>(
  {
    title_i18n: { type: LocalizedStringSchema, default: undefined },
    headline_i18n: { type: LocalizedStringSchema, default: undefined },
    paragraphs_i18n: {
      type: [LocalizedStringSchema],
      default: [],
    },
    image: { type: ImageI18nSchema, default: undefined },
  },
  { _id: false }
);

const SignatureSectionSchema = new Schema<SignatureSection>(
  {
    title_i18n: { type: LocalizedStringSchema, required: true },
    subtitle_i18n: { type: LocalizedStringSchema, default: undefined },
    body_i18n: { type: LocalizedStringSchema, default: undefined },
    backgroundImage: { type: ImageI18nSchema, default: undefined },
  },
  { _id: false }
);

const HomeContentSchema = new Schema<IHomeContent>(
  {
    pageKey: {
      type: String,
      enum: ["home"],
      default: "home",
    },

    heroTitle_i18n: {
      type: LocalizedStringSchema,
      required: true,
    },
    heroSubtitle_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },
    heroBody_i18n: {
      type: [LocalizedStringSchema],
      default: [],
    },
    heroBackgroundImage: {
      type: ImageI18nSchema,
      default: undefined,
    },

    heroSlides: {
      type: [HeroSlideSchema],
      default: [],
    },

    counters: {
      type: [CounterItemSchema],
      default: [],
    },

    storySection: {
      type: StorySectionSchema,
      default: undefined,
    },

    signatureSection: {
      type: SignatureSectionSchema,
      required: true,
    },

    seoTitle_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },
    seoDescription_i18n: {
      type: LocalizedStringSchema,
      default: undefined,
    },
    seoImageUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

HomeContentSchema.index({ pageKey: 1 }, { unique: true });

export const HomeContent =
  mongoose.models.HomeContent ||
  mongoose.model<IHomeContent>("HomeContent", HomeContentSchema);
