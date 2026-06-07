import type { OutputFormat, QualityPreset } from "./types";

const AUDIO_BITRATE: Record<QualityPreset, string> = {
  small: "128k",
  balanced: "192k",
  high: "320k",
};

const VIDEO_AUDIO_BITRATE: Record<QualityPreset, string> = {
  small: "96k",
  balanced: "160k",
  high: "256k",
};

export function buildFFmpegCommand(
  input: string,
  output: string,
  format: OutputFormat,
  quality: QualityPreset,
): string[] {
  switch (format) {
    case "mp3":
      return [
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        AUDIO_BITRATE[quality],
        output,
      ];
    case "wav":
      return ["-i", input, "-map", "0:a:0", "-vn", "-c:a", "pcm_s16le", output];
    case "ogg": {
      const qualityValue = { small: "3", balanced: "5", high: "8" }[quality];
      return [
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "libvorbis",
        "-q:a",
        qualityValue,
        output,
      ];
    }
    case "flac": {
      const compression = { small: "5", balanced: "8", high: "12" }[quality];
      return [
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "flac",
        "-compression_level",
        compression,
        output,
      ];
    }
    case "mp4": {
      const crf = { small: "30", balanced: "23", high: "18" }[quality];
      return [
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        VIDEO_AUDIO_BITRATE[quality],
        "-movflags",
        "+faststart",
        output,
      ];
    }
    case "webm": {
      const crf = { small: "40", balanced: "32", high: "24" }[quality];
      return [
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libvpx-vp9",
        "-crf",
        crf,
        "-b:v",
        "0",
        "-row-mt",
        "1",
        "-c:a",
        "libopus",
        "-b:a",
        VIDEO_AUDIO_BITRATE[quality],
        output,
      ];
    }
    case "gif": {
      const settings = {
        small: { fps: 8, width: 480, colors: 96 },
        balanced: { fps: 12, width: 720, colors: 160 },
        high: { fps: 18, width: 960, colors: 256 },
      }[quality];
      const filter =
        `fps=${settings.fps},` +
        `scale=${settings.width}:-1:force_original_aspect_ratio=decrease:flags=lanczos,` +
        "split[original][palette_source];" +
        `[palette_source]palettegen=max_colors=${settings.colors}[palette];` +
        "[original][palette]paletteuse=dither=bayer";
      return ["-i", input, "-filter_complex", filter, "-an", output];
    }
    default:
      throw new Error(`Unsupported media output: ${format}`);
  }
}
