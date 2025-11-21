import fs from "fs";
import unzipper from "unzipper";
import axios from "axios";
import qs from "qs";
import xml_to_json from "xml-js";
import {
  getCreationTimeDateString,
  getCurrentTimeString,
} from "./ts_datetime.js";
import {
  INCOMING_CASES_QUERY,
  CONSTANTS_POST_ENDPOINT,
  CONSTANTS_GET_ENDPOINT,
  UPDATING_CASEFILES_AND_CASEUNITS,
} from "./ts_constants.js";
import {
  ensureLabFolderExists,
  ensureCaseFolderExists,
  getFilePath,
} from "./ts_folder_structure.js";
import { generateCasePDF } from "./ts_case_details_pdf.js";
import { processRedesigns } from "./ts_portal_redesigns_downloader.js";
import { getClient } from "../../config/box.js";
import path from "path";
import { getPatientFolders } from "../watchLogic.js";

// -------------------- Interfaces --------------------

export interface CaseDetails {
  case_id: string;
  box_folder_id: string;
  creation_time_ms: string;
  details_json: JSON; // will be parsed to object
}

export interface ParsedCaseDetails {
  services: Record<string, any>;
  [key: string]: any;
}

export interface BoxItem {
  id: string;
  name: string;
  type: "file" | "folder";
  item_status: "active" | string;
}

export interface BoxItemsResponse {
  entries: BoxItem[];
}

export interface CaseUnit {
  tooth_number: number;
  abutment_kit_id: string | null;
  anatomical: boolean;
  post_and_core: boolean;
  cache_tooth_type_class: string;
  unit_type: string;
}

export interface UnitElement {
  attributes: { name: string; value: string };
  elements?: UnitElement[];
}

// -------------------- Case Processing --------------------

export function processCases(client: any): void {
  axios({
    method: "get",
    url: CONSTANTS_GET_ENDPOINT + "case_downloader_mutex_ts",
  }).then((response) => {
    if (response.data["name"] !== "case_downloader_mutex_ts") {
      return;
    }

    const now = Math.round(new Date().getTime() / 1000);
    const prev = parseInt(response.data["value"]);
    if (prev + 2 * 60 > now) {
      console.log("Its already running!");
      return;
    }

    axios
      .post(
        CONSTANTS_POST_ENDPOINT,
        qs.stringify({ name: "case_downloader_mutex_ts", value: now })
      )
      .then((data) => {
        console.log({ data: data.data, message: "Update mutex value" });
        processCasesBehindLock(client);
        try {
          processRedesigns();
        } catch (ex) {
          console.log("Exception while processing redesigns");
          console.log(ex);
        }
      });
  });
}

export function processCasesBehindLock(client: any): void {
  console.log("Processing cases at " + getCurrentTimeString());

  axios({
    method: "get",
    url: INCOMING_CASES_QUERY,
  }).then((response) => {
    let last_case_ts: number | null = null;
    const caseProcessingPromises: Promise<unknown>[] = [];

    for (const caseDetails of response.data.cases as CaseDetails[]) {
      const folderId = caseDetails.box_folder_id;
      if (!folderId || folderId.length === 0) {
        continue;
      }

      const caseId = caseDetails.case_id;
      const creationTimeMs = caseDetails.creation_time_ms;

      ensureLabFolderExists(caseId, parseInt(creationTimeMs));
      ensureCaseFolderExists(caseId, "IMPORT");
      ensureCaseFolderExists(caseId, "EXPORT - External");
      ensureCaseFolderExists(caseId, "Uploads");

      caseProcessingPromises.push(
        processCase(client, folderId, caseId, caseDetails).catch((err) => {
          console.log({
            err,
            message: `Error processing ${caseId}, will need manual processing`,
          });
        })
      );
      last_case_ts = parseInt(creationTimeMs);
    }

    Promise.all(caseProcessingPromises)
      .then(() => {
        if (last_case_ts != null) {
          axios
            .post(
              CONSTANTS_POST_ENDPOINT,
              qs.stringify({ name: "portal_case_ts_ms", value: last_case_ts })
            )
            .then((data) => {
              console.log({ data: data.data, message: "Update const value" });
              getClient((client: any) => processCases(client));
            });
        } else {
          console.log("No more cases for now, going to sleep for 1 minute");
        }
      })
      .catch((error) => {
        console.log(error);
        console.log("An error occurred, will retry in a minute");
      });
  });
}

