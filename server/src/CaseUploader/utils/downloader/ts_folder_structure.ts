import fs from "fs";
import { BASE_FOLDER } from "./ts_constants.js";
import { getCreationTimeDateString } from "./ts_datetime.js";

const dateMapping: Record<string, string> = {};

export function ensureFolderExists(path: string): void {
  if (!fs.existsSync(`${BASE_FOLDER}/${path}`)) {
    fs.mkdirSync(`${BASE_FOLDER}/${path}`, { recursive: true });
  }
}

export function ensureRedesignFolderExists(
  rdCaseId: string,
  creationTimeMs: number
): void {
  const date = getCreationTimeDateString(creationTimeMs);
  dateMapping[rdCaseId] = date;
  ensureFolderExists(`${date}/REDESIGN`);
  ensureFolderExists(`${date}/REDESIGN/${rdCaseId}`);
}

export function getRedesignFolderPath(rdCaseId: string): string {
  return `${BASE_FOLDER}/${dateMapping[rdCaseId]}/REDESIGN/${rdCaseId}`;
}

export function ensureLabFolderExists(
  caseId: string,
  creationTimeMs: number
): void {
  dateMapping[caseId] = getCreationTimeDateString(creationTimeMs);
  const labToken = caseId.slice(0, 2);
  ensureFolderExists(`${dateMapping[caseId]}/${labToken}/IMPORT`);
  ensureFolderExists(`${dateMapping[caseId]}/${labToken}/EXPORT - Internal`);
  ensureFolderExists(`${dateMapping[caseId]}/${labToken}/EXPORT - External`);
  ensureFolderExists(`${dateMapping[caseId]}/${labToken}/Uploads`);
}

export function ensureCaseFolderExists(
  caseId: string,
  folderType: string
): void {
  validateFolderType(folderType);

  const labToken = caseId.slice(0, 2);
  ensureFolderExists(
    `${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}`
  );
}

export function getFilePath(
  caseId: string,
  filename: string,
  folderType: string
): string {
  validateFolderType(folderType);

  const labToken = caseId.slice(0, 2);
  return `${BASE_FOLDER}/${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}/${filename}`;
}

export function validateFolderType(folderType: string): void {
  const validFolderType = [
    "IMPORT",
    "EXPORT - Internal",
    "EXPORT - External",
    "Uploads",
  ].includes(folderType);

  if (!validFolderType) {
    throw new Error(
      `Invalid folderType ${folderType}, must be "IMPORT", "EXPORT - Internal", "EXPORT - External, Uploads"`
    );
  }
}












//      !@!@!@!@!@!!@           unused functions            @!@!@!@!@!@!@

// export function ensureDesignerCaseFolderExists(
//   designer: string,
//   creationTimeMs: number,
//   caseName: string
// ): void {
//   ensureFolderExists(getDesignerCaseFolder(designer, creationTimeMs, caseName));
// }

// export function getDesignerCaseFolder(
//   designer: string,
//   creationTimeMs: number,
//   caseName: string
// ): string {
//   const dateString = getCreationTimeDateString(creationTimeMs);
//   return `${dateString}/${designer}/${caseName}`;
// }

// export function getBaseFolders(): string[] {
//   const allItems = fs.readdirSync(`${BASE_FOLDER}`, { withFileTypes: true });

//   return allItems
//     .filter((e) => e.isDirectory() && e.name.startsWith("RT-"))
//     .map((e) => e.name);
// }

// export function getDesignerCaseFolderRaw(
//   designer: string,
//   creationTimeMs: number,
//   caseName: string
// ): string {
//   const folderPath = getDesignerCaseFolder(designer, creationTimeMs, caseName);
//   return `${BASE_FOLDER}/${folderPath}`;
// }

// export function getClientCaseFolder(
//   caseId: string,
//   creationTimeMs: number
// ): string {
//   const labToken = caseId.slice(0, 2);
//   const dateString = getCreationTimeDateString(creationTimeMs);
//   return `${BASE_FOLDER}/${dateString}/${labToken}/IMPORT/${caseId}`;
// }

