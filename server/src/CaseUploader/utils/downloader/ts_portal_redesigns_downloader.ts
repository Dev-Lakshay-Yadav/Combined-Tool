import axios from "axios";
import fs from "fs";
import path from "path";

interface CaseDetailsJson {
  services?: any[];
  [key: string]: any;
}

import {
  INCOMING_REDESIGNS_QUERY,
  UPDATE_REDESIGN_STATUS_ENDPOINT,
} from "./ts_constants.js";
import {
  ensureRedesignFolderExists,
  getRedesignFolderPath,
} from "./ts_folder_structure.js";
import { generateCasePDF, generateCommentsPDF } from "./ts_case_details_pdf.js";

import { getClient } from "../../config/box.js";
import { getCreationTimeDateString } from "./ts_datetime.js";
import { getPatientFolders } from "../watchLogic.js";

// ---- Types ----
interface CaseDetails {
  priority: string;
  case_id: string;
  creation_time_ms: number;
  redesign_attempt: number;
  box_folder_id: string;
  details_json: JSON;
  case_activities: string;
  casePriority?: string;
  clientUploads?: string;
  adminUploads?: string;
}

interface BoxItem {
  id: string;
  type: "file" | "folder";
  name: string;
}

interface BoxClient {
  folders: {
    getItems(
      folderId: string,
      options?: { fields?: string }
    ): Promise<{ entries: BoxItem[] }>;
  };
  files: {
    getReadStream(fileId: string): Promise<NodeJS.ReadableStream>;
  };
}

export function processRedesigns(): void {
  console.log("Starting to process redesigns");

  axios<{ cases: CaseDetails[] }>({
    method: "get",
    url: INCOMING_REDESIGNS_QUERY,
  }).then(async (response) => {
    getClient(async (client: BoxClient) => {
      for (const caseDetails of response.data.cases) {
        console.log("Processing redesign case: ", caseDetails.case_id);

        const priority = caseDetails.priority.toUpperCase();
        const creationTimeMs = caseDetails.creation_time_ms;

        const rdCaseId = `RD-${caseDetails.redesign_attempt}-${caseDetails.case_id}-${priority}`;
        ensureRedesignFolderExists(rdCaseId, creationTimeMs);

        // --- Parse upload names ---
        const clientUploads = caseDetails.clientUploads
          ? caseDetails.clientUploads.split(",").map((s) => s.trim())
          : [];
        const adminUploads = caseDetails.adminUploads
          ? caseDetails.adminUploads.split(",").map((s) => s.trim())
          : [];

        const boxFolderId = caseDetails.box_folder_id;

        // --- Process Box folder selectively ---
        await processSelectiveFolder(
          client,
          boxFolderId,
          getRedesignFolderPath(rdCaseId),
          clientUploads,
          adminUploads
        );

        // --- Generate PDFs ---
        const detailsJson = caseDetails.details_json as any;
        detailsJson.casePriority = `[REDESIGN PRIORITY] ${priority}`;

        try {
          generateCasePDF(
            caseDetails.case_id,
            detailsJson,
            path.join(getRedesignFolderPath(rdCaseId), "CaseDetails.pdf")
          );
        } catch {
          console.log("Failed to generate CaseDetails.pdf for " + rdCaseId);
        }

        try {
          generateCommentsPDF(
            caseDetails.case_id,
            JSON.parse(caseDetails.case_activities),
            priority,
            path.join(getRedesignFolderPath(rdCaseId), "Comments.pdf")
          );
        } catch (e) {
          console.log("Failed to generate Comments.pdf for " + rdCaseId, e);
        }

        console.log(
          `✅ Completed redesign processing for ${caseDetails.case_id}`
        );

        const timestamp = Date.now();
        const formatted = getCreationTimeDateString(timestamp);

        // --- Update redesign status ---
        axios
          .post(
            UPDATE_REDESIGN_STATUS_ENDPOINT,
            {
              case_id: caseDetails.case_id.split(" -- ")[0],
              status: "downloaded",
              redesign_attempt: caseDetails?.redesign_attempt,
              dateFolder: formatted,
            },
            { headers: { "Content-Type": "application/json" } }
          )
          .then((res) => console.log("Updated redesign:", res.data))
          .catch((err) => console.log("Failed to update status", err.message));
      }
    });
  });
}

