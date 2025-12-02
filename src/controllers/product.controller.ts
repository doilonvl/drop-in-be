// src/controllers/product.controller.ts
import { Request, Response } from "express";
import { productRepo } from "../repositories/product.repo";
import { detectLocale, localizeDoc, localizeList } from "../i18n/localize";
import { DEFAULT_LOCALE } from "../i18n/types";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
type ProductCategory =
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
const TEMP_OPTIONS = ["hot", "iced", "both", "warm"] as const;

const L_FIELDS = [
  "name",
  "shortDescription",
  "description",
  "seoTitle",
  "seoDescription",
];

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

function attachMetaFields(product: any, locale: string) {
  const locales = buildLocalePriority(locale);
  const metaTitle =
    pickLocalizedValue(product?.seoTitle_i18n, locales) ||
    pickLocalizedValue(product?.name_i18n, locales);
  const metaDescription =
    pickLocalizedValue(product?.seoDescription_i18n, locales) ||
    pickLocalizedValue(product?.shortDescription_i18n, locales) ||
    pickLocalizedValue(product?.description_i18n, locales);

  return { ...product, metaTitle, metaDescription };
}

export const productController = {
  async createProduct(req: Request, res: Response) {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      if (!body.name_i18n || (!body.name_i18n.vi && !body.name_i18n.en)) {
        return res.status(400).json({
          message: "At least one localized name (vi/en) is required",
        });
      }

      if (
        typeof body.price !== "number" ||
        Number.isNaN(body.price) ||
        body.price < 0
      ) {
        return res
          .status(400)
          .json({ message: "price must be a non-negative number" });
      }

      if (
        body.temperatureOptions !== undefined &&
        (!Array.isArray(body.temperatureOptions) ||
          !body.temperatureOptions.every((opt: any) =>
            TEMP_OPTIONS.includes(opt)
          ))
      ) {
        return res.status(400).json({
          message: `temperatureOptions must be an array of: ${TEMP_OPTIONS.join(
            ", "
          )}`,
        });
      }

      const doc = await productRepo.create(body);
      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const obj = (doc as any).toObject?.() || doc;
      const withMeta = attachMetaFields(obj, locale);
      return res.status(201).json(withMeta);
    } catch (err: any) {
      console.error("[PRODUCT CREATE]", err);

      if (err?.code === "PRODUCT_NAME_DUPLICATE") {
        return res.status(409).json({
          message:
            err.message || "Product name already exists in this category",
        });
      }

      res.status(400).json({
        message: err?.message || "Create product failed",
      });
    }
  },

  async getProducts(req: Request, res: Response) {
    try {
      const {
        page,
        limit,
        q,
        category,
        published,
        isBestSeller,
        isSignatureLineup,
        sort,
      } = req.query as any;

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);

      let publishedFlag: boolean | undefined = true;
      if (typeof published === "string") {
        if (published === "true") publishedFlag = true;
        else if (published === "false") publishedFlag = false;
        else if (published === "all") publishedFlag = undefined;
      }

      const result = await productRepo.list({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        q: q ? String(q) : undefined,
        category: category as ProductCategory | undefined,
        published: publishedFlag,
        isBestSeller:
          typeof isBestSeller === "string"
            ? isBestSeller === "true"
            : undefined,
        isSignatureLineup:
          typeof isSignatureLineup === "string"
            ? isSignatureLineup === "true"
            : undefined,
        sort: (sort as any) || "-createdAt",
      });

      const itemsWithMeta = result.items.map((item: any) =>
        attachMetaFields(item, locale)
      );

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json({ ...result, items: itemsWithMeta });
      }

      return res.json({
        ...result,
        items: localizeList(itemsWithMeta, locale, { fields: L_FIELDS }),
      });
    } catch (err: any) {
      console.error("[PRODUCT LIST]", err);
      res.status(500).json({ message: "Failed to list products" });
    }
  },

  async getProductsAdmin(req: Request, res: Response) {
    try {
      const {
        page,
        limit,
        q,
        category,
        published,
        isBestSeller,
        isSignatureLineup,
        sort,
      } = req.query as any;

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);

      let publishedFlag: boolean | undefined = undefined; // admin mặc định thấy tất cả
      if (typeof published === "string") {
        if (published === "true") publishedFlag = true;
        else if (published === "false") publishedFlag = false;
      }

      const result = await productRepo.list({
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        q: q ? String(q) : undefined,
        category: category as ProductCategory | undefined,
        published: publishedFlag,
        isBestSeller:
          typeof isBestSeller === "string"
            ? isBestSeller === "true"
            : undefined,
        isSignatureLineup:
          typeof isSignatureLineup === "string"
            ? isSignatureLineup === "true"
            : undefined,
        sort: (sort as any) || "-createdAt",
      });

      const itemsWithMeta = result.items.map((item: any) =>
        attachMetaFields(item, locale)
      );

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json({ ...result, items: itemsWithMeta });
      }

      return res.json({
        ...result,
        items: localizeList(itemsWithMeta, locale, { fields: L_FIELDS }),
      });
    } catch (err: any) {
      console.error("[PRODUCT LIST ADMIN]", err);
      res.status(500).json({ message: "Failed to list products (admin)" });
    }
  },

  async getProductBySlug(req: Request, res: Response) {
    try {
      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);

      const { slug } = req.params;

      const product = await productRepo.getBySlug(slug);
      if (!product) {
        return res.status(404).json({ message: "Not found" });
      }

      const obj = (product as any).toObject?.() || product;
      const withMeta = attachMetaFields(obj, locale);

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json(withMeta);
      }

      return res.json(localizeDoc(withMeta, locale, { fields: L_FIELDS }));
    } catch (err: any) {
      console.error("[PRODUCT GET BY SLUG]", err);
      res.status(500).json({ message: "Failed to get product" });
    }
  },

  async updateProduct(req: Request, res: Response) {
    try {
      let body: any = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {}
      }

      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      if (
        body.price !== undefined &&
        (typeof body.price !== "number" ||
          Number.isNaN(body.price) ||
          body.price < 0)
      ) {
        return res
          .status(400)
          .json({ message: "price must be a non-negative number" });
      }

      if (
        body.temperatureOptions !== undefined &&
        (!Array.isArray(body.temperatureOptions) ||
          !body.temperatureOptions.every((opt: any) =>
            TEMP_OPTIONS.includes(opt)
          ))
      ) {
        return res.status(400).json({
          message: `temperatureOptions must be an array of: ${TEMP_OPTIONS.join(
            ", "
          )}`,
        });
      }

      const updated = await productRepo.update(req.params.id, body);
      if (!updated) {
        return res.status(404).json({ message: "Not found" });
      }

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const obj = (updated as any).toObject?.() || updated;
      const withMeta = attachMetaFields(obj, locale);

      res.json(withMeta);
    } catch (err: any) {
      console.error("[PRODUCT UPDATE]", err);

      if (err?.code === "PRODUCT_NAME_DUPLICATE") {
        return res.status(409).json({
          message:
            err.message || "Product name already exists in this category",
        });
      }

      res.status(400).json({ message: err?.message || "Update failed" });
    }
  },

  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await productRepo.delete(id);
      res.json({ message: "Deleted successfully" });
    } catch (err: any) {
      console.error("[PRODUCT DELETE]", err);
      res.status(400).json({ message: err?.message || "Delete failed" });
    }
  },

  async listBestSellers(req: Request, res: Response) {
    try {
      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const limit = Number(req.query.limit) || 6;
      const category = req.query.category as ProductCategory | undefined;

      const items = await productRepo.listBestSellers(limit, category);

      const itemsWithMeta = items.map((item: any) =>
        attachMetaFields(item, locale)
      );

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json({ items: itemsWithMeta });
      }

      return res.json({
        items: localizeList(itemsWithMeta, locale, { fields: L_FIELDS }),
      });
    } catch (err: any) {
      console.error("[PRODUCT BEST SELLERS]", err);
      res.status(500).json({ message: "Failed to list best sellers" });
    }
  },

  async listSignatureLineup(req: Request, res: Response) {
    try {
      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const limit = Number(req.query.limit) || 6;
      const category = req.query.category as ProductCategory | undefined;

      const items = await productRepo.listSignatureLineup(limit, category);

      const itemsWithMeta = items.map((item: any) =>
        attachMetaFields(item, locale)
      );

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json({ items: itemsWithMeta });
      }

      return res.json({
        items: localizeList(itemsWithMeta, locale, { fields: L_FIELDS }),
      });
    } catch (err: any) {
      console.error("[PRODUCT SIGNATURE LINEUP]", err);
      res.status(500).json({ message: "Failed to list signature lineup" });
    }
  },
};
