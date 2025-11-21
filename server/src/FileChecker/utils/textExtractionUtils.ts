// ----------------- Utility Helpers -----------------
function matchRegex(
  text: string,
  regex: RegExp,
  groupIndex = 1
): string | null {
  const match = text.match(regex);
  return match && match[groupIndex] ? match[groupIndex].trim() : null;
}

// ----------------- Extraction Functions -----------------

// Case ID + Patient Name
function extractFilePrefix(text: string): string | null {
  const result = matchRegex(
    text,
    /\b([A-Z0-9]+ -- [\s\S]+?)\s+(?=Case Priority|Patient name)/i
  );
  return result ? result.replace(/\s+/g, " ") : null;
}

// Service Type
const SERVICES = [
  "Crown And Bridge",
  "Implant",
  "Smile Design",
  "Digital Model",
  "Surgical Guide",
  "Nightguard",
  "No-prep veneer",
  "Other Treatments",
] as const;

function extractServiceType(text: string): (typeof SERVICES)[number] | null {
  const startMarkers = ["Patient Name:", "Patient name -"];
  const endMarkers = ["Model Type:", "Tooth Numbers:"];

  // Find first matching start marker
  let startIndex = -1;
  for (const marker of startMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      startIndex = idx + marker.length;
      break;
    }
  }
  if (startIndex === -1) return null;

  // Find nearest end marker
  let endIndex = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, startIndex);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }

  // Extract region between start & end
  const searchText = text.substring(startIndex, endIndex).trim();

  // Check against SERVICES
  for (const item of SERVICES) {
    const regex = new RegExp(item.replace(/\s+/g, "\\s+"), "i");
    if (regex.test(searchText)) {
      return item;
    }
  }

  return null;
}

// Tooth Numbers
function extractToothNumbers(text: string): number[] {
  const result = matchRegex(text, /Tooth Numbers:\s*([0-9,\s]+)/i);
  return result
    ? result
        .split(/[\s,]+/)
        .map((num) => parseInt(num, 10))
        .filter((num) => !isNaN(num))
    : [];
}

// Additional Notes
function extractAdditionalNotes(text: string): string | null {
  return matchRegex(
    text,
    /Additional Notes:\s*([\s\S]*?)(?:\n[A-Z][^\n]*:|\n?$)/i
  );
}

// ----------------- Main Processor -----------------
export async function processPdfText(text: string) {
  const serviceType = extractServiceType(text);

  // Skip tooth numbers for specific services
  const skipToothNumbers = ["Digital Model", "Nightguard", "Other Treatments"];

  return {
    file_Prefix: extractFilePrefix(text),
    service_Type: serviceType,
    tooth_Numbers:
      serviceType && skipToothNumbers.includes(serviceType)
        ? null
        : extractToothNumbers(text),
    additional_Notes: extractAdditionalNotes(text),
  };
}
