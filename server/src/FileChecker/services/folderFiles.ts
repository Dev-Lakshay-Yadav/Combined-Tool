import fs from "fs";
import path from "path";

export const getFilesAndFolderNamesInsideCaseFolder = async (folderPath: string): Promise<string[]> => {
  try {
    const items = await fs.promises.readdir(folderPath, { withFileTypes: true });

    return items.map((item) =>
      item.isDirectory()
        ? `${item.name}/`
        : item.name
    );
  } catch (error) {
    console.error("Error reading folder:", error);
    return [];
  }
};
