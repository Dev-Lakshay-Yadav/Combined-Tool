import express from "express";
import {
  uploadLiveCases,
  uploadRedesignCases,
} from "../controllers/uploadToBox.js";

const router = express.Router();

router.post("/upload/live", uploadLiveCases);
router.post("/upload/redesign", uploadRedesignCases);

export default router;
