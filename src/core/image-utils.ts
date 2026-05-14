export function getImageMimeType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "svg") {
    return "image/svg+xml";
  }

  return "image/png";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

export function createImageDataUrl(path: string, bytes: Uint8Array): string {
  return `data:${getImageMimeType(path)};base64,${bytesToBase64(bytes)}`;
}

export async function createDisplayImageDataUrl(
  path: string,
  bytes: Uint8Array,
): Promise<string> {
  const dataUrl = createImageDataUrl(path, bytes);

  if (getImageMimeType(path) !== "image/svg+xml" || !canRasterizeSvg()) {
    return dataUrl;
  }

  try {
    return await rasterizeImageDataUrlToPngDataUrl(dataUrl);
  } catch {
    return dataUrl;
  }
}

export async function createMosaicImageDataUrl(
  dataUrl: string,
  level: number,
): Promise<string> {
  if (
    typeof document === "undefined" ||
    typeof Image === "undefined" ||
    typeof window === "undefined"
  ) {
    return dataUrl;
  }

  const normalizedLevel = Math.max(1, Math.min(5, Math.round(level)));

  try {
    const image = await loadImage(dataUrl);
    const width = Math.max(1, image.naturalWidth || image.width || 1080);
    const height = Math.max(1, image.naturalHeight || image.height || 1080);
    const downscaleFactor = 4 + (normalizedLevel - 1) * 2;
    const reducedWidth = Math.max(1, Math.round(width / downscaleFactor));
    const reducedHeight = Math.max(1, Math.round(height / downscaleFactor));

    const downscaleCanvas = document.createElement("canvas");
    downscaleCanvas.width = reducedWidth;
    downscaleCanvas.height = reducedHeight;

    const downscaleContext = downscaleCanvas.getContext("2d");

    if (!downscaleContext) {
      return dataUrl;
    }

    downscaleContext.imageSmoothingEnabled = true;
    downscaleContext.clearRect(0, 0, reducedWidth, reducedHeight);
    downscaleContext.drawImage(image, 0, 0, reducedWidth, reducedHeight);

    const upscaleCanvas = document.createElement("canvas");
    upscaleCanvas.width = width;
    upscaleCanvas.height = height;

    const upscaleContext = upscaleCanvas.getContext("2d");

    if (!upscaleContext) {
      return dataUrl;
    }

    upscaleContext.imageSmoothingEnabled = false;
    upscaleContext.clearRect(0, 0, width, height);
    upscaleContext.drawImage(downscaleCanvas, 0, 0, width, height);

    return upscaleCanvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

export function createSvgDataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export async function convertSvgTextToExportFile(svgText: string): Promise<{
  bytes: Uint8Array;
  extension: "png" | "svg";
  mimeType: "image/png" | "image/svg+xml";
}> {
  if (!canRasterizeSvg()) {
    return {
      bytes: new TextEncoder().encode(svgText),
      extension: "svg",
      mimeType: "image/svg+xml",
    };
  }

  const dataUrl = await rasterizeImageDataUrlToPngDataUrl(
    createSvgDataUrl(svgText),
  );

  return {
    bytes: dataUrlToBytes(dataUrl),
    extension: "png",
    mimeType: "image/png",
  };
}

export async function copyImageToClipboard(
  bytes: Uint8Array,
  mimeType: "image/png" | "image/svg+xml",
): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.clipboard?.write !== "function" ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error("Clipboard image copy is not available.");
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      [mimeType]: new Blob([bytesToArrayBuffer(bytes)], { type: mimeType }),
    }),
  ]);
}

function canRasterizeSvg(): boolean {
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

async function rasterizeImageDataUrlToPngDataUrl(
  dataUrl: string,
): Promise<string> {
  const image = await loadImage(dataUrl);
  const width = Math.max(1, image.naturalWidth || image.width || 1080);
  const height = Math.max(1, image.naturalHeight || image.height || 1080);
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, base64 = ""] = dataUrl.split(",", 2);
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
