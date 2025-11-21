import fs from "fs";
import path from "path";

// date folder filteration
function buildAllowedRtFolders(): Set<string> {
  const today = new Date();
  const allowed = new Set<string>();

  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const dayNum = d.getDate();
    const dayPadded = String(dayNum).padStart(2, "0");
    const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const year = d.getFullYear();

    // Add both formats: RT-1 Nov 2025 and RT-01 Nov 2025
    allowed.add(`RT-${dayNum} ${month} ${year}`);
    allowed.add(`RT-${dayPadded} ${month} ${year}`);
  }

  return allowed;
}

export function dateFoldersUtil(basePath: string): string[] {
  if (!fs.existsSync(basePath)) return [];

  const allowed = buildAllowedRtFolders();

  return fs
    .readdirSync(basePath)
    .filter((item) => {
      const fullPath = path.join(basePath, item);
      return fs.statSync(fullPath).isDirectory() && allowed.has(item);
    })
    .sort();
}

// token folder filteration
export function getTokenFoldersUtil(basePath: string): string[] {
  if (!basePath || !fs.existsSync(basePath)) return [];

  return fs.readdirSync(basePath).filter((item) => {
    const fullPath = path.join(basePath, item);
    if (!fs.statSync(fullPath).isDirectory()) return false;

    return item === "REDESIGN" || /^[A-Z]{2}$/.test(item);
  });
}

// final cases and redesigns folder filteration
const LIVE_REGEX = /^([A-Z]{2}\d{5})\s--\s(.+)$/;
const REDESIGN_REGEX = /^RD-(\d+)-([A-Z]{2}\d{5})\s--\s(.+)-\s?(HIGH|MEDIUM)$/;

// 🔹 LIVE CASES
export const getLiveCases = (basePath: string) => {
  if (!fs.existsSync(basePath)) {
    throw new Error(`Base path not found: ${basePath}`);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  const result = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(LIVE_REGEX);
      if (!match) return null;

      const [, caseId, caseOwner] = match;
      const casePath = path.join(basePath, entry.name);

      let caseStatus = "pending";
      const patients: { patientName: string; status: string }[] = [];

      try {
        // Check if case folder directly contains "AAA -- U"
        const hasUploadedFolder = fs
          .readdirSync(casePath, { withFileTypes: true })
          .some(
            (e) => e.isDirectory() && e.name.trim().toUpperCase() === "AAA -- U"
          );

        if (hasUploadedFolder) {
          caseStatus = "uploaded";
        } else {
          // Otherwise, check if it contains patient subfolders
          const innerEntries = fs.readdirSync(casePath, {
            withFileTypes: true,
          });
          const patientDirs = innerEntries.filter((e) => e.isDirectory());

          for (const inner of patientDirs) {
            const innerMatch = inner.name.match(LIVE_REGEX);
            if (!innerMatch) continue;

            const [, , patientName] = innerMatch;
            const patientPath = path.join(casePath, inner.name);

            let status = "pending";

            try {
              const hasUploadedFolderInPatient = fs
                .readdirSync(patientPath, { withFileTypes: true })
                .some(
                  (e) =>
                    e.isDirectory() &&
                    e.name.trim().toUpperCase() === "AAA -- U"
                );

              if (hasUploadedFolderInPatient) status = "uploaded";
            } catch {
              // ignore read errors
            }

            patients.push({
              patientName: patientName.trim(),
              status,
            });
          }

          // Infer case status from patients if any uploaded
          if (patients.some((p) => p.status === "uploaded")) {
            caseStatus = "uploaded";
          }
        }
      } catch (err) {
        console.error("Error reading case folder:", entry.name, err);
      }

      return {
        caseId,
        caseOwner,
        caseStatus,
        patients, // may be empty
      };
    })
    .filter(Boolean);

  return result;
};

// 🔹 REDESIGN CASES
export const getRedesignCases = (basePath: string) => {
  if (!fs.existsSync(basePath)) {
    throw new Error(`Base path not found: ${basePath}`);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  const result = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const match = entry.name.match(REDESIGN_REGEX);
      if (!match) return null;

      const [, attempt, caseId, caseOwner, priority] = match;
      const casePath = path.join(basePath, entry.name);
      const uploadsPath = path.join(casePath, "TS_Uploads");

      const patients: {
        patientName: string;
        status: string;
      }[] = [];

      try {
        if (fs.existsSync(uploadsPath)) {
          const uploadEntries = fs.readdirSync(uploadsPath, {
            withFileTypes: true,
          });

          for (const upload of uploadEntries) {
            if (!upload.isDirectory()) continue;

            const patientName = upload.name;
            const patientPath = path.join(uploadsPath, upload.name);

            let status = "pending";
            try {
              const innerEntries = fs.readdirSync(patientPath, {
                withFileTypes: true,
              });
              const hasUploadedFolder = innerEntries.some(
                (e) =>
                  e.isDirectory() && e.name.trim().toUpperCase() === "AAA -- U"
              );
              if (hasUploadedFolder) status = "uploaded";
            } catch {
              // ignore patient-level read errors
            }

            patients.push({
              patientName: patientName.trim(),
              status,
            });
          }
        }
      } catch {
        // ignore TS_Uploads-level read errors
      }

      return {
        caseId,
        caseOwner,
        patients,
        attempt: Number(attempt),
        priority: priority || null,
      };
    })
    .filter(Boolean);

  return result;
};











const PATIENTFOLDERS_REGEX = /^(.+?)\s*--\s*(.+)$/;

export const getPatientFolders = (basePath: string) => {
  if (!fs.existsSync(basePath)) {
    throw new Error(`Base path not found: ${basePath}`);
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  const patients: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const match = entry.name.match(PATIENTFOLDERS_REGEX);
    if (!match) continue;

    const [, , patientName] = match;
    patients.push(patientName.trim());
  }

  return patients.join(", ");
};