// export function checkFileExists(
//   caseId: string,
//   filename: string,
//   folderType: string
// ): boolean {
//   return fs.existsSync(getFilePath(caseId, filename, folderType));
// }

// export function getCasesForDate(dateString: string): Record<string, string[]> {
//   const clients = fs.readdirSync(`${BASE_FOLDER}/${dateString}`);
//   const exportCases: Record<string, string[]> = {};

//   for (const client of clients) {
//     if (client.length > 2) {
//       continue;
//     }
//     exportCases[client] = fs.readdirSync(
//       `${BASE_FOLDER}/${dateString}/${client}/IMPORT`
//     );
//   }
//   return exportCases;
// }

// export function getAllDesignedLabFiles(dateString: string, labToken: string): {
//   fileNames: string[];
//   folderNames: string[];
//   filePath: string;
// } {
//   const topLevelItems = fs.readdirSync(
//     `${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External`,
//     { withFileTypes: true }
//   );

//   const folderNames = topLevelItems
//     .filter((e) => e.isDirectory() && !e.name.startsWith("["))
//     .map((e) => e.name);
//   const versionFolders = topLevelItems
//     .filter((e) => e.isDirectory() && e.name.startsWith("["))
//     .map((e) => e.name);
//   let fileNames = topLevelItems.filter((e) => !e.isDirectory()).map((e) => e.name);

//   for (const versionFolder of versionFolders) {
//     fileNames = fileNames.concat(
//       fs
//         .readdirSync(
//           `${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External/${versionFolder}`
//         )
//         .map((f) => `${versionFolder} ${f}`)
//     );
//   }
//   fileNames.sort();

//   return {
//     fileNames,
//     folderNames,
//     filePath: `${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External`,
//   };
// }

// export function getExportFilesForCase(
//   dateString: string,
//   labToken: string,
//   caseID: string
// ): {
//   success: boolean;
//   data?: {
//     subFolders: Record<
//       string,
//       { TS_PREVIEW: FileInfo[]; TS_DOWNLOAD: FileInfo[] }
//     >;
//     caseFilePath: string;
//   };
//   error?: string;
// } {
//   if (
//     !fs.existsSync(`${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`)
//   ) {
//     return {
//       success: true,
//       data: {
//         subFolders: {},
//         caseFilePath: `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//       },
//     };
//   }

//   const topLevelItems = fs.readdirSync(
//     `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//     { withFileTypes: true }
//   );

//   const nonFolders = topLevelItems.filter((e) => !e.isDirectory());
//   if (nonFolders.length > 0) {
//     const nonFolderNames = nonFolders.map((e) => e.name).join(", ");
//     return {
//       success: false,
//       error: `Uploads/${caseID} should ONLY contain folders representing groups of files for this case. Please move ${nonFolderNames} into appropriate folders.`,
//     };
//   }

//   const data: Record<
//     string,
//     { TS_PREVIEW: FileInfo[]; TS_DOWNLOAD: FileInfo[] }
//   > = {};
//   for (const subFolder of topLevelItems) {
//     const files = fs.readdirSync(
//       `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}/${subFolder.name}`,
//       { withFileTypes: true }
//     );

//     const nonFiles = files.filter((f) => !f.isFile());
//     if (nonFiles.length > 0) {
//       const nonFileNames = nonFiles.map((f) => f.name).join(", ");
//       return {
//         success: false,
//         error: `Uploads/${caseID}/${subFolder.name} should ONLY contain files. Please address ${nonFileNames}`,
//       };
//     }
//     data[subFolder.name] = { TS_PREVIEW: [], TS_DOWNLOAD: [] };
//     for (const f of files) {
//       const isPreview = ["JPG", "JPEG", "PNG"].includes(
//         f.name.split(".").slice(-1)[0].toUpperCase()
//       );
//       if (isPreview) {
//         data[subFolder.name]["TS_PREVIEW"].push({
//           file_name: f.name,
//           file_type: "TS_PREVIEW",
//           folder_name: subFolder.name,
//           file_id: null,
//         });
//       } else {
//         data[subFolder.name]["TS_DOWNLOAD"].push({
//           file_name: f.name,
//           file_type: "TS_DOWNLOAD",
//           folder_name: subFolder.name,
//           file_id: null,
//         });
//       }
//     }
//   }

