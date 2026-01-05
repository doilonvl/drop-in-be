export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

const HEADING_LEVELS = new Set([2, 3]);

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

export const normalizeSlug = (text: string) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const getChildren = (node: any): any[] => {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node.children)) return node.children;
  if (Array.isArray(node.content)) return node.content;
  return [];
};

const extractText = (node: any): string => {
  if (!node || typeof node !== "object") return "";
  const parts: string[] = [];

  if (typeof node.text === "string") {
    parts.push(node.text);
  }

  for (const child of getChildren(node)) {
    const childText = extractText(child);
    if (childText) parts.push(childText);
  }

  return parts.join(" ");
};

const getHeadingLevel = (node: any): 2 | 3 | undefined => {
  if (!node || typeof node !== "object") return undefined;
  if (node.type !== "heading") return undefined;

  const level =
    typeof node.attrs?.level === "number"
      ? node.attrs.level
      : typeof node.attrs?.level === "string"
      ? Number(node.attrs.level)
      : typeof node.level === "number"
      ? node.level
      : undefined;

  if (typeof level === "number" && HEADING_LEVELS.has(level)) {
    return level as 2 | 3;
  }

  if (typeof node.tag === "string") {
    const tag = node.tag.toLowerCase();
    if (tag === "h2") return 2;
    if (tag === "h3") return 3;
  }

  return undefined;
};

export const extractRichDocSummary = (doc: any) => {
  const toc: TocItem[] = [];
  const textParts: string[] = [];
  const slugCounts = new Map<string, number>();

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (typeof node.text === "string") {
      textParts.push(node.text);
    }

    const headingLevel = getHeadingLevel(node);
    if (headingLevel) {
      const headingText = normalizeWhitespace(extractText(node));
      if (headingText) {
        const base = normalizeSlug(headingText) || "section";
        const count = slugCounts.get(base) || 0;
        const nextCount = count + 1;
        slugCounts.set(base, nextCount);
        const id = count === 0 ? base : `${base}-${nextCount}`;
        toc.push({ id, text: headingText, level: headingLevel });
      }
    }

    for (const child of getChildren(node)) {
      walk(child);
    }
  };

  const root = doc?.root && typeof doc.root === "object" ? doc.root : doc;
  walk(root);

  const plainText = normalizeWhitespace(textParts.join(" "));
  const wordCount = plainText ? plainText.split(/\s+/).length : 0;

  return { toc, plainText, wordCount };
};
