import path from "path";
import { getBoxAccessToken } from "../config/box.js";
import fs from "fs";
import FormData from "form-data";
import axios from "axios";
import pLimit from "p-limit";

const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"];

const sanitizeFileName = (name: string) => {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim();
};

export const getOrCreateFolder = async (
  parentFolderId: string,
  folderName: string,
  accessToken: string
): Promise<string> => {
  const listRes = await fetch(
    `https://api.box.com/2.0/folders/${parentFolderId}/items?limit=1000&fields=name,id,type`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    const errorText = await listRes.text();
    throw new Error(
      `Box API error [list items]: ${listRes.status} ${errorText}`
    );
  }

  const items = await listRes.json();

  if (!items.entries || !Array.isArray(items.entries)) {
    console.error("Unexpected Box API response:", items);
    throw new Error("Box API did not return folder entries");
  }

  const existingFolder = items.entries.find(
    (item: { type: string; name: string; id: string }) =>
      item.type === "folder" && item.name === folderName
  );

  if (existingFolder) return existingFolder.id;

  // 2. Create folder if it doesn't exist
  const createRes = await fetch("https://api.box.com/2.0/folders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      parent: { id: parentFolderId.toString() },
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(
      `Box API error [create folder]: ${createRes.status} ${errorText}`
    );
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

export const generateUniqueFileName = async (
  folderId: string,
  originalName: string,
  accessToken: string
): Promise<string> => {
  const { name: baseName, ext } = splitFileName(originalName);

  const listRes = await fetch(
    `https://api.box.com/2.0/folders/${folderId}/items?limit=1000&fields=name`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    const errorText = await listRes.text();
    throw new Error(
      `Box API error [list items for filenames]: ${listRes.status} ${errorText}`
    );
  }

  const items = await listRes.json();
  const existingNames = items.entries.map(
    (entry: { name: string }) => entry.name
  );

  if (!existingNames.includes(originalName)) return originalName;

  let counter = 1;
  let newName = `${baseName}(${counter})${ext}`;
  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName}(${counter})${ext}`;
  }

  return newName;
};

const splitFileName = (filename: string) => {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return { name: filename, ext: "" };
  return {
    name: filename.substring(0, lastDot),
    ext: filename.substring(lastDot),
  };
};

export const deleteBoxFolder = async (
  folderId: string,
  accessToken: string
) => {
  try {
    await axios.delete(`https://api.box.com/2.0/folders/${folderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        recursive: true, // delete all subfolders and files
      },
    });
  } catch (err: any) {
    console.error(
      `Failed to delete folder ${folderId}:`,
      err.response?.data || err.message
    );
    throw err;
  }
};

const getFileTypeFolder = (filePath: string) => {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return imageExtensions.includes(ext) ? "TS_PREVIEW" : "TS_DOWNLOAD";
};

