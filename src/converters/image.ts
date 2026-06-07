import type { OutputFormat, QualityPreset } from "../types";

const MIME_TYPES: Partial<Record<OutputFormat, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const QUALITY: Record<QualityPreset, number> = {
  small: 0.7,
  balanced: 0.85,
  high: 0.93,
};

export async function convertImage(
  file: File,
  format: OutputFormat,
  quality: QualityPreset,
  signal: AbortSignal,
): Promise<Blob> {
  const mimeType = MIME_TYPES[format];
  if (!mimeType) {
    throw new Error(`Unsupported image output: ${format}`);
  }

  if (signal.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    if (signal.aborted) throw new DOMException("Conversion cancelled", "AbortError");

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");

    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error(`This browser cannot encode ${format.toUpperCase()}.`)),
        mimeType,
        QUALITY[quality],
      );
    });

    if (signal.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    return blob;
  } finally {
    bitmap.close();
  }
}
