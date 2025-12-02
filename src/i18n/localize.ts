// src/i18n/localize.ts
import { DEFAULT_LOCALE, Locale } from "./types";

type AnyDoc = Record<string, any>;

interface LocalizeOptions {
  fields: string[];
  includeSlugI18n?: boolean;
}

export function localizeDoc<T extends AnyDoc>(
  doc: T,
  locale: Locale,
  options: LocalizeOptions
): T {
  const { fields, includeSlugI18n = true } = options;
  const out: any = { ...doc };

  for (const f of fields) {
    const i18n = doc?.[`${f}_i18n`];
    out[f] = (i18n && (i18n[locale] || i18n[DEFAULT_LOCALE])) ?? doc?.[f] ?? "";
  }

  if (includeSlugI18n && doc?.slug_i18n) {
    out.slug =
      doc.slug_i18n[locale] || doc.slug_i18n[DEFAULT_LOCALE] || doc.slug;
  }

  return out as T;
}

export function localizeList<T extends AnyDoc>(
  docs: T[],
  locale: Locale,
  options: LocalizeOptions
): T[] {
  return docs.map((d) => localizeDoc(d, locale, options));
}

export function detectLocale(input?: string): Locale {
  if (!input) return DEFAULT_LOCALE;
  return /en/i.test(input) ? "en" : "vi";
}
