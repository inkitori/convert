import type {
  FileDescriptor,
  MediaCategory,
  OutputFormat,
} from "./types";

export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_BATCH_SIZE = 1024 * 1024 * 1024;
export const LARGE_FILE_WARNING = 200 * 1024 * 1024;

const EXTENSIONS: Record<MediaCategory, ReadonlySet<string>> = {
  image: new Set(["png", "jpg", "jpeg", "webp", "bmp"]),
  audio: new Set(["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac", "opus", "wma"]),
  video: new Set([
    "mp4",
    "mov",
    "webm",
    "mkv",
    "avi",
    "m4v",
    "mpeg",
    "mpg",
    "ogv",
    "gif",
  ]),
};

export const OUTPUTS: Record<
  MediaCategory,
  ReadonlyArray<{ value: OutputFormat; label: string }>
> = {
  image: [
    { value: "png", label: "PNG" },
    { value: "jpeg", label: "JPEG" },
    { value: "webp", label: "WebP" },
  ],
  audio: [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "ogg", label: "OGG" },
    { value: "flac", label: "FLAC" },
  ],
  video: [
    { value: "mp4", label: "MP4" },
    { value: "webm", label: "WebM" },
    { value: "gif", label: "GIF" },
  ],
};

export const DEFAULT_OUTPUT: Record<MediaCategory, OutputFormat> = {
  image: "webp",
  audio: "mp3",
  video: "mp4",
};

export const ACCEPTED_EXTENSIONS = Object.values(EXTENSIONS)
  .flatMap((extensions) => [...extensions])
  .map((extension) => `.${extension}`)
  .join(",");

function extensionOf(name: string): string {
  const position = name.lastIndexOf(".");
  return position < 0 ? "" : name.slice(position + 1).toLowerCase();
}

export function detectCategory(
  file: Pick<FileDescriptor, "name" | "type">,
): MediaCategory | null {
  const extension = extensionOf(file.name);

  for (const category of ["image", "audio", "video"] as const) {
    if (EXTENSIONS[category].has(extension)) {
      return category;
    }
  }

  const mimeCategory = file.type?.split("/")[0];
  if (
    mimeCategory === "image" ||
    mimeCategory === "audio" ||
    mimeCategory === "video"
  ) {
    return mimeCategory;
  }

  return null;
}

export function validateFileSizes(
  files: ReadonlyArray<FileDescriptor>,
  currentBatchSize = 0,
): { accepted: FileDescriptor[]; errors: string[]; hasLargeFile: boolean } {
  const accepted: FileDescriptor[] = [];
  const errors: string[] = [];
  let total = currentBatchSize;
  let hasLargeFile = false;

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} is over the 500 MB file limit.`);
      continue;
    }

    if (total + file.size > MAX_BATCH_SIZE) {
      errors.push(`${file.name} would exceed the 1 GB batch limit.`);
      continue;
    }

    accepted.push(file);
    total += file.size;
    hasLargeFile ||= file.size > LARGE_FILE_WARNING;
  }

  return { accepted, errors, hasLargeFile };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
