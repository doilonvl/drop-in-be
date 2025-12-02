import { Schema } from "mongoose";
import type { LocalizedString } from "../i18n/types";

export const LocalizedStringSchema = new Schema<LocalizedString>(
  {
    vi: { type: String, trim: true },
    en: { type: String, trim: true },
  },
  { _id: false }
);
