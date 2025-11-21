import {
  countFilesContaining,
  countFilesExt,
  hasImageContaining,
} from "../checkerUtils/commonUtils.js";

import { PdfData, FolderData } from "../../types/commonTypes.js";

export const checkerFunctionJU = async (
  pdfData: PdfData,
  folderData: FolderData,
  errors: string[]
): Promise<string[]> => {
  
  if (pdfData.service_Type !== "Digital Model") {
    if (!(countFilesExt(folderData, [".html"]) > 0)) {
      errors.push("At least 1 .html file required");
    }
  }

  // crown and bridge
  if (pdfData.service_Type === "Crown And Bridge") {
    if (!hasImageContaining(folderData, "occlusal contact")) {
      errors.push("Missing image: occlusal contact");
    }
    if (!hasImageContaining(folderData, "proximal contact")) {
      errors.push("Missing image: proximal contact");
    }
    if (!hasImageContaining(folderData, "cement gap")) {
      errors.push("Missing image: cement gap");
    }
    if (
      !(
        countFilesContaining(folderData, "pic", [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
        ]) >= 3
      )
    ) {
      errors = errors.filter((e) => e !== "At least 1 pic required");
      errors.push("At least 3 additional pics required");
    }

    // New checks
    const stlPerToothExpected = pdfData.tooth_Numbers?.length || 0;
    const stlFilesFound =
      folderData?.filter(
        (f) =>
          f.toLowerCase().endsWith(".stl") &&
          !f.toLowerCase().includes("preop") &&
          !f.toLowerCase().includes("pre op")
      ).length ?? 0;

    if (stlFilesFound < stlPerToothExpected) {
      errors = errors.filter((e) => e !== "At least 1 .stl file required");
      errors.push("Missing .stl files per teeth");
    }

    const numTeeth = pdfData.tooth_Numbers?.length || 0;
    if (numTeeth > 3) {
      const files = folderData?.map((f) => f.toLowerCase()) ?? [];
      const preOps = files.filter(
        (f) =>
          (f.includes("preop") || f.includes("pre op")) &&
          (f.endsWith(".stl") ||
            f.endsWith(".jpg") ||
            f.endsWith(".jpeg") ||
            f.endsWith(".png"))
      );

      const hasStl = preOps.some((f) => f.endsWith(".stl"));
      const hasImage = preOps.some(
        (f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png")
      );

      if (!hasStl || !hasImage) {
        errors.push(
          "Pre-op files missing: need atleast one .stl and one image"
        );
      }
    }

    return errors;
  }

  // implant
  if (pdfData.service_Type === "Implant") {
    if (!hasImageContaining(folderData, "hole angulation")) {
      errors.push("Missing image: hole angulation");
    }
    if (
      !(
        hasImageContaining(folderData, "3 mm hole") ||
        hasImageContaining(folderData, "3mm hole")
      )
    ) {
      errors.push("Missing image: 3 mm hole");
    }
    if (!hasImageContaining(folderData, "ti base")) {
      errors.push("Missing image: ti base");
    }
    if (!hasImageContaining(folderData, "occlusal contact")) {
      errors.push("Missing image: occlusal contact");
    }
    if (!hasImageContaining(folderData, "proximal contact")) {
      errors.push("Missing image: proximal contact");
    }
    if (
      !(
        countFilesContaining(folderData, "pic", [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
        ]) >= 4
      )
    ) {
      errors = errors.filter((e) => e !== "At least 1 pic required");
      errors.push("At least 4 additional pics required");
    }
    if (
      !(
        countFilesExt(folderData, [".stl"]) >= pdfData.tooth_Numbers?.length ||
        0
      )
    ) {
      errors.push("Missing .stl files per tooth");
    }

    return errors;
  }

  // smile design
  if (pdfData.service_Type === "Smile Design") {
    if (
      !(
        countFilesContaining(folderData, "pic", [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
        ]) >= 6
      )
    ) {
      errors = errors.filter((e) => e !== "At least 3 pic required");
      errors.push("At least 6 additional pics required");
    }
    if (!(countFilesExt(folderData, [".stl"]) >= 2)) {
      errors = errors.filter((e) => e !== "At least 1 .stl file required");
      errors.push("At least 2 .stl files required");
    }
    return errors;
  }

  // no-prep veneer
  if (pdfData.service_Type === "No-prep veneer") {
    if (
      !(
        countFilesContaining(folderData, "pic", [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
        ]) >= 4
      )
    ) {
      errors.push("At least 4 additional pics required");
    }
    if (
      !(
        countFilesExt(folderData, [".stl"]) >= pdfData.tooth_Numbers?.length ||
        0
      )
    ) {
      errors.push("Missing .stl files per tooth");
    }
    return errors;
  }

  return errors;
};
