export type MediaCategory = "image" | "audio" | "video";

export type OutputFormat =
  | "png"
  | "jpeg"
  | "webp"
  | "mp3"
  | "wav"
  | "ogg"
  | "flac"
  | "mp4"
  | "webm"
  | "gif";

export type QualityPreset = "small" | "balanced" | "high";

export type QueueStatus =
  | "pending"
  | "converting"
  | "done"
  | "error"
  | "cancelled";

export interface QueueItem {
  id: string;
  file: File;
  category: MediaCategory;
  status: QueueStatus;
  progress: number;
  error?: string;
  result?: ConvertedFile;
}

export interface ConvertedFile {
  name: string;
  blob: Blob;
  url: string;
}

export interface FileDescriptor {
  name: string;
  size: number;
  type?: string;
}
