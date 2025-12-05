import fs from "fs";
import axios from "axios";
import qs from "qs";
import { pipeline } from "stream/promises";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);
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
    if (prev + 10 * 60 > now) {
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
          // console.log("Redesigns call");
        } catch (ex) {
          console.log("Exception while processing redesigns");
          console.log(ex);
        }
      });
  });
}

function sanitizeCaseId(raw: string) {
  if (!raw) return "";

  return (
    raw
      // Convert to string
      .toString()

      // Remove tabs, newlines, carriage returns, non-breaking spaces, zero-width chars
      .replace(/[\t\r\n\u00A0\u200B\u200C\u200D\u2060]+/g, "")

      // Remove characters illegal on Windows file systems
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")

      // Remove trailing dot (Windows does not allow folder ending with '.')
      .replace(/\.+$/, "")

      // Trim *all* leading/trailing spaces (removes harmful trailing spaces)
      .trim()

      // Collapse multiple internal spaces into one (optional but safer)
      .replace(/\s{2,}/g, " ")
  );
}

export async function processCasesBehindLock(client: any): Promise<void> {
  console.log("Processing cases at " + getCurrentTimeString());

  try {
    const response = await axios({
      method: "get",
      url: INCOMING_CASES_QUERY,
    });

    const cases: CaseDetails[] = response.data.cases;
    if (!cases || cases.length === 0) {
      console.log("No cases found, sleeping 1 minute...");
      return;
    }

    let last_case_ts: number | null = null;

    // --------------------------------
    // 🔥 PROCESS EACH CASE SEQUENTIALLY
    // --------------------------------
    for (const caseDetails of cases) {
      const folderId = caseDetails.box_folder_id;
      if (!folderId) continue;

      console.log("caseDetails caseid : ", caseDetails.case_id);

      const rawCaseId = caseDetails.case_id;
      const caseId = sanitizeCaseId(rawCaseId);
      const creationTimeMs = caseDetails.creation_time_ms;

      await ensureLabFolderExists(caseId, parseInt(creationTimeMs));
      await ensureCaseFolderExists(caseId, "IMPORT");
      await ensureCaseFolderExists(caseId, "EXPORT - External");
      await ensureCaseFolderExists(caseId, "Uploads");

      console.log("\n==============================");
      console.log(`🚀 START CASE → ${caseId}`);
      console.log("==============================\n");

      try {
        await processCase(client, folderId, caseId, caseDetails);
        console.log(`✅ Case completed → ${caseId}`);
      } catch (err) {
        console.log(`❌ Error in case ${caseId}, skipping to next`);
        console.log(err);
      }

      last_case_ts = parseInt(creationTimeMs);
    }

    // --------------------------------
    // 🔥 Update timestamp AFTER finishing all cases
    // --------------------------------
    if (last_case_ts != null) {
      await axios.post(
        CONSTANTS_POST_ENDPOINT,
        qs.stringify({
          name: "portal_case_ts_ms",
          value: last_case_ts,
        })
      );

      console.log("⏳ Timestamp updated, restarting cycle...");
      getClient((client: any) => processCases(client));
    }
  } catch (error) {
    console.log("❌ Error in processCasesBehindLock:", error);
  }
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
    .then(async (items: BoxItemsResponse) => {
      const files = items.entries.filter(
        (e) => e.type !== "folder" && e.item_status === "active"
      );

      if (files.length === 0) {
        reject("Could not find files for " + caseId + ".");
        return;
      }

      // ------------------------------------------------
      // ⚡ DOWNLOAD: Parallel async tasks
      // ------------------------------------------------
      // const downloadTasks = files.map((file) =>
      //   downloadFile(client, file.id, file.name, caseId)
      // );

      const downloadTasks = files.map((file) => {
        return () => downloadFile(client, file.id, file.name, caseId);
      });

      await promisePool(downloadTasks,4);

      // ------------------------------------------------
      // ⚡ PDF GENERATION: Also async and runs parallel
      // ------------------------------------------------
      const pdfTask = generateCasePDF(
        caseId,
        caseDetails.details_json as any,
        getFilePath(caseId, "CaseDetails.pdf", "IMPORT")
      );

      // ------------------------------------------------
      // ⚡ WAIT FOR BOTH GROUPS → Downloads + PDF
      // ------------------------------------------------
      const [downloadResults, pdfResult] = await Promise.allSettled([
        Promise.allSettled(downloadTasks),
        pdfTask,
      ]);

      // ------------------------------------------------
      // ✔ DOWNLOAD FAILURE CHECK
      // ------------------------------------------------
      if (downloadResults.status === "fulfilled") {
        console.log(downloadResults.value); // real results!
      } else {
        console.log("❌ Inner downloads crashed:", downloadResults.reason);
      }

      // ------------------------------------------------
      // ✔ PDF FAILURE CHECK
      // ------------------------------------------------
      if (pdfResult.status === "rejected") {
        console.log(`⚠ PDF generation failed for ${caseId}`);
        console.log(pdfResult.reason);
      }

      // ------------------------------------------------
      // 🔥 Continue with case update (ALWAYS)
      // ------------------------------------------------

      try {
        const timestamp = Date.now();
        const formatted = getCreationTimeDateString(timestamp);

        const payload = {
          case_id: caseId,
          dateFolder: formatted,
          case_file: "Unzipping paused",
          queue_status: "Needs prep work",
          current_allocation: "None",
          patientNames: "test",
          case_units: [],
        };

        await axios.post(UPDATING_CASEFILES_AND_CASEUNITS, payload);

        // 🔥 update timestamp immediately
        await axios.post(
          CONSTANTS_POST_ENDPOINT,
          qs.stringify({
            name: "portal_case_ts_ms",
            value: caseDetails.creation_time_ms,
          })
        );

        resolve(`${caseId} finished (downloads + PDF parallel)`);
      } catch (err: any) {
        console.log("Failed posting to API", err);
        resolve(`Finished ${caseId} but API failed: ${err.message}`);
      }
    })
    .catch((err: any) => reject(err));
}

export async function downloadFile(
  client: any,
  fileId: string,
  fileName: string,
  caseId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    client.files.getReadStream(
      fileId,
      null,
      async (error: Error | null, stream: NodeJS.ReadableStream | null) => {
        if (error || !stream) {
          console.log(`❌ Stream error for file ${fileName}`);
          return reject(error || new Error("Stream empty"));
        }

        try {
          const filePath: string = getFilePath(caseId, fileName, "IMPORT");
          const dest: fs.WriteStream = fs.createWriteStream(filePath);

          // Proper backpressure + clean finishing
          await pipeline(stream, dest);

          console.log(`✅For case : ${caseId} file downloaded → ${fileName}`);
          resolve(filePath);
        } catch (err) {
          console.error(`❌ Failed → ${fileName}`, err);
          reject(err);
        }
      }
    );
  });
}

async function promisePool(tasks: (() => Promise<any>)[], concurrency: number) {
  const results: any[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++; // pick next task
      try {
        results[currentIndex] = await tasks[currentIndex]();
      } catch (err) {
        results[currentIndex] = Promise.reject(err);
      }
    }
  }

  // Start N workers
  const workers = Array.from({ length: concurrency }, () => worker());

  await Promise.all(workers);
  return results;
}
