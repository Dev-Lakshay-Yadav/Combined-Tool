import {
    countFilesExt,
    hasImageContaining,
    hasSTLContaining,
  } from "../checkerUtils/commonUtils.js";
  
  import { PdfData, FolderData } from "../../types/commonTypes.js";
  
  export const CheckerFunctionLZ = async (
    pdfData: PdfData,
    folderData: FolderData,
    errors: string[]
  ): Promise<string[]> => {
  
    if (!(countFilesExt(folderData, [".html"]) > 0)) {
      errors.push("Missing .html file");
    }
    if (!hasSTLContaining(folderData, "model")) {
      errors.push("Missing stl: model");
    }
    if (!hasImageContaining(folderData, "heat map")) {
      errors.push("Missing image: heat map");
    }
    return errors;
  };
  