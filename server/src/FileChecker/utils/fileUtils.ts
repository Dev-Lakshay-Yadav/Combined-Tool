import fs from "fs/promises";
import { format, subDays } from "date-fns";

const root_dir = process.env.ROOT_FOLDER || "Z:/"; // make path configurable

function getISTDate(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
}

export async function resolveDateFolderName(): Promise<string | null> {
  try {
    const nowIST = getISTDate();
    const hourIST = nowIST.getHours();

    // Before 4 PM → yesterday, after 4 PM → today
    const targetDate = hourIST < 16 ? subDays(nowIST, 1) : nowIST;

    // Generate both possible formats
    const padded = "RT-" + format(targetDate, "dd MMM yyyy").toUpperCase();
    const unpadded = "RT-" + format(targetDate, "d MMM yyyy").toUpperCase();

    // Read directory safely
    const entries = await fs.readdir(root_dir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name.toUpperCase());

    // Match either format
    if (folders.includes(padded)) return padded;
    if (folders.includes(unpadded)) return unpadded;

    return null;
  } catch (err: any) {
    console.error(`Failed to read root_dir "${root_dir}":`, err.message);
    return null; // gracefully return null instead of crashing
  }
}

export async function getSharedPath(): Promise<string | null> {
  const folderName = await resolveDateFolderName();
  return folderName ? `${root_dir}${folderName}` : null;
}

export const getLabTokens = async (commonPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(commonPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    console.error(`Error reading folder: ${commonPath}`, error);
    return [];
  }
};

export const getCasesList = async (commonPath: string): Promise<string[]> => {
  try {
    const importFolders = await getCasesImports(`${commonPath}/IMPORT/`);
    const exportFolders = await getCasesExports(
      `${commonPath}/EXPORT - External/`
    );
    // Find common cases
    const commonCases = importFolders.filter((folder) =>
      exportFolders.includes(folder)
    );
    return commonCases;
  } catch (error) {
    console.error(`Error reading Cases List`, error);
    return []; // always return array
  }
};

// Utility to get folder names inside imports
const getCasesImports = async (folderPath: string): Promise<string[]> => {
  return getFolderNames(folderPath);
};

// Utility to get folder names inside exports
const getCasesExports = async (folderPath: string): Promise<string[]> => {
  return getFolderNames(folderPath);
};

// utility for import and export folder sub folder names
const getFolderNames = async (folderPath: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    console.error(`Error reading folder: ${folderPath}`, error);
    return [];
  }
};
