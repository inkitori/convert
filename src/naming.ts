import type { OutputFormat } from "./types";

const FILE_EXTENSIONS: Record<OutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  mp3: "mp3",
  wav: "wav",
  ogg: "ogg",
  flac: "flac",
  mp4: "mp4",
  webm: "webm",
  gif: "gif",
};

export function outputExtension(format: OutputFormat): string {
  return FILE_EXTENSIONS[format];
}

export function outputName(
  inputName: string,
  format: OutputFormat,
  usedNames: Set<string>,
): string {
  const extension = outputExtension(format);
  const dot = inputName.lastIndexOf(".");
  const base = (dot > 0 ? inputName.slice(0, dot) : inputName).trim() || "converted";
  let candidate = `${base}.${extension}`;
  let suffix = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}-${suffix}.${extension}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}
