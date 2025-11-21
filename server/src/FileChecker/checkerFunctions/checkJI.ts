import { countFilesExt, hasImageContaining } from "../checkerUtils/commonUtils.js";

import { PdfData, FolderData } from "../../types/commonTypes.js";

export const CheckerFunctionJI = async (
  pdfData: PdfData,
  folderData: FolderData,
  errors : string[]
): Promise<string[]> => {

  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("Missing .zip file");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("Missing .stl file");
  }
  if (!hasImageContaining(folderData, "occlusal contact")) {
    errors.push("Missing image: occlusal contact");
  }
  if (!hasImageContaining(folderData, "proximal contact")) {
    errors.push("Missing image: proximal contact");
  }

  return errors;
};
