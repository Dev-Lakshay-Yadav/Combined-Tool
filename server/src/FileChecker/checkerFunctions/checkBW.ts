import {
  countFilesContaining,
  countFilesExt,
} from "../checkerUtils/commonUtils.js";

import { PdfData, FolderData } from "../../types/commonTypes.js";

export const CheckerFunctionBW = async (
  pdfData: PdfData,
  folderData: FolderData,
  errors: string[]
): Promise<string[]> => {
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("Missing .stl file");
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
    errors.push("At least 3 additional pics required");
  }
  if (!(countFilesContaining(folderData, "model", [".stl"]) >= 3)) {
    errors.push("At least 2 stl model required");
  }
  return errors;
};
