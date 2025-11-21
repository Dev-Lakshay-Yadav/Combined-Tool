import express from "express";
import {sendCasesStatus} from "../controllers/fileService.js"

const router = express.Router();

router.get("/status",sendCasesStatus);

export default router;