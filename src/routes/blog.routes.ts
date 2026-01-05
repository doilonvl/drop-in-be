import { Router } from "express";
import { authAdmin } from "../middlewares/authAdmin";
import { blogController } from "../controllers/blog.controller";

const router = Router();

router.use(authAdmin);

router.get("/", blogController.getBlogsAdmin);
router.get("/:id", blogController.getBlogById);
router.post("/", blogController.createBlog);
router.put("/:id", blogController.updateBlog);
router.patch("/:id", blogController.updateBlog);
router.delete("/:id", blogController.deleteBlog);

router.patch("/:id/publish", blogController.publishBlog);
router.patch("/:id/archive", blogController.archiveBlog);
router.patch("/:id/schedule", blogController.scheduleBlog);

export default router;
