import fs from "fs";
import { BASE_FOLDER } from "./ts_constants.js";
import { getCreationTimeDateString } from "./ts_datetime.js";

const fsp = fs.promises;

const dateMapping: Record<string, string> = {};

// ---------- Generic Helper ----------
export async function ensureFolderExists(path: string): Promise<void> {
  const fullPath = `${BASE_FOLDER}/${path}`;
  console.log("ensureFolderExists",fullPath)
  try {
    await fsp.mkdir(fullPath, { recursive: true });
  } catch (err) {
    console.error("Failed to create folder:", fullPath, err);
    throw err;
  }
}

// ---------- LAB ----------
export async function ensureLabFolderExists(
  caseId: string,
  creationTimeMs: number
): Promise<void> {
  const date = getCreationTimeDateString(creationTimeMs);
  dateMapping[caseId] = date;

  const labToken = caseId.slice(0, 2);

  console.log("ensureLabFolderExists",date,labToken)

  await ensureFolderExists(`${date}/${labToken}/IMPORT`);
  await ensureFolderExists(`${date}/${labToken}/EXPORT - Internal`);
  await ensureFolderExists(`${date}/${labToken}/EXPORT - External`);
  await ensureFolderExists(`${date}/${labToken}/Uploads`);

}

// ---------- CASE ----------
export async function ensureCaseFolderExists(
  caseId: string,
  folderType: string
): Promise<void> {
  validateFolderType(folderType);


  
  const labToken = caseId.slice(0, 2);
  const date = dateMapping[caseId];
  
  console.log(caseId, labToken,date,"during creation ")
  await ensureFolderExists(`${date}/${labToken}/${folderType}/${caseId}`);
}

export function getFilePath(
  caseId: string,
  filename: string,
  folderType: string
): string {
  validateFolderType(folderType);

  const labToken = caseId.slice(0, 2);

  console.log("Get file path return : ",`${BASE_FOLDER}/${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}/${filename}`)
  return `${BASE_FOLDER}/${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}/${filename}`;
}

// ---------- VALIDATION ----------
export function validateFolderType(folderType: string): void {
  const validFolderType = [
    "IMPORT",
    "EXPORT - Internal",
    "EXPORT - External",
    "Uploads",
  ].includes(folderType);

  if (!validFolderType) {
    throw new Error(
      `Invalid folderType ${folderType}, must be "IMPORT", "EXPORT - Internal", "EXPORT - External", "Uploads"`
    );
  }
}



// ---------- REDESIGN ----------
export async function ensureRedesignFolderExists(
  rdCaseId: string,
  creationTimeMs: number
): Promise<void> {
  const date = getCreationTimeDateString(creationTimeMs);
  dateMapping[rdCaseId] = date;

  await ensureFolderExists(`${date}/REDESIGN`);
  await ensureFolderExists(`${date}/REDESIGN/${rdCaseId}`);
}

export function getRedesignFolderPath(rdCaseId: string): string {
  return `${BASE_FOLDER}/${dateMapping[rdCaseId]}/REDESIGN/${rdCaseId}`;
}