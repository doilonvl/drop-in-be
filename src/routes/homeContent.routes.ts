import { Router } from "express";
import { homeContentController } from "../controllers/homeContent.controller";
import { authAdmin } from "../middlewares/authAdmin";

const router = Router();

router.get("/", homeContentController.getHomeContent);

router.put("/", authAdmin, homeContentController.upsertHomeContent);
router.delete("/", authAdmin, homeContentController.deleteHomeContent);

export default router;