export async function processSelectiveFolder(
  client: BoxClient,
  folderId: string,
  downloadPath: string,
  clientUploads: string[],
  adminUploads: string[]
): Promise<void> {
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  // Ensure a top-level TS_Uploads folder exists inside the case folder
  const tsUploadsRoot = path.join(downloadPath, "TS_Uploads");
  if (!fs.existsSync(tsUploadsRoot)) {
    fs.mkdirSync(tsUploadsRoot, { recursive: true });
    console.log(`📂 Created top-level TS_Uploads at ${tsUploadsRoot}`);
  }

  // Fetch the top-level items in the case folder (e.g., TL00002/)
  const items = await client.folders.getItems(folderId, {
    fields: "id,type,name",
  });

  for (const item of items.entries) {
    const itemName = item.name.trim();

    // Case 1: Client uploads (files in root of case folder)
    if (item.type === "file" && clientUploads.includes(itemName)) {
      // Put client uploads directly in the case root (or optionally create Client_Uploads)
      console.log(`⬇️ Downloading client upload file: ${itemName}`);
      await downloadFile(client, item.id, itemName, downloadPath);
    }

    // Case 2: TS_Uploads folder in Box — inside it are admin upload folders
    else if (item.type === "folder" && itemName === "TS_Uploads") {
      console.log(`🔍 Entering TS_Uploads folder on Box...`);

      const tsItems = await client.folders.getItems(item.id, {
        fields: "id,type,name",
      });

      for (const tsItem of tsItems.entries) {
        const tsName = tsItem.name.trim();

        // For admin upload folders that match adminUploads list:
        // create a folder inside our local top-level TS_Uploads and download there.
        if (tsItem.type === "folder" && adminUploads.includes(tsName)) {
          console.log(`📁 Found matching admin upload folder: ${tsName}`);

          // Create /RD-.../TS_Uploads/<AdminFolder>
          const adminPath = path.join(tsUploadsRoot, tsName);
          if (!fs.existsSync(adminPath)) {
            fs.mkdirSync(adminPath, { recursive: true });
            console.log(`📂 Created folder: ${adminPath}`);
          }

          await processFolder(client, tsItem.id, adminPath);
        } else {
          console.log(`⏭️ Skipping non-matching item in TS_Uploads: ${tsName}`);
        }
      }
    }

    // Skip everything else
    else {
      console.log(`⏭️ Skipping unrelated item: ${itemName}`);
    }
  }
}

export async function processFolder(
  client: BoxClient,
  folderId: string,
  downloadPath: string
): Promise<void> {
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  const items = await client.folders.getItems(folderId, {
    fields: "id,type,name",
  });

  for (const item of items.entries) {
    if (item.type === "file") {
      console.log(`Downloading Redesign file: ${item.name}`);
      await downloadFile(client, item.id, item.name, downloadPath);
    } else if (item.type === "folder") {
      console.log(`Entering folder: ${item.name}`);
      await processFolder(client, item.id, path.join(downloadPath, item.name));
    }
  }
}

export async function downloadFile(
  client: BoxClient,
  fileId: string,
  fileName: string,
  downloadPath: string
): Promise<void> {
  const stream = await client.files.getReadStream(fileId);
  const filePath = path.join(downloadPath, fileName);
  const writeStream = fs.createWriteStream(filePath);
  stream.pipe(writeStream);

  return new Promise((resolve, reject) => {
    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err) => reject(err));
  });
}

// downloads all redesign files

// import axios from "axios";
// import fs from "fs";
// import path from "path";

// import {
//   INCOMING_REDESIGNS_QUERY,
//   UPDATE_REDESIGN_STATUS_ENDPOINT,
// } from "./ts_constants.js";
// import {
//   ensureRedesignFolderExists,
//   getRedesignFolderPath,
// } from "./ts_folder_structure.js";
// import { generateCasePDF, generateCommentsPDF } from "./ts_case_details_pdf.js";

// import { getClient } from "../../config/box.js";

