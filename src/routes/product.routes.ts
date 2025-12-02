import { Router } from "express";
import { authAdmin } from "../middlewares/authAdmin";
import { productController } from "../controllers/product.controller";

const router = Router();

router.get("/", productController.getProducts);
router.get("/admin", authAdmin, productController.getProductsAdmin);
router.get("/best-sellers", productController.listBestSellers);
router.get("/signature-lineup", productController.listSignatureLineup);
router.get("/:slug", productController.getProductBySlug);

router.post("/", authAdmin, productController.createProduct);
router.put("/:id", authAdmin, productController.updateProduct);
router.delete("/:id", authAdmin, productController.deleteProduct);

export default router;
