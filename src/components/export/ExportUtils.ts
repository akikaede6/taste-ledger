import type { ExportPreferences } from "../../types/workspace";

const EXPORT_DIRECTORY_KEY = "taste-ledger:export-directory";

export function loadExportPreferences(): ExportPreferences {
  if (typeof window === "undefined") {
    return { directory: null };
  }

  try {
    const raw = window.localStorage.getItem(EXPORT_DIRECTORY_KEY);

    if (!raw) {
      return { directory: null };
    }

    const parsed = JSON.parse(raw) as Partial<ExportPreferences>;

    return {
      directory:
        typeof parsed.directory === "string" && parsed.directory.length > 0
          ? parsed.directory
          : null,
    };
  } catch {
    return { directory: null };
  }
}

export function storeExportPreferences(preferences: ExportPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (preferences.directory) {
      window.localStorage.setItem(
        EXPORT_DIRECTORY_KEY,
        JSON.stringify(preferences),
      );
    } else {
      window.localStorage.removeItem(EXPORT_DIRECTORY_KEY);
    }
  } catch {
    // Ignore storage failures in constrained browsers.
  }
}

export function sanitizeExportFileStem(value: string): string {
  const normalized = Array.from(value.normalize("NFKC"), (character) =>
    character.charCodeAt(0) < 32 ? "_" : character,
  ).join("");

  const sanitized = normalized
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/g, "");

  return sanitized.length > 0 ? sanitized : "taste-ledger-export";
}

export function canRasterizeSvgForExport(): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return false;
  }

  const canvas = document.createElement("canvas");

  return canvas.getContext("2d") !== null;
}

export function canCopyImageToClipboard(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

export function downloadFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof document === "undefined") {
    return;
  }

  if (typeof URL.createObjectURL !== "function") {
    return;
  }

  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);

  const blob = new Blob([blobBytes.buffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
