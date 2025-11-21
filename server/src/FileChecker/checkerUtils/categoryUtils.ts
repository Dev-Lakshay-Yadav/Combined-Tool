import {
  countFilesContaining,
  countFilesExt,
  hasImageContaining,
} from "./commonUtils.js";

export const crownAndBridgeCheck = async (
  folderData: any,
  errors: string[]
) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file required");
  }
  if (
    !(
      countFilesContaining(folderData, "pic", [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
      ]) >= 1
    )
  ) {
    errors.push("At least 1 pic required");
  }
  return errors;
};

export const implantCheck = async (folderData: any, errors: string[]) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".html"]) > 0)) {
    errors.push("At least 1 .html file required");
  }
  if (!hasImageContaining(folderData, "implant selection")) {
    errors.push("Missing image: implant selection");
  }
  if (
    !(
      countFilesContaining(folderData, "pic", [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
      ]) >= 1
    )
  ) {
    errors.push("At least 1 pic required");
  }
  return errors;
};

export const smileDesignCheck = async (folderData: any, errors: string[]) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file required");
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
    errors.push("At least 3 pic required");
  }
  return errors;
};

export const digitalModelCheck = async (folderData: any, errors: string[]) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file required");
  }
  if (
    !(
      countFilesContaining(folderData, "pic", [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
      ]) >= 1
    )
  ) {
    errors.push("At least 1 pic required");
  }
  return errors;
};

export const surgicalGuideCheck = async (folderData: any, errors: string[]) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".pdf"]) > 1)) {
    errors.push("At least 2 .pdf file required");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file required");
  }
  if (
    !(countFilesContaining(folderData, "pic", [".jpg", ".jpeg", ".png"]) >= 3)
  ) {
    errors.push("At least 3 pic required");
  }
  return errors;
};

export const nightguardCheck = async (folderData: any, errors: string[]) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file");
  }
  if (
    !(
      countFilesContaining(folderData, "pic", [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
      ]) >= 1
    )
  ) {
    errors.push("At least 1 pic required");
  }
  return errors;
};

export const noPrepVeneerCheck = async (
  folderData: any,
  errors: string[]
) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".html"]) > 0)) {
    errors.push("At least 1 .html file required");
  }
  return errors;
};

export const otherTreatmentsCheck = async (
  folderData: any,
  errors: string[]
) => {
  if (!(countFilesExt(folderData, [".zip"]) > 0)) {
    errors.push("At least 1 .zip file required");
  }
  if (!(countFilesExt(folderData, [".stl"]) > 0)) {
    errors.push("At least 1 .stl file required");
  }
  if (
    !(
      countFilesContaining(folderData, "pic", [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
      ]) >= 1
    )
  ) {
    errors.push("At least 1 pic required");
  }
  return errors;
};
