import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();

router.post("/login", authController.login);
router.get("/me", authAdmin, authController.me);
router.post("/logout", authController.logout);
router.post("/refresh", authController.refresh);

export default router;
