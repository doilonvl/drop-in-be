import { Router } from "express";
import { blogController } from "../controllers/blog.controller";

const router = Router();

router.get("/", blogController.listPublicBlogs);
router.get("/:slug", blogController.getPublicBlogBySlug);
router.post("/:id/view", blogController.incrementViewCount);

export default router;
