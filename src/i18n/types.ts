export type Locale = "vi" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["vi", "en"];
export const DEFAULT_LOCALE: Locale = "vi";

export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const v = input.toLowerCase();

  if (v.startsWith("en")) return "en";
  if (v.startsWith("vi")) return "vi";

  return DEFAULT_LOCALE;
}

export type LocalizedString = Partial<Record<Locale, string>>;
