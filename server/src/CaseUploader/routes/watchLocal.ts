import { Router } from "express";
import {
  getAllCasesData,
} from "../controllers/watchLocalFiles.js";

const router = Router();

router.get("/cases/details", getAllCasesData);

export default router;