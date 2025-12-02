import { Request, Response } from "express";
import { uploadSingle, uploadMultiple } from "../middlewares/upload";

function buildInline(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "upload");
    if (idx >= 0 && parts[idx + 1]?.startsWith("fl_inline") === false) {
      parts.splice(idx + 1, 0, "fl_inline");
      u.pathname = "/" + parts.join("/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function buildAttachment(url: string, filename: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "upload");
    if (idx >= 0) {
      parts.splice(idx + 1, 0, `fl_attachment:${encodeURIComponent(filename)}`);
      u.pathname = "/" + parts.join("/");
    }
    return u.toString();
  } catch {
    return url;
  }
}

interface CloudinaryUploadedFile extends Express.Multer.File {
  path: string;
  public_id?: string;
  resource_type?: string;
  format?: string;
  bytes?: number;
}

function normalizeDownloadFileName(
  publicId: string | undefined,
  format: string | undefined
) {
  const baseName = (publicId?.split("/").pop() || "file").trim() || "file";
  const safeFormat = (format || "").toLowerCase();
  const ext = safeFormat || "dat";
  return `${baseName}.${ext}`;
}

export const uploadController = {
  single: [
    uploadSingle,
    (req: Request, res: Response) => {
      const f = req.file as CloudinaryUploadedFile | undefined;
      if (!f) return res.status(400).json({ message: "No file uploaded" });

      const secureUrl: string = f.path;
      const publicId: string = f.public_id || f.filename;
      const format: string | undefined = f.format;
      const bytes: number = f.bytes ?? f.size;
      const resourceType: string = f.resource_type || "image";

      const contentType: string =
        f.mimetype ||
        (format === "pdf"
          ? "application/pdf"
          : resourceType === "video"
          ? "video/mp4"
          : "application/octet-stream");

      const downloadFileName = normalizeDownloadFileName(publicId, format);
      const view_url = buildInline(secureUrl);
      const download_url = buildAttachment(secureUrl, downloadFileName);

      res.json({
        url: secureUrl,
        publicId,
        bytes,
        resource_type: resourceType,
        format,
        contentType,
        view_url,
        download_url,
      });
    },
  ],

  multi: [
    uploadMultiple,
    (req: Request, res: Response) => {
      const files = (req.files as CloudinaryUploadedFile[]) || [];

      const items = files.map((f) => {
        const secureUrl: string = f.path;
        const publicId: string = f.public_id || f.filename;
        const format: string | undefined = f.format;
        const bytes: number = f.bytes ?? f.size;
        const resourceType: string = f.resource_type || "image";

        const contentType: string =
          f.mimetype ||
          (format === "pdf"
            ? "application/pdf"
            : resourceType === "video"
            ? "video/mp4"
            : "application/octet-stream");

        const downloadFileName = normalizeDownloadFileName(publicId, format);

        return {
          url: secureUrl,
          publicId,
          bytes,
          resource_type: resourceType,
          format,
          contentType,
          view_url: buildInline(secureUrl),
          download_url: buildAttachment(secureUrl, downloadFileName),
        };
      });

      res.json({ items });
    },
  ],
};