export function processCase(
  client: any,
  folderId: string,
  caseId: string,
  caseDetails: CaseDetails
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    try {
      processCaseImpl(client, folderId, caseId, caseDetails, resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

export function processCaseImpl(
  client: any,
  folderId: string,
  caseId: string,
  caseDetails: CaseDetails,
  resolve: (value?: unknown) => void,
  reject: (reason?: unknown) => void
): void {
  const services = (caseDetails.details_json as any)?.services;
  console.log(
    "processCaseImpl called and caseDetails is : ",
    caseId,
    "and",
    caseDetails.details_json
  );

  client.folders
    .getItems(folderId, {
      usermarker: "false",
      fields: "name,id,item_status,type",
      offset: 0,
      limit: 100,
    })
    .then((items: BoxItemsResponse) => {
      const files = items.entries.filter(
        (e) => e.type !== "folder" && e.item_status === "active"
      );
      if (files.length === 0) {
        reject("Could not find files for " + caseId + ".");
        return;
      }

      const fileDownloadPromises = files.map((file) =>
        downloadFile(client, file.id, file.name, caseId, services)
      );

      Promise.allSettled(fileDownloadPromises)
        .then((results) => {
          const hasRejected = results.some(
            (result) => result.status === "rejected"
          );
          if (hasRejected) {
            const rejectedFiles = results.filter(
              (result) => result.status === "rejected"
            );
            console.log(`Error while downloading files for ${caseId}`);
            console.log([caseId, rejectedFiles]);
            resolve(`Resolving ${caseId}, but we could not download the files`);
            return;
          }

          try {
            // generate case PDF
            generateCasePDF(
              caseId,
              caseDetails.details_json as any,
              getFilePath(caseId, "CaseDetails.pdf", "IMPORT")
            );
            const timestamp = Date.now();
            const formatted = getCreationTimeDateString(timestamp);

            const token = caseId.slice(0, 2);

            const patientNames = getPatientFolders(
              `${process.env.ROOT_FOLDER}/${formatted}/${token}/EXPORT - External/${caseId}`
            );

            // send API update (re-added from old function)
            const toLog = {
              case_id: caseId,
              dateFolder: formatted,
              case_file: "Unzipping paused",
              queue_status: "Needs prep work",
              current_allocation: "None",
              patientNames: patientNames,
              case_units: [],
            };
            console.log(`Intentionally not unzipping ${caseId}`);
            console.log(toLog);

            axios
              .post(UPDATING_CASEFILES_AND_CASEUNITS, toLog, {
                headers: { "Content-Type": "application/json" },
              })
              .then((response) => {
                console.log("api triggered");
                console.log(response.data);
                resolve(
                  caseId + " finished downloading and creating caseDetails"
                );
              })
              .catch((err) => {
                console.log("Failed posting to API", err);
                resolve(
                  `Resolving ${caseId} but API post failed: ${err.message}`
                );
              });
          } catch (e) {
            console.log("Failed to generate CaseDetails.pdf for " + caseId);
            resolve([`Resolving ${caseId} with error`, e]);
          }
        })
        .catch((err) => reject(err));
    });
}

export function downloadFile(
  client: any,
  fileId: string,
  fileName: string,
  caseId: string,
  services: any
): Promise<string> {
  console.log(`Downloading ${fileName} (${fileId})`);
  return new Promise((resolve, reject) => {
    client.files.getReadStream(fileId, null, (error: Error, stream: any) => {
      if (error) {
        reject("Box API readstream error for " + caseId);
        return;
      }

      let exportFolderPath: string | null = null;

      if (!services || Object.keys(services).length === 0) {
        // Base export folder
        const folderPath = getFilePath(caseId, fileName, "EXPORT - External");

        // If the file is a ZIP, create a subfolder `${caseId} -- ${basename}`
        if (path.extname(fileName).toLowerCase() === ".zip") {
          const baseName = path.basename(fileName, ".zip");
          exportFolderPath = path.join(
            path.dirname(folderPath),
            `${caseId.slice(0, 7)} -- ${baseName}`
          );
          if (!fs.existsSync(exportFolderPath)) {
            fs.mkdirSync(exportFolderPath, { recursive: true });
          }
        }
      }

      // Always save the file into IMPORT folder
      const filePath = getFilePath(caseId, fileName, "IMPORT");
      const dest = fs.createWriteStream(filePath);

      stream
        .on("end", async () => {
          console.log(`Downloaded file - ${caseId} ${fileName}`);

          // If no services + ZIP, extract inside IMPORT
          if (
            (!services || Object.keys(services).length === 0) &&
            path.extname(fileName).toLowerCase() === ".zip"
          ) {
            try {
              const importDir = path.dirname(filePath);
              console.log(`Extracting ZIP into ${importDir}`);
              await fs
                .createReadStream(filePath)
                .pipe(unzipper.Extract({ path: importDir }))
                .promise();
              console.log(`Extraction complete for ${fileName}`);
            } catch (extractErr) {
              console.error("Error extracting zip:", extractErr);
              reject(extractErr);
              return;
            }
          }

          resolve(filePath);
        })
        .on("error", (err: Error) => {
          console.error(`Error downloading file - ${caseId} ${fileName}`);
          reject(err);
        })
        .pipe(dest);
    });
  });
}

//      !@!@!@!@!@!!@           unused functions            @!@!@!@!@!@!@

// export function getUnitProperty(
//   unit: UnitElement,
//   propertyName: string
// ): string {
//   return unit.elements!.filter((p) => p.attributes.name === propertyName)[0]
//     .attributes.value;
// }

// export function unzipCaseFiles(
//   filePath: string,
//   fileName: string,
//   caseId: string
// ): Promise<unknown> {
//   return new Promise((resolve, reject) => {
//     try {
//       console.log(`Unzipping ${filePath}`);
//       const fileNameWithoutExtension = fileName
//         .split(".")
//         .slice(0, -1)
//         .join(".");
//       const outputPath = filePath.split("/").slice(0, -1).join("/");

//       fs.createReadStream(filePath)
//         .pipe(
//           unzipper
//             .Extract({ path: outputPath })
//             .on("error", () => reject("Unzip parse error for " + caseId))
//         )
//         .on("close", () =>
//           fs.readdir(outputPath, (err, files) => {
//             if (err) {
//               reject({ err, filePath, fileName, caseId });
//               return;
//             }
//             const unzippedName = files.filter((f) =>
//               fileNameWithoutExtension.includes(f)
//             )[0];

//             fs.readFile(
//               `${outputPath}/${unzippedName}/${unzippedName}.xml`,
//               "utf-8",
//               (err, fileContent) => {
//                 try {
//                   const json = xml_to_json.xml2json(fileContent, {
//                     compact: false,
//                     spaces: 4,
//                   });

//                   const teethUnits = JSON.parse(
//                     json
//                   ).elements[0].elements[0].elements.filter(
//                     (e: any) => e.attributes.name === "ToothElementList"
//                   )[0].elements[0].elements;

//                   let case_units: CaseUnit[];
//                   if (!teethUnits) {
//                     case_units = [
//                       {
//                         tooth_number: 0,
//                         abutment_kit_id: null,
//                         anatomical: false,
//                         post_and_core: false,
//                         cache_tooth_type_class: "",
//                         unit_type: "Digital Model",
//                       },
//                     ];
//                   } else {
//                     case_units = teethUnits.map((unit: UnitElement) => ({
//                       tooth_number: parseInt(
//                         getUnitProperty(unit, "ToothNumber")
//                       ),
//                       abutment_kit_id: getUnitProperty(unit, "AbutmentKitID"),
//                       anatomical:
//                         getUnitProperty(unit, "Anatomical") !== "False",
//                       post_and_core:
//                         getUnitProperty(unit, "PostAndCore") !== "False",
//                       cache_tooth_type_class: getUnitProperty(
//                         unit,
//                         "CacheToothTypeClass"
//                       ),
//                       unit_type: "Tooth",
//                     }));
//                   }

//                   resolve({
//                     case_id: caseId,
//                     case_file: fileNameWithoutExtension,
//                     queue_status: "Ready for design",
//                     current_allocation: "None",
//                     case_units,
//                   });
//                 } catch (err) {
//                   reject(err);
//                 }
//               }
//             );
//           })
//         );
//     } catch (err) {
//       reject(err);
//     }
//   });
// }

//       @#@#@#@#@#@#     old code        #@#@#@#@#@#@#@

// import fs from "fs";
// import unzipper from "unzipper";
// import axios from "axios";
// import qs from "qs";
// import xml_to_json from "xml-js";
// import { getCurrentTimeString } from "./ts_datetime.js";
// import {
//   INCOMING_CASES_QUERY,
//   CONSTANTS_POST_ENDPOINT,
//   CONSTANTS_GET_ENDPOINT,
// } from "./ts_constants.js";
// import {
//   ensureLabFolderExists,
//   ensureCaseFolderExists,
//   getFilePath,
// } from "./ts_folder_structure.js";
// import { generateCasePDF } from "./ts_case_details_pdf.js";
// import { processRedesigns } from "./ts_portal_redesigns_downloader.js";
// import { getClient } from "../../config/box.js";

// export function processCases(client) {
//   axios({
//     method: "get",
//     url: CONSTANTS_GET_ENDPOINT + "case_downloader_mutex_ts",
//   }).then((response) => {
//     if (response.data["name"] !== "case_downloader_mutex_ts") {
//       return;
//     }

//     let now = Math.round(new Date().getTime() / 1000);
//     let prev = parseInt(response.data["value"]);
//     if (prev + 4 * 60 > now) {
//       console.log("Its already running!");
//       return;
//     }

//     axios
//       .post(
//         CONSTANTS_POST_ENDPOINT,
//         qs.stringify({ name: "case_downloader_mutex_ts", value: now })
//       )
//       .then((data) => {
//         console.log({ data: data.data, message: "Update mutex value" });
//         processCasesBehindLock(client);
//         try {
//           processRedesigns();
//         } catch (ex) {
//           console.log("Exception while processing redesigns");
//           console.log(ex);
//         }
//       });
//   });
// }

// export function processCasesBehindLock(client) {
//   console.log("Processing cases at " + getCurrentTimeString());

//   axios({
//     method: "get",
//     url: INCOMING_CASES_QUERY,
//   }).then((response) => {
//     let last_case_ts = null;
//     let caseProcessingPromises = [];
//     for (let caseDetails of response.data.cases) {
//       let folderId = caseDetails.box_folder_id;
//       if (folderId.length === 0) {
//         continue;
//       }

//       let caseId = caseDetails["case_id"];

//       let creationTimeMs = caseDetails["creation_time_ms"];

//       ensureLabFolderExists(caseId, creationTimeMs);
//       ensureCaseFolderExists(caseId, "IMPORT");
//       ensureCaseFolderExists(caseId, "EXPORT - External");
//       ensureCaseFolderExists(caseId, "Uploads");

//       // Needs to be a promise all
//       caseProcessingPromises.push(
//         processCase(client, folderId, caseId, caseDetails).catch((err) => {
//           console.log({
//             err,
//             message: `Error processing ${caseId}, will need manual processing`,
//           });
//         })
//       );
//       last_case_ts = parseInt(creationTimeMs);
//     }

//     Promise.all(caseProcessingPromises)
//       .then((resolutions) => {
//         if (last_case_ts != null) {
//           axios
//             .post(
//               CONSTANTS_POST_ENDPOINT,
//               qs.stringify({ name: "portal_case_ts_ms", value: last_case_ts })
//             )
//             .then((data) => {
//               console.log({ data: data.data, message: "Update const value" });
//               getClient((client) => processCases(client));
//             });
//         } else {
//           console.log("No more cases for now, going to sleep for 1 minute");
//         }
//       })
//       .catch((error) => {
//         console.log(error);
//         console.log("An error occurred, will retry in a minute");
//       });
//   });
// }

// /**
//  * Lists the names and IDs of up to 10 files.
//  * @param client Box API client.
//  */
// export function processCase(client, folderId, caseId, caseDetails) {
//   return new Promise((resolve, reject) => {
//     try {
//       processCaseImpl(client, folderId, caseId, caseDetails, resolve, reject);
//     } catch (err) {
//       reject(err);
//     }
//   });
// }

// export function processCaseImpl(
//   client,
//   folderId,
//   caseId,
//   caseDetails,
//   resolve,
//   reject
// ) {
//   let services = JSON.parse(caseDetails.details_json).services;
//   console.log("processCaseImpl called and caseDetails is : ", caseDetails);
//   let hasFilledOrderForm =
//     Object.keys(services).filter((s) =>
//       [
//         "crownAndBridge",
//         "implant",
//         "smileDesign",
//         "surgicalGuide",
//         "digital-model",
//         "complete-denture",
//       ].includes(s)
//     ).length === 0;

//   client.folders
//     .getItems(folderId, {
//       usermarker: "false",
//       fields: "name,id,item_status,type",
//       offset: 0,
//       limit: 100,
//     })
//     .then((items) => {
//       console.log("inside function line 153");
//       let files = items.entries.filter(
//         (e) => e.type != "folder" && e.item_status == "active"
//       );
//       if (files.length == 0) {
//         reject("Could not find files for " + caseId + ".");
//         return;
//       }

//       // If a case has not filled any details in our portal form,
//       // they must have a filled order form and should only have uploaded
//       // zip files.

//       let fileDownloadPromises = files.map((file) => {
//         return downloadFile(client, file.id, file.name, caseId);
//       });
//       Promise.allSettled(fileDownloadPromises)
//         .then((results) => {
//           const hasRejected = results.some(
//             (result) => result.status === "rejected"
//           );
//           if (hasRejected) {
//             const rejectedFiles = results.filter(
//               (result) => result.status === "rejected"
//             );
//             console.log(`Error while downloading files for ${caseId}`);
//             console.log([caseId, rejectedFiles]);
//             resolve(`Resolving ${caseId}, but we could not download the files`);
//             return;
//           }
//           try {
//             generateCasePDF(
//               caseId,
//               JSON.parse(caseDetails.details_json),
//               getFilePath(caseId, "CaseDetails.pdf", "IMPORT")
//             );
//             let toLog = {
//               case_id: caseId,
//               case_file: "Unzipping paused",
//               queue_status: "Needs prep work",
//               current_allocation: "None",
//               case_units: [],
//             };
//             console.log(`Intentionally not unzipping ${caseId}`);
//             console.log(toLog, "asddd");
//             const response = axios
//               .post(UPDATING_CASEFILES_AND_CASEUNITS, toLog, {
//                 headers: { "Content-Type": "application/json" },
//               })
//               .then((response) => {
//                 console.log("api triggered");
//                 console.log(response.data);
//                 resolve(
//                   caseId + " finished downloading and creating caseDetails"
//                 );
//               });
//           } catch (e) {
//             console.log("Failed to generate CaseDetails.pdf for " + caseId);
//             resolve([`Resolving ${caseId} with eror`, e]);
//           }
//           return;
//         })
//         .catch((err) => reject(err));
//     });
// }

// export function downloadFile(client, fileId, fileName, caseId) {
//   console.log(`Downloading ${fileName} (${fileId})`);
//   return new Promise((resolve, reject) => {
//     client.files.getReadStream(fileId, null, (error, stream) => {
//       if (error) {
//         reject("Box API readstream error for " + caseId);
//         return;
//       }

//       let filePath = getFilePath(caseId, fileName, "IMPORT");
//       const dest = fs.createWriteStream(filePath);

//       stream
//         .on("end", () => {
//           console.log(`Done downloading file - ${caseId} ${fileName}`);
//           resolve(filePath);
//         })
//         .on("error", (err) => {
//           console.error(`Error downloading file - ${caseId} ${fileName}`);
//           reject(err);
//         })
//         .pipe(dest);
//     });
//   });
// }

// export function getUnitProperty(unit, propertyName) {
//   return unit.elements.filter((p) => p.attributes.name === propertyName)[0]
//     .attributes.value;
// }

// export function unzipCaseFiles(filePath, fileName, caseId) {
//   return new Promise((resolve, reject) => {
//     try {
//       console.log(`Unzipping ${filePath}`);
//       let fileNameWithoutExtension = fileName.split(".").slice(0, -1).join(".");
//       let outputPath = filePath.split("/").slice(0, -1).join("/");
//       // fs.mkdirSync(outputPath);
//       fs.createReadStream(filePath)
//         .pipe(
//           unzipper
//             .Extract({ path: outputPath })
//             .on("error", (err) => reject("Unzip parse error for " + caseId))
//         )
//         .on("close", (_) =>
//           fs.readdir(outputPath, (err, files) => {
//             if (err) {
//               reject({ err, filePath, fileName, caseId });
//               return;
//             }
//             let unzippedName = files.filter((f) =>
//               fileNameWithoutExtension.includes(f)
//             )[0];
//             // console.log({unzippedName, fileNameWithoutExtension, files});
//             fs.readFile(
//               outputPath + "/" + unzippedName + "/" + unzippedName + ".xml",
//               "utf-8",
//               (err, fileContent) => {
//                 try {
//                   let json = xml_to_json.xml2json(fileContent, {
//                     compact: false,
//                     spaces: 4,
//                   });

//                   let teethUnits = JSON.parse(
//                     json
//                   ).elements[0].elements[0].elements.filter(
//                     (e) => e.attributes.name === "ToothElementList"
//                   )[0].elements[0].elements;
//                   let case_units;
//                   if (!teethUnits) {
//                     case_units = [
//                       {
//                         tooth_number: 0,
//                         abutment_kit_id: null,
//                         anatomical: false,
//                         post_and_core: false,
//                         cache_tooth_type_class: "",
//                         unit_type: "Digital Model",
//                       },
//                     ];
//                   } else {
//                     case_units = teethUnits.map((unit) => ({
//                       tooth_number: getUnitProperty(unit, "ToothNumber"),
//                       abutment_kit_id: getUnitProperty(unit, "AbutmentKitID"),
//                       anatomical:
//                         getUnitProperty(unit, "Anatomical") !== "False",
//                       post_and_core:
//                         getUnitProperty(unit, "PostAndCore") !== "False",
//                       cache_tooth_type_class: getUnitProperty(
//                         unit,
//                         "CacheToothTypeClass"
//                       ),
//                       unit_type: "Tooth",
//                     }));
//                   }
//                   let toLog = {
//                     case_id: caseId,
//                     case_file: fileNameWithoutExtension,
//                     queue_status: "Ready for design",
//                     current_allocation: "None",
//                     case_units,
//                   };
//                   console.log(toLog);
//                   axios
//                     .post(UPDATING_CASEFILES_AND_CASEUNITS, qs.stringify(toLog))
//                     .then((response) => {
//                       resolve(response.data);
//                     });
//                 } catch (err) {
//                   reject(err);
//                 }
//               }
//             );
//           })
//         );
//     } catch (err) {
//       reject(err);
//     }
//   }).catch((err) => {
//     console.log({ err, caseId, filePath, fileName });
//     axios.post(
//       UPDATING_CASEFILES_AND_CASEUNITS,
//       qs.stringify({
//         case_id: caseId,
//         case_file: "An error occurred, check all files for case",
//         queue_status: "Needs prep work",
//         current_allocation: "None",
//         case_units: [],
//       })
//     );
//   });
// }
