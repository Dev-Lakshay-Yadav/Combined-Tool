import { getFilesAndFolderNamesInsideCaseFolder } from "../services/folderFiles.js";
import { extractCaseDetailsFromPDF } from "../services/pdfToText.js";
import { Result } from "../../types/commonTypes.js";
import {
  getCasesList,
  getLabTokens,
  getSharedPath,
} from "../utils/fileUtils.js";

import { CheckerFunctionJI } from "../checkerFunctions/checkJI.js";
import { checkerFunctionJU } from "../checkerFunctions/checkJU.js";
import { CheckerFunctionLZ } from "../checkerFunctions/checkLZ.js";
import { CheckerFunctionSA } from "../checkerFunctions/checkSA.js";
import { validateAndBuildResult } from "../checkerFunctions/mainCheckFunc.js";
import { CheckerFunctionBW } from "../checkerFunctions/checkBW.js";
import { CheckerFunctionOL } from "../checkerFunctions/checkOL.js";

export type ResultData = Result | null;

// checker now returns list of errors
type CheckerFn = (
  pdfData: any,
  folderData: any,
  errors: string[]
) => Promise<string[]>;

// ---------------- Generic Processor ----------------
export const processLabCases = async (
  location: string,
  checkerFn?: CheckerFn
): Promise<Result[]> => {
  try {
    const commonCases = await getCasesList(location);
    const results: Result[] = [];

    for (const caseData of commonCases) {
      const pdfPath = `${location}/IMPORT/${caseData}`;
      const folderPath = `${location}/EXPORT - External/${caseData}`;

      const pdfData = await extractCaseDetailsFromPDF(pdfPath);
      
      const folderData = await getFilesAndFolderNamesInsideCaseFolder(
        folderPath
      );

      const result = await validateAndBuildResult(
        caseData,
        pdfData,
        folderData,
        checkerFn
      );
      results.push(result);
    }

    return results;
  } catch (error) {
    console.error(error, "processLabCases");
    return [];
  }
};

// ---------------- Common Check ----------------
export const commonCheck = async (tokens: string[], basePath: string) => {
  const results: Record<string, Result[]> = {};

  // Map lab token suffix -> checker function
  const checkerMap: Record<string, CheckerFn> = {
    JI: CheckerFunctionJI,
    JU: checkerFunctionJU,
    LZ: CheckerFunctionLZ,
    SA: CheckerFunctionSA,
    BW: CheckerFunctionBW,
    OL: CheckerFunctionOL,
  };

  for (const token of tokens) {
    const location = `${basePath}/${token}/`;
    const checkerFn = checkerMap[token] || undefined;
    results[token] = await processLabCases(location, checkerFn);
  }

  return results;
};

// ---------------- Split by Lab Token ----------------
export const splitCasesByLabToken = async () => {
  try {
    const commonPath = await getSharedPath();
    if (!commonPath) {
      throw new Error("Shared path is null or undefined");
    }

    const folderNames = await getLabTokens(commonPath);
    const includedLabTokens = [
      "JU",
      "JI",
      "LZ",
      "SA",
      "QF",
      "SS",
      "LZ",
      "LI",
      "ZQ",
      "ZE",
      "QX",
      "OL",
      "MB",
      "IH",
      "GV",
      "GI",
      "DS",
      "OI",
      "SX",
      "XC",
      "ZJ",
      "RJ",
      "IH",
      "MW",
      "TM",
    ];

    // filter only included tokens
    const filteredTokens = folderNames.filter((token) =>
      includedLabTokens.includes(token)
    );

    // call commonCheck with filtered tokens
    return await commonCheck(filteredTokens, commonPath);
  } catch (error) {
    console.error(error, "splitCasesByLab");
    return {};
  }
};
