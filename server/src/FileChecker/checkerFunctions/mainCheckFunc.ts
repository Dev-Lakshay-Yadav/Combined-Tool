import {
  crownAndBridgeCheck,
  digitalModelCheck,
  implantCheck,
  nightguardCheck,
  noPrepVeneerCheck,
  otherTreatmentsCheck,
  smileDesignCheck,
  surgicalGuideCheck,
} from "../checkerUtils/categoryUtils.js";
import { Result } from "../../types/commonTypes.js";

export type ResultData = Result | null;

// checker now returns list of errors
type CheckerFn = (
  pdfData: any,
  folderData: any,
  serviceErrors: string[]
) => Promise<string[]>;

// New function
export const validateAndBuildResult = async (
  caseData: string,
  pdfData: any,
  folderData: string[],
  checkerFn?: CheckerFn
): Promise<Result> => {
  let errors: string[] = [];

  // file prefix check
  if (!pdfData.file_Prefix) {
    errors.push("Missing file prefix in PDF.");
  }

  if (!folderData || folderData.length < 1) {
    errors.push("No Export files yet.");
  }

  // tooth numbers check
  if (
    (!pdfData.tooth_Numbers || pdfData.tooth_Numbers.length === 0) &&
    pdfData.service_Type !== "Digital Model" &&
    pdfData.service_Type !== "Nightguard" &&
    pdfData.service_Type !== "Other Treatments" &&
    pdfData.service_Type !== null
  ) {
    errors.push("No tooth numbers found in PDF.");
  }

  // service-specific validations
  if (errors.length === 0) {
    let serviceErrors: string[] = [];

    if (pdfData.service_Type === "Crown And Bridge") {
      serviceErrors = await crownAndBridgeCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Implant") {
      serviceErrors = await implantCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Smile Design") {
      serviceErrors = await smileDesignCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Digital Model") {
      serviceErrors = await digitalModelCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Surgical Guide") {
      serviceErrors = await surgicalGuideCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Nightguard") {
      serviceErrors = await nightguardCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "No-prep veneer") {
      serviceErrors = await noPrepVeneerCheck(folderData, serviceErrors);
    } else if (pdfData.service_Type === "Other Treatments") {
      serviceErrors = await otherTreatmentsCheck(folderData, serviceErrors);
    }

    if (checkerFn) {
      serviceErrors = await checkerFn(pdfData, folderData, serviceErrors);
    }

    errors.push(...serviceErrors);
  }

  // final result
  return {
    success: errors.length === 0,
    file_Prefix: caseData,
    service_Type: pdfData.service_Type || null,
    tooth_Numbers: pdfData.tooth_Numbers || [],
    additional_Notes: pdfData.additional_Notes || null,
    error: errors,
  };
};
