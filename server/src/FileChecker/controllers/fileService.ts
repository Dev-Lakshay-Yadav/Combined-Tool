import { Request, Response } from "express";
import { handleApiError } from "../utils/errorHandlers.js";
import { splitCasesByLabToken } from "../checkerUtils/mainChecker.js";

// ---------------- Controller ----------------
export const sendCasesStatus = async (req: Request, res: Response) => {
  try {
    const casesStatus = await splitCasesByLabToken();
    res.json(casesStatus);
  } catch (error) {
    handleApiError(res, error, "checkCases");
  }
};