//   return {
//     success: true,
//     data: {
//       subFolders: data,
//       caseFilePath: `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//     },
//   };
// }

// ---------- TYPES ----------
// interface FileInfo {
//   file_name: string;
//   file_type: "TS_PREVIEW" | "TS_DOWNLOAD";
//   folder_name: string;
//   file_id: string | null;
// }










//       @#@#@#@#@#@#     old code        #@#@#@#@#@#@#@

// import fs from 'fs'
// import {BASE_FOLDER} from './ts_constants.js'
// import {getCreationTimeDateString} from './ts_datetime.js'

// const dateMapping = {};

// export function ensureFolderExists(
//     path /* string */,
// ) {
//     if (!fs.existsSync(`${BASE_FOLDER}/${path}`)) {
//         fs.mkdirSync(`${BASE_FOLDER}/${path}`, { recursive: true });
//     }
// }

// export function ensureRedesignFolderExists(rdCaseId, creationTimeMs) {
//     const date = getCreationTimeDateString(creationTimeMs);
//     dateMapping[rdCaseId] = date;
//     ensureFolderExists(`${date}/REDESIGN`);
//     ensureFolderExists(`${date}/REDESIGN/${rdCaseId}`);
// }

// export function getRedesignFolderPath(rdCaseId) {
//     return `${BASE_FOLDER}/${dateMapping[rdCaseId]}/REDESIGN/${rdCaseId}`;
// }

// export function ensureLabFolderExists(caseId, creationTimeMs) {
//     dateMapping[caseId] = getCreationTimeDateString(creationTimeMs);

//     let labToken = caseId.slice(0,2);
//     ensureFolderExists(`${dateMapping[caseId]}/${labToken}/IMPORT`);
//     ensureFolderExists(`${dateMapping[caseId]}/${labToken}/EXPORT - Internal`);
//     ensureFolderExists(`${dateMapping[caseId]}/${labToken}/EXPORT - External`);
//     ensureFolderExists(`${dateMapping[caseId]}/${labToken}/Uploads`);
// }

// export function ensureCaseFolderExists(caseId, folderType) {
//     validateFolderType(folderType);

//     let labToken = caseId.slice(0,2);
//     ensureFolderExists(`${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}`);
// }

// export function ensureDesignerCaseFolderExists(designer, creationTimeMs, caseName) {
//     ensureFolderExists(getDesignerCaseFolder(designer, creationTimeMs, caseName));
// }

// export function getDesignerCaseFolder(designer, creationTimeMs, caseName) {
//     const dateString = getCreationTimeDateString(creationTimeMs);
//     return `${dateString}/${designer}/${caseName}`;
// }

// export function getBaseFolders() {
//     let allItems = fs.readdirSync(`${BASE_FOLDER}`, {withFileTypes: true});

//     return allItems.filter(e => e.isDirectory() && e.name.startsWith('RT-')).map(e => e.name);
// }

// export function getDesignerCaseFolderRaw(designer, creationTimeMs, caseName) {
//     const folderPath = getDesignerCaseFolder(designer, creationTimeMs, caseName);
//     return `${BASE_FOLDER}/${folderPath}`;
// }

// export function getClientCaseFolder(caseId, creationTimeMs) {
//     let labToken = caseId.slice(0,2);
//     const dateString = getCreationTimeDateString(creationTimeMs);
//     return `${BASE_FOLDER}/${dateString}/${labToken}/IMPORT/${caseId}`;
// }

// export function checkFileExists(caseId, filename, folderType) {
//     return fs.existsSync(getFilePath(caseId, filename, folderType));
// }

// export function getFilePath(caseId, filename, folderType) {
//     validateFolderType(folderType);

//     let labToken = caseId.slice(0,2);
//     return `${BASE_FOLDER}/${dateMapping[caseId]}/${labToken}/${folderType}/${caseId}/${filename}`;
// }

