import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // if using Node < 18
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// File Checker
import { splitCasesByLabToken } from "./FileChecker/checkerUtils/mainChecker.js";
import { handleApiError } from "./FileChecker/utils/errorHandlers.js";

// Case Uploader
import watchLocalRoutes from "./CaseUploader/routes/watchLocal.js";
import uploadRoutes from "./CaseUploader/routes/uploadFile.js";
import { getClient } from "./CaseUploader/config/box.js";
import { processCases } from "./CaseUploader/utils/downloader/ts_portal_box_cases_downloader.js";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

// File path setup (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Case Uploader
getClient((client) => {
  processCases(client);
});

// Run every 1 minute
setInterval(() => {
  getClient((client) => {
    processCases(client);
  });
}, 60 * 1000);

// Then your routes
app.use("/api", watchLocalRoutes, uploadRoutes);

// File checker
// local test
app.get("/cases/status", async (req, res) => {
  try {
    const casesStatus = await splitCasesByLabToken();
    res.json(casesStatus);
  } catch (error) {
    handleApiError(res, error, "checkCases");
  }
});

// ------------------- Push Data Every 1 Minute -------------------
// const PUSH_INTERVAL = 10 * 1000; // 1 minute

// const pushCasesStatus = async () => {
//   try {
//     const casesStatus = await splitCasesByLabToken();
//     // const response = await fetch("https://file-checker-server.onrender.com/", {

//     if (!process.env.Live_Server) {
//       throw new Error("Live_Server environment variable is not defined");
//     }
//     const response = await fetch(process.env.Live_Server, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(casesStatus),
//     });

//     if (!response.ok) {
//       console.error("❌ Failed to push data:", response.statusText);
//     } else {
//       console.log("✅ Cases status sent to Server B");
//     }
//   } catch (error) {
//     console.error("❌ Error pushing cases status:", error);
//   }
// };

// // Start interval
// setInterval(pushCasesStatus, PUSH_INTERVAL);

// ------------------- Start Server -------------------
app.listen(PORT, async () => {
  try {
    console.log("✅ Connected to DB");

    // Sync database - use alter mode for production to avoid data loss
    console.log("🛠️  DB synced (development mode)");

    // await sessionStore.sync();
    console.log("🗄️  Session store synced");
  } catch (error) {
    console.error("❌DB connection or sync failed:", error);
  }
  console.log(`🚀 Server running on port ${PORT}`);
});
