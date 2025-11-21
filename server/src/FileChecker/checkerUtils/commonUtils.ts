export const hasImageContaining = (
  folderFiles: string[],
  keyword: string
): boolean => {
  const exts = [".jpg", ".jpeg", ".png",".gif"];
  return (
    folderFiles?.some((file) => {
      const f = file.toLowerCase();
      return (
        f.includes(keyword.toLowerCase()) &&
        exts.some((ext) => f.endsWith(ext.toLowerCase()))
      );
    }) ?? false
  );
};


export const hasSTLContaining = (
  folderFiles: string[],
  keyword: string
): boolean => {
  const exts = [".stl"];
  return (
    folderFiles?.some((file) => {
      const f = file.toLowerCase();
      return (
        f.includes(keyword.toLowerCase()) &&
        exts.some((ext) => f.endsWith(ext.toLowerCase()))
      );
    }) ?? false
  );
};


// Count how many files in the list contain a keyword and have one of the specified extensions
export const countFilesContaining = (
  folderFiles: string[],
  keyword: string,
  exts: string[]
): number => {
  return (
    folderFiles?.filter((file) => {
      const f = file.toLowerCase();
      return (
        f.includes(keyword.toLowerCase()) &&
        exts.some((ext) => f.endsWith(ext.toLowerCase()))
      );
    }).length ?? 0
  );
};


// Count how many files in the list have one of the specified extensions
export const countFilesExt = (
  folderFiles: string[],
  exts: string[]
): number => {
  return (
    folderFiles?.filter((f) =>
      exts.some((ext) => f.toLowerCase().endsWith(ext.toLowerCase()))
    ).length ?? 0
  );
};