const uploadLocalFileToBox = async (
  filePath: string,
  folderId: string,
  accessToken: string,
  onProgress?: (percent: number) => void
) => {
  const fileName = sanitizeFileName(path.basename(filePath));
  const fileSize = fs.statSync(filePath).size;
  const fileStream = fs.createReadStream(filePath);

  let uploadedBytes = 0;
  fileStream.on("data", (chunk) => {
    uploadedBytes += chunk.length;
    if (onProgress) onProgress((uploadedBytes / fileSize) * 100);
  });

  const formData = new FormData();
  formData.append(
    "attributes",
    JSON.stringify({ name: fileName, parent: { id: folderId } })
  );
  formData.append("file", fileStream);

  const res = await axios.post(
    "https://upload.box.com/api/2.0/files/content",
    formData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  const boxFileId = res.data.entries?.[0]?.id;
  return { success: true, boxFileId, fileName };
};

const replaceExistingFile = async (
  fileId: string,
  filePath: string,
  accessToken: string
) => {
  const fileStream = fs.createReadStream(filePath);
  const formData = new FormData();
  formData.append("file", fileStream);

  const response = await axios.post(
    `https://upload.box.com/api/2.0/files/${fileId}/content`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  const fileName = path.basename(filePath);
  console.log(`♻️ Replaced existing file: ${fileName}`);

  return { success: true, boxFileId: response.data.entries?.[0]?.id, fileName };
};

// Retry wrapper for rate-limited uploads
const uploadWithRetry = async (
  filePath: string,
  folderId: string,
  accessToken: string,
  retries = 3
) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await uploadLocalFileToBox(filePath, folderId, accessToken);
    } catch (err: any) {
      const status = err.response?.status;

      // Handle 409 conflict: file already exists → replace it
      if (status === 409) {
        const existingFileId = err.response?.data?.context_info?.conflicts?.id;
        if (existingFileId) {
          console.log(`⚠️ File already exists. Replacing: ${filePath}`);
          return await replaceExistingFile(
            existingFileId,
            filePath,
            accessToken
          );
        }
      }

      // Retry for rate-limit (429)
      if (status === 429 && attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⏳ Rate limited. Retrying after ${waitTime}ms...`);
        await new Promise((res) => setTimeout(res, waitTime));
      } else {
        throw new Error(`Failed to upload ${filePath}: ${err.message}`);
      }
    }
  }
};

// Main upload handler
export const handleBoxUpload = async (
  caseId: string,
  userToken: string,
  patientFolderName: string | null,
  caseFolderId: string | null,
  files: string[]
) => {
  if (
    !caseId ||
    !userToken ||
    !patientFolderName ||
    !caseFolderId ||
    !files?.length
  ) {
    throw new Error("Missing required parameters");
  }

  const accessToken = await getBoxAccessToken();

  // Track created folders for rollback
  const createdFolderIds: string[] = [];

  try {
    // Create TS_Uploads folder under caseFolderId
    const tsUploadFolderId = await getOrCreateFolder(
      caseFolderId,
      "TS_Uploads",
      accessToken
    );
    createdFolderIds.push(tsUploadFolderId);

    // Create patient folder under TS_Uploads
    const patientFolderId = await getOrCreateFolder(
      tsUploadFolderId,
      patientFolderName,
      accessToken
    );
    createdFolderIds.push(patientFolderId);

    // Group files by type
    const folderNameMap: Record<string, string> = {
      TS_DOWNLOAD: "Downloads",
      TS_PREVIEW: "Previews",
    };
    const filesByType: Record<string, string[]> = {};

    for (const filePath of files) {
      const fileType = getFileTypeFolder(filePath);
      if (!filesByType[fileType]) filesByType[fileType] = [];
      filesByType[fileType].push(filePath);
    }

    // Create folders for each type
    const folderIdsByType: Record<string, string> = {};
    for (const fileType of Object.keys(filesByType)) {
      const targetFolderName = folderNameMap[fileType] || fileType;
      const folderId = await getOrCreateFolder(
        patientFolderId,
        targetFolderName,
        accessToken
      );
      folderIdsByType[fileType] = folderId;
      createdFolderIds.push(folderId);
    }

    // Flatten all files with type
    const allFiles = Object.entries(filesByType).flatMap(
      ([fileType, filePaths]) =>
        filePaths.map((filePath) => ({ filePath, fileType }))
    );

    // Upload files with concurrency control
    const CONCURRENCY_LIMIT = 5;
    const limit = pLimit(CONCURRENCY_LIMIT);

    const uploadedFiles = await Promise.all(
      allFiles.map(({ filePath, fileType }) =>
        limit(async () => {
          const result = await uploadWithRetry(
            filePath,
            folderIdsByType[fileType],
            accessToken
          );
          const file_name = path.basename(filePath);
          return {
            ...result,
            file_type: fileType,
            file_name,
          };
        })
      )
    );

    return {
      userToken,
      caseId,
      patientFolderName,
      uploadedFiles,
      userId: process.env.USER_ID || 1,
    };
  } catch (err: any) {
    // Rollback: delete all created folders
    for (const folderId of createdFolderIds.reverse()) {
      try {
        await deleteBoxFolder(folderId, accessToken);
      } catch (deleteErr) {
        console.error("Failed to delete folder during rollback:", deleteErr);
      }
    }
    throw err; // bubble up error to controller
  }
};
// const sanitizeFileName = (name: string) => name.replace(/[\/\\?%*:|"<>]/g, "_");

// const uploadLocalFileToBox = async (
//   filePath: string,
//   folderId: string,
//   accessToken: string
// ) => {
//   try {
//     const fileName = sanitizeFileName(path.basename(filePath));
//     const fileStream = fs.createReadStream(filePath);

//     const formData = new FormData();
//     formData.append(
//       "attributes",
//       JSON.stringify({
//         name: fileName,
//         parent: { id: folderId },
//       })
//     );
//     formData.append("file", fileStream);

//     const res = await axios.post(
//       "https://upload.box.com/api/2.0/files/content",
//       formData,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//           ...formData.getHeaders(),
//         },
//         maxContentLength: Infinity,
//         maxBodyLength: Infinity,
//       }
//     );

//     const data = res.data;
//     const boxFileId = data.entries?.[0]?.id;

//     return { success: true, boxFileId, fileName };
//   } catch (error: any) {
//     console.error(
//       `Error uploading file ${filePath}:`,
//       error.response?.data || error.message
//     );
//     return {
//       success: false,
//       fileName: path.basename(filePath),
//       error: error.message,
//     };
//   }
// };

// const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff"];

// // Helper: decide if file is image or download
// const getFileTypeFolder = (filePath: string) => {
//   const ext = path.extname(filePath).slice(1).toLowerCase();
//   const isImage = imageExtensions.includes(ext);
//   return isImage ? "PREVIEW_FILES" : "DOWNLOADS";
// };

// export const handleBoxUpload = async (
//   caseId: string,
//   userToken: string,
//   patientFolderName: string | null,
//   tokenFolderId: string | null,
//   caseFolderId: string | null,
//   files: string[]
// ) => {
//   const userId = 1;
// if (
//   !caseId ||
//   !userToken ||
//   !patientFolderName ||
//   !tokenFolderId ||
//   !caseFolderId ||
//   !files?.length
// ) {
//   console.error("Missing parameters:", {
//     caseId: !!caseId,
//     userToken: !!userToken,
//     patientFolderName: !!patientFolderName,
//     tokenFolderId: !!tokenFolderId,
//     caseFolderId: !!caseFolderId,
//     files: !!files?.length,
//   });
//   throw new Error("Missing required parameters");
// }

//   const accessToken = await getBoxAccessToken();

//   // 1️⃣ Create TS_Uploads folder under caseFolderId
//   const tsUploadFolderId = await getOrCreateFolder(
//     caseFolderId,
//     "TS_Uploads",
//     accessToken
//   );

//   // 2️⃣ Create patient folder under TS_Uploads
//   const patientFolderId = await getOrCreateFolder(
//     tsUploadFolderId,
//     patientFolderName,
//     accessToken
//   );

//   const folderNameMap: Record<string, string> = {
//     DOWNLOADS: "Downloads",
//     PREVIEW_FILES: "Previews",
//   };

//   // 3️⃣ Group files by type
//   const filesByType: Record<string, string[]> = {};
//   for (const filePath of files) {
//     const fileType = getFileTypeFolder(filePath);
//     if (!filesByType[fileType]) filesByType[fileType] = [];
//     filesByType[fileType].push(filePath);
//   }

//   // 4️⃣ Create folders for each type
//   const folderIdsByType: Record<string, string> = {};
//   for (const fileType of Object.keys(filesByType)) {
//     const targetFolderName = folderNameMap[fileType] || fileType;
//     folderIdsByType[fileType] = await getOrCreateFolder(
//       patientFolderId,
//       targetFolderName,
//       accessToken
//     );
//   }

//   // 5️⃣ Controlled parallel uploads
//   const CONCURRENCY_LIMIT = 5;
//   const allFiles = Object.entries(filesByType).flatMap(([fileType, filePaths]) =>
//     filePaths.map((filePath) => ({ filePath, fileType }))
//   );

//   const uploadedFiles: any[] = [];

//   const uploadInBatches = async () => {
//     for (let i = 0; i < allFiles.length; i += CONCURRENCY_LIMIT) {
//       const batch = allFiles.slice(i, i + CONCURRENCY_LIMIT);
//       const results = await Promise.all(
//         batch.map(({ filePath, fileType }) =>
//           uploadLocalFileToBox(filePath, folderIdsByType[fileType], accessToken).then(
//             (result) => ({ ...result, file_type: fileType })
//           )
//         )
//       );
//       uploadedFiles.push(...results);
//     }
//   };

//   await uploadInBatches();

//   const uploadSummary = {
//     userToken,
//     caseId,
//     patientFolderName,
//     uploadedFiles,
//     userId,
//   };

//   return uploadSummary;
// };