// export function validateFolderType(folderType) {
//     const validFolderType = [
//         'IMPORT',
//         'EXPORT - Internal',
//         'EXPORT - External',
//         'Uploads'
//     ].includes(folderType);

//     if (!validFolderType) {
//         throw `Invalid folderType ${folderType}, must be "IMPORT", "EXPORT - Internal", "EXPORT - External, Uploads"`;
//     }
// }

// export function getCasesForDate(dateString) {
//     let clients = fs.readdirSync(`${BASE_FOLDER}/${dateString}`);
//     let exportCases = {};
//     for (let client of clients) {
//         if (client.length > 2) {
//             continue;
//         }
//         exportCases[client] = fs.readdirSync(`${BASE_FOLDER}/${dateString}/${client}/IMPORT`);
//     }
//     return exportCases;
// }

// export function getAllDesignedLabFiles(dateString, labToken) {
//     let topLevelItems = fs.readdirSync(
//         `${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External`,
//         {withFileTypes: true}
//     );

//     const folderNames = topLevelItems.filter(e => e.isDirectory() && !e.name.startsWith('[')).map(e => e.name);
//     const versionFolders = topLevelItems.filter(e => e.isDirectory() && e.name.startsWith('[')).map(e => e.name);
//     let fileNames = topLevelItems.filter(e => !e.isDirectory()).map(e => e.name);
//     for (let versionFolder of versionFolders) {
//         fileNames = fileNames.concat(
//             fs.readdirSync(`${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External/${versionFolder}`)
//                 .map(f => `${versionFolder} ${f}`)
//         );
//     }
//     fileNames.sort();

//     console.log({fileNames, folderNames, versionFolders});

//     return {fileNames, folderNames, filePath: `${BASE_FOLDER}/${dateString}/${labToken}/EXPORT - External`};
// }

// export function getExportFilesForCase(dateString, labToken, caseID) {
//     if (!fs.existsSync(`${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`)) {
//         return {
//             success: true,
//             data: {
//                 subFolders: {},
//                 caseFilePath: `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//             },
//         };
//     }

//     let topLevelItems = fs.readdirSync(
//         `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//         {withFileTypes: true}
//     );

//     let nonFolders = topLevelItems.filter(e => !e.isDirectory());
//     if (nonFolders.length > 0) {
//         let nonFolderNames = nonFolders.map(e => e.name).join(', ');
//         return {
//             success: false,
//             error: `Uploads/${caseID} should ONLY contain folders representing groups of files for this case. Please move ${nonFolderNames} into appropriate folders.`,
//         };
//     }

//     let data = {};
//     for (let subFolder of topLevelItems) {
//         let files = fs.readdirSync(
//             `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}/${subFolder.name}`,
//             {withFileTypes: true}
//         );

//         let nonFiles = files.filter(f => !f.isFile());
//         if (nonFiles.length > 0) {
//             let nonFileNames = nonFiles.map(f => f.name).join(', ');
//             return {
//                 success: false,
//                 error: `Uploads/${caseID}/${subFolder.name} should ONLY contain files. Please address ${nonFileNames}`,
//             };
//         }
//         data[subFolder.name] = {'TS_PREVIEW': [], 'TS_DOWNLOAD': []};
//         for (let f of files) {
//             let isPreview = ['JPG', 'JPEG', 'PNG'].includes(f.name.split('.').slice(-1)[0].toUpperCase());
//             if (isPreview) {
//                 data[subFolder.name]['TS_PREVIEW'].push({
//                     file_name: f.name,
//                     file_type: 'TS_PREVIEW',
//                     folder_name: subFolder.name,
//                     file_id: null,
//                 });
//             } else {
//                 data[subFolder.name]['TS_DOWNLOAD'].push({
//                     file_name: f.name,
//                     file_type: 'TS_DOWNLOAD',
//                     folder_name: subFolder.name,
//                     file_id: null,
//                 });
//             }
//         }
//     }

//     return {
//         success: true,
//         data: {
//             subFolders: data,
//             caseFilePath: `${BASE_FOLDER}/${dateString}/${labToken}/Uploads/${caseID}`,
//         },
//     }
// }
