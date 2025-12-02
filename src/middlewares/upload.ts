import path from "node:path";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";

const ROOT_FOLDER = process.env.CLOUDINARY_ROOT_FOLDER?.trim() || "dropincafe";

function sanitizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function sanitizeFolder(input?: string) {
  const s = (input || "").toString();
  const cleaned =
    s
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.\./g, "")
      .replace(/[^a-z0-9/_-]/gi, "-") || "uploads";
  return cleaned;
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const original = file.originalname;
    const ext = path.extname(original).slice(1).toLowerCase();
    const base = path.basename(original, path.extname(original));

    const isPdf = file.mimetype === "application/pdf" || ext === "pdf";
    const isVideoMp4 = file.mimetype === "video/mp4" || ext === "mp4";

    const folderArg = (req.body?.folder || req.query?.folder) as
      | string
      | undefined;

    const folder = `${ROOT_FOLDER}/${sanitizeFolder(folderArg)}`;

    return {
      folder,
      public_id: sanitizeName(base),
      resource_type: isPdf ? "raw" : isVideoMp4 ? "video" : "image",
      type: "upload",
      access_mode: "public",

      use_filename: false,
      unique_filename: false,
      overwrite: false,

      format: isPdf ? "pdf" : undefined,

      allowed_formats: isPdf
        ? ["pdf"]
        : isVideoMp4
        ? ["mp4"]
        : ["jpg", "jpeg", "png", "webp", "gif"],
    };
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export const uploadSingle = upload.single("file");
export const uploadMultiple = upload.array("files", 50);
