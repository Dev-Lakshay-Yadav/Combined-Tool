import { Request, Response } from "express";
import axios from "axios";
import { handleBoxUpload } from "../utils/fileUpload.js";
import path from "path";
import { promises as fs } from "fs";

const ROOT_DIR = process.env.ROOT_FOLDER || "";

export const uploadLiveCases = async (req: Request, res: Response) => {
  try {
    const { cases, passkey } = req.body;

    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No cases provided or invalid format",
      });
    }

    const portalUrl = process.env.PORTAL_URL;
    if (!portalUrl) {
      return res.status(500).json({
        success: false,
        message: "Portal URL not configured",
      });
    }

    const results: any[] = [];

    for (const c of cases) {
      const { activeDate, caseId, caseOwner, patientName } = c;

      if (!caseId || !activeDate || !caseOwner) {
        results.push({
          caseId,
          patientName,
          status: "failed",
          error: "Missing required fields",
        });
        continue;
      }

      const patientFolderName = patientName || caseOwner;
      const userToken = caseId.substring(0, 2);

      try {
        // --- Fetch Box IDs ---
        const { data } = await axios.get(
          `${portalUrl}/api/localUploader/fetchBoxIds/${caseId}`
        );

        const caseFolderId = data.caseFolderId;
        if (!caseFolderId)
          throw new Error("Missing caseFolderId in portal response");

        // --- Construct paths ---
        const commonPath = path.join(
          ROOT_DIR,
          activeDate,
          userToken,
          "EXPORT - External",
          `${caseId} -- ${caseOwner}`
        );
        const folderPath = patientName
          ? path.join(commonPath, `${caseId} -- ${patientName}`)
          : commonPath;

        // --- Get local files ---
        const files = await getFilesInFolder(folderPath);
        if (!files || files.length === 0) {
          results.push({
            caseId,
            patientName,
            status: "failed",
            error: "No files found in local folder",
          });
          continue;
        }

        // --- Upload files to Box ---
        const uploadResult = await handleBoxUpload(
          caseId,
          userToken,
          patientFolderName,
          caseFolderId,
          files
        );

        const summary = {
          ...uploadResult,
          type: "Live Case upload",
          passkey: passkey,
        };
        // --- Mark upload completion ---
        try {
          const newFolderPath = path.join(folderPath, "AAA -- U");
          await fs.mkdir(newFolderPath, { recursive: true });
        } catch (err: any) {
          console.warn(
            `⚠️ Failed to create completion folder for ${caseId}:`,
            err.message
          );
        }

        // --- Notify portal ---
        try {
          await axios.post(
            `${portalUrl}/api/localUploader/upload-details`,
            summary
          );
        } catch (err: any) {
          console.error(
            `❌ Failed to notify portal for ${caseId}:`,
            err.message
          );
        }

        results.push({
          caseId,
          patientName,
          status: "uploaded",
          uploadResult,
        });
      } catch (err: any) {
        console.error(`💥 Error uploading ${caseId}:`, err.message);
        results.push({
          caseId,
          patientName,
          status: "failed",
          error: err.message,
        });
      }
    }

    // --- Return all results ---
    return res.status(200).json({
      success: true,
      message: `Processed ${cases.length} cases`,
      results,
    });
  } catch (error: any) {
    console.error("💥 Unexpected error in uploadLiveCases:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error during bulk case upload",
      error: error.message,
    });
  }
};

export const uploadRedesignCases = async (req: Request, res: Response) => {
  try {
    const { cases, passkey } = req.body;

    if (!Array.isArray(cases) || cases.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No cases provided or invalid format",
      });
    }

    const portalUrl = process.env.PORTAL_URL;
    if (!portalUrl) {
      return res.status(500).json({
        success: false,
        message: "Portal URL not configured",
      });
    }

    const results: any[] = [];

    for (const c of cases) {
      const {
        activeDate,
        caseId,
        caseOwner,
        patientName,
        attempt,
        priority,
        key,
      } = c;

      // --- Validate input ---
      if (
        !caseId ||
        !activeDate ||
        !caseOwner ||
        !patientName ||
        !attempt ||
        !priority
      ) {
        results.push({
          key,
          caseId,
          patientName,
          status: "failed",
          error: "Missing required fields",
        });
        continue;
      }

      const patientFolderName = patientName;
      const userToken = caseId.substring(0, 2);

      try {
        // --- Fetch Box IDs ---
        const { data } = await axios.get(
          `${portalUrl}/api/localUploader/fetchBoxIds/${caseId}`
        );
        const caseFolderId = data.caseFolderId;
        if (!caseFolderId)
          throw new Error("Missing caseFolderId in portal response");

        // --- Construct redesign folder path ---
        const folderPath = path.join(
          ROOT_DIR,
          activeDate,
          "REDESIGN",
          `RD-${attempt}-${caseId} -- ${caseOwner}-${priority}`,
          "TS_Uploads",
          patientName
        );

        const previewPath = path.join(folderPath, "Previews");
        const downloadPath = path.join(folderPath, "Downloads");

        // --- Get local files ---
        const [previewFiles, downloadFiles] = await Promise.all([
          getFilesInFolder(previewPath).catch(() => []),
          getFilesInFolder(downloadPath).catch(() => []),
        ]);
        const allFiles = [...previewFiles, ...downloadFiles];

        if (!allFiles || allFiles.length === 0) {
          results.push({
            key,
            caseId,
            patientName,
            status: "failed",
            error: "No files found in local folder",
          });
          continue;
        }

        // --- Upload files to Box ---
        const uploadResult = await handleBoxUpload(
          caseId,
          userToken,
          patientFolderName,
          caseFolderId,
          allFiles
        );

        const summary = {
          ...uploadResult,
          type: `Redesign-${attempt}`,
          passkey: passkey,
        };

        // --- Mark upload completion ---
        try {
          const newFolderPath = path.join(folderPath, "AAA -- U");
          await fs.mkdir(newFolderPath, { recursive: true });
        } catch (err: any) {
          console.warn(
            `⚠️ Failed to create completion folder for ${caseId}:`,
            err.message
          );
        }

        // --- Notify portal ---
        try {
          await axios.post(
            `${portalUrl}/api/localUploader/upload-details`,
            summary
          );
        } catch (err: any) {
          console.error(
            `❌ Failed to notify portal for ${caseId}:`,
            err.message
          );
        }

        results.push({
          key,
          caseId,
          patientName,
          status: "uploaded",
          uploadResult,
        });
      } catch (err: any) {
        console.error(`💥 Error uploading ${caseId}:`, err.message);
        results.push({
          key,
          caseId,
          patientName,
          status: "failed",
          error: err.message,
        });
      }
    }

    // --- Return all results ---
    return res.status(200).json({
      success: true,
      message: `Processed ${cases.length} redesign cases`,
      results,
    });
  } catch (error: any) {
    console.error("💥 Unexpected error in uploadRedesignCases:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error during bulk redesign case upload",
      error: error.message,
    });
  }
};

const getFilesInFolder = async (folderPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(path.join(folderPath, entry.name));
      }
    }

    return files;
  } catch (error: any) {
    console.error("⚠️ Error reading folder:", error.message);
    throw new Error("Unable to read folder");
  }
};