// // ---- Types ----
// interface CaseDetails {
//   priority: string;
//   case_id: string;
//   creation_time_ms: number;
//   redesign_attempt: number;
//   box_folder_id: string;
//   details_json: string;
//   case_activities: string;
//   casePriority?: string;
// }

// interface BoxItem {
//   id: string;
//   type: "file" | "folder";
//   name: string;
// }

// interface BoxClient {
//   folders: {
//     getItems(
//       folderId: string,
//       options?: { fields?: string }
//     ): Promise<{ entries: BoxItem[] }>;
//   };
//   files: {
//     getReadStream(fileId: string): Promise<NodeJS.ReadableStream>;
//   };
// }

// export function processRedesigns(): void {
//   console.log("Starting to process redesigns");

//   axios<{ cases: CaseDetails[] }>({
//     method: "get",
//     url: INCOMING_REDESIGNS_QUERY,
//   }).then(async (response) => {
//     getClient(async (client: BoxClient) => {

//       for (const caseDetails of response.data.cases) {
//         console.log("redesign case data : ",caseDetails)
//         const priority = caseDetails.priority.toUpperCase();
//         caseDetails.casePriority = priority.toUpperCase();
//         const creationTimeMs = caseDetails.creation_time_ms;

//         const rdCaseId = `RD-${caseDetails.redesign_attempt}-${caseDetails.case_id}-${priority}`;
//         ensureRedesignFolderExists(rdCaseId, creationTimeMs);

//         const boxFolderId = caseDetails.box_folder_id;
//         await processFolder(
//           client,
//           boxFolderId,
//           getRedesignFolderPath(rdCaseId)
//         );

//         const detailsJson = JSON.parse(caseDetails.details_json);
//         detailsJson.casePriority = `[REDESIGN PRIORITY] ${priority}`;

//         try {
//           generateCasePDF(
//             caseDetails.case_id,
//             detailsJson,
//             path.join(getRedesignFolderPath(rdCaseId), "CaseDetails.pdf")
//           );
//         } catch (e: unknown) {
//           console.log("Failed to generate CaseDetails.pdf for " + rdCaseId);
//         }

//         try {
//           generateCommentsPDF(
//             caseDetails.case_id,
//             JSON.parse(caseDetails.case_activities),
//             priority,
//             path.join(getRedesignFolderPath(rdCaseId), "Comments.pdf")
//           );
//         } catch (e: unknown) {
//           console.log(e);
//           console.log("Failed to generate Comments.pdf for " + rdCaseId);
//         }

//         console.log(`Completed redesign processing for ${caseDetails.case_id}`);

//         axios
//           .post(
//             UPDATE_REDESIGN_STATUS_ENDPOINT,
//             {
//               case_id: caseDetails.case_id.split(" -- ")[0],
//               status: "downloaded",
//               redesign_attempt : caseDetails?.redesign_attempt
//             },
//             { headers: { "Content-Type": "application/json" } }
//           )
//           .then((res) => {
//             console.log(res.data);
//             console.log(`Updated status for ${caseDetails.case_id}`);
//           });
//       }
//     });
//   });
// }

// export async function processFolder(
//   client: BoxClient,
//   folderId: string,
//   downloadPath: string
// ): Promise<void> {
//   if (!fs.existsSync(downloadPath)) {
//     fs.mkdirSync(downloadPath, { recursive: true });
//   }

//   const items = await client.folders.getItems(folderId, {
//     fields: "id,type,name",
//   });

//   for (const item of items.entries) {
//     if (item.type === "file") {
//       console.log(`Downloading Redesign file: ${item.name}`);
//       await downloadFile(client, item.id, item.name, downloadPath);
//     } else if (item.type === "folder") {
//       console.log(`Entering folder: ${item.name}`);
//       await processFolder(client, item.id, path.join(downloadPath, item.name));
//     }
//   }
// }

// export async function downloadFile(
//   client: BoxClient,
//   fileId: string,
//   fileName: string,
//   downloadPath: string
// ): Promise<void> {
//   const stream = await client.files.getReadStream(fileId);
//   const filePath = path.join(downloadPath, fileName);
//   const writeStream = fs.createWriteStream(filePath);
//   stream.pipe(writeStream);

