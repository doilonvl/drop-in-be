// src/controllers/homeContent.controller.ts
import { Request, Response } from "express";
import { homeContentRepo } from "../repositories/homeContent.repo";
import { detectLocale, localizeDoc } from "../i18n/localize";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";

const L_FIELDS = ["heroTitle", "heroSubtitle", "seoTitle", "seoDescription"];

function shouldLocalize(
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
): boolean {
  if (req.query && (req.query as any).locale) return true;
  const acceptLang = req.headers["accept-language"];
  return typeof acceptLang === "string" && acceptLang.trim().length > 0;
}

export const homeContentController = {
  async getHomeContent(req: Request, res: Response) {
    try {
      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);

      const doc = await homeContentRepo.getHome(true);
      if (!doc) {
        return res.status(404).json({ message: "Home content not found" });
      }

      const plain = (doc as any).toObject?.() || doc;

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json(plain);
      }

      const localized = localizeDoc(plain, locale, { fields: L_FIELDS });
      return res.json(localized);
    } catch (err: any) {
      console.error("[HOME GET]", err);
      res.status(500).json({ message: "Failed to get home content" });
    }
  },

  async upsertHomeContent(req: Request, res: Response) {
    try {
      let body: any = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
        }
      }

      if (!body || typeof body !== "object") {
        return res.status(400).json({ message: "Missing JSON body" });
      }

      if (
        !body.heroTitle_i18n ||
        (!body.heroTitle_i18n.vi && !body.heroTitle_i18n.en)
      ) {
        return res.status(400).json({
          message: "heroTitle_i18n (vi hoặc en) is required",
        });
      }

      if (
        !body.signatureSection ||
        !body.signatureSection.title_i18n ||
        (!body.signatureSection.title_i18n.vi &&
          !body.signatureSection.title_i18n.en)
      ) {
        return res.status(400).json({
          message: "signatureSection.title_i18n (vi hoặc en) is required",
        });
      }

      await homeContentRepo.upsertHome(body);

      const locale =
        (req.query.locale as any) ||
        detectLocale(req.headers["accept-language"] as string);
      const updated = await homeContentRepo.getHome(true);

      if (!updated) {
        return res
          .status(500)
          .json({ message: "Failed to reload home content after update" });
      }

      const plain = (updated as any).toObject?.() || updated;

      res.setHeader("Vary", "Accept-Language");

      if (!shouldLocalize(req)) {
        return res.json(plain);
      }

      const localized = localizeDoc(plain, locale, { fields: L_FIELDS });
      return res.json(localized);
    } catch (err: any) {
      console.error("[HOME UPSERT]", err);
      res.status(400).json({
        message: err?.message || "Failed to upsert home content",
      });
    }
  },

  async deleteHomeContent(req: Request, res: Response) {
    try {
      await homeContentRepo.deleteHome();
      res.json({ message: "Home content deleted" });
    } catch (err: any) {
      console.error("[HOME DELETE]", err);
      res.status(400).json({
        message: err?.message || "Failed to delete home content",
      });
    }
  },
};
