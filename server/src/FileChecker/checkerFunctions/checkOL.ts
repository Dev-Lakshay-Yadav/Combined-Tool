import {
  countFilesContaining,
  countFilesExt,
} from "../checkerUtils/commonUtils.js";

import { PdfData, FolderData } from "../../types/commonTypes.js";

export const CheckerFunctionOL = async (
  pdfData: PdfData,
  folderData: FolderData,
  errors: string[]
): Promise<string[]> => {
  if (!(countFilesExt(folderData, [".constructionInfo"]) > 0)) {
    errors.push("Missing construction file");
  }
  return errors;
};