//   return new Promise((resolve, reject) => {
//     writeStream.on("finish", () => resolve());
//     writeStream.on("error", (err) => reject(err));
//   });
// }

// import axios from "axios";
// import fs from "fs";
// import path from "path";

// import {
//   INCOMING_REDESIGNS_QUERY,
//   UPDATE_REDESIGN_STATUS_ENDPOINT,
// } from "./ts_constants.js";
// import {
//   ensureRedesignFolderExists,
//   getRedesignFolderPath,
// } from "./ts_folder_structure.js";
// import { generateCasePDF, generateCommentsPDF } from "./ts_case_details_pdf.js";

// import { getClient } from "../../config/box.js";

// export function processRedesigns() {
//   console.log("Starting to process redesigns");
//   axios({
//     method: "get",
//     url: INCOMING_REDESIGNS_QUERY,
//   }).then(async (response) => {
//     getClient(async (client) => {
//       for (let caseDetails of response.data.cases) {
//         const priority = caseDetails["priority"].toUpperCase();
//         caseDetails["casePriority"] = priority.toUpperCase();
//         let creationTimeMs = caseDetails["creation_time_ms"];
//         const rdCaseId = `RD-${caseDetails["redesign_attempt"]}-${caseDetails["case_id"]}-${priority}`;
//         ensureRedesignFolderExists(rdCaseId, creationTimeMs);
//         const boxFolderId = caseDetails["box_folder_id"];
//         await processFolder(
//           client,
//           boxFolderId,
//           getRedesignFolderPath(rdCaseId)
//         );
//         const detailsJson = JSON.parse(caseDetails.details_json);
//         detailsJson["casePriority"] = `[REDESIGN PRIORITY] ${priority}`;
//         try {
//           generateCasePDF(
//             caseDetails["case_id"],
//             detailsJson,
//             path.join(getRedesignFolderPath(rdCaseId), "CaseDetails.pdf")
//           );
//         } catch (e) {
//           console.log("Failed to generate CaseDetails.pdf for " + rdCaseId);
//         }
//         try {
//           generateCommentsPDF(
//             caseDetails["case_id"],
//             JSON.parse(JSON.parse(caseDetails.case_activities)),
//             priority,
//             path.join(getRedesignFolderPath(rdCaseId), "Comments.pdf")
//           );
//         } catch (e) {
//           console.log(e);
//           console.log("Failed to generate Comments.pdf for " + rdCaseId);
//         }
//         console.log(
//           `Completed redesign processing for ${caseDetails["case_id"]}`
//         );
//         const response = axios
//           .post(
//             UPDATE_REDESIGN_STATUS_ENDPOINT,
//             {
//               case_id: caseDetails["case_id"].split(" -- ")[0],
//               status: "downloaded",
//             },
//             { headers: { "Content-Type": "application/json" } }
//           )
//           .then((response) => {
//             console.log(response.data);
//             console.log(`Updated status for ${caseDetails["case_id"]}`);
//           });
//       }
//     });
//   });
// }

// export async function processFolder(client, folderId, downloadPath) {
//   if (!fs.existsSync(downloadPath)) {
//     fs.mkdirSync(downloadPath, { recursive: true });
//   }

//   const items = await client.folders.getItems(folderId, {
//     fields: "id,type,name",
//   });

//   for (const item of items.entries) {
//     if (item.type === "file") {
//       console.log(`Downloading file: ${item.name}`);
//       await downloadFile(client, item.id, item.name, downloadPath);
//     } else if (item.type === "folder") {
//       console.log(`Entering folder: ${item.name}`);
//       await processFolder(client, item.id, path.join(downloadPath, item.name));
//     }
//   }
// }

// export async function downloadFile(client, fileId, fileName, downloadPath) {
//   const stream = await client.files.getReadStream(fileId);
//   const filePath = path.join(downloadPath, fileName);
//   const writeStream = fs.createWriteStream(filePath);
//   stream.pipe(writeStream);

//   return new Promise((resolve, reject) => {
//     writeStream.on("finish", resolve);
//     writeStream.on("error", reject);
//   });
// }
