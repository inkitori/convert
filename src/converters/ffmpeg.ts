import { buildFFmpegCommand } from "../commands";
import { outputExtension } from "../naming";
import type { OutputFormat, QualityPreset } from "../types";

type ProgressCallback = (progress: number) => void;
type ProgressEvent = { progress: number };

interface FFmpegApi {
  load(config: { coreURL: string; wasmURL: string }): Promise<boolean>;
  on(event: "progress", callback: (event: ProgressEvent) => void): void;
  off(event: "progress", callback: (event: ProgressEvent) => void): void;
  writeFile(path: string, data: Uint8Array): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
  terminate(): void;
}

export class MediaConverter {
  private ffmpeg: FFmpegApi | null = null;
  private loadPromise: Promise<FFmpegApi> | null = null;
  private fetchFile: ((file: Blob | File | string) => Promise<Uint8Array>) | null =
    null;

  private async ensureLoaded(): Promise<FFmpegApi> {
    if (this.ffmpeg) return this.ffmpeg;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const [{ FFmpeg }, { fetchFile }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg() as unknown as FFmpegApi;
      const coreBase = new URL(
        `${import.meta.env.BASE_URL}ffmpeg/`,
        window.location.href,
      ).href;

      this.ffmpeg = ffmpeg;
      this.fetchFile = fetchFile;
      await ffmpeg.load({
        coreURL: `${coreBase}ffmpeg-core.js`,
        wasmURL: `${coreBase}ffmpeg-core.wasm`,
      });
      return ffmpeg;
    })();

    try {
      return await this.loadPromise;
    } catch (error) {
      this.ffmpeg = null;
      this.loadPromise = null;
      throw error;
    }
  }

  async convert(
    file: File,
    format: OutputFormat,
    quality: QualityPreset,
    onProgress: ProgressCallback,
    signal: AbortSignal,
  ): Promise<Blob> {
    const token = crypto.randomUUID();
    const inputExtension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase() || "input"
      : "input";
    const inputPath = `${token}.${inputExtension}`;
    const outputPath = `${token}-output.${outputExtension(format)}`;
    let ffmpeg: FFmpegApi | null = null;

    const abort = () => {
      this.ffmpeg?.terminate();
      this.ffmpeg = null;
      this.loadPromise = null;
    };
    signal.addEventListener("abort", abort, { once: true });

    const progressHandler = ({ progress }: ProgressEvent) => {
      if (Number.isFinite(progress)) {
        onProgress(Math.max(0, Math.min(1, progress)));
      }
    };

    try {
      ffmpeg = await this.ensureLoaded();
      if (signal.aborted) throw new DOMException("Conversion cancelled", "AbortError");
      if (!this.fetchFile) throw new Error("The media engine did not initialize.");

      ffmpeg.on("progress", progressHandler);
      await ffmpeg.writeFile(inputPath, await this.fetchFile(file));
      const exitCode = await ffmpeg.exec(
        buildFFmpegCommand(inputPath, outputPath, format, quality),
      );
      if (exitCode !== 0) throw new Error(`FFmpeg stopped with exit code ${exitCode}.`);

      const data = await ffmpeg.readFile(outputPath);
      if (typeof data === "string") throw new Error("FFmpeg returned invalid output.");
      onProgress(1);
      return new Blob([data.slice().buffer], { type: outputMimeType(format) });
    } catch (error) {
      if (signal.aborted) {
        throw new DOMException("Conversion cancelled", "AbortError");
      }
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      if (ffmpeg && this.ffmpeg === ffmpeg) {
        ffmpeg.off("progress", progressHandler);
        await Promise.allSettled([
          ffmpeg.deleteFile(inputPath),
          ffmpeg.deleteFile(outputPath),
        ]);
      }
    }
  }
}

function outputMimeType(format: OutputFormat): string {
  const mimeTypes: Partial<Record<OutputFormat, string>> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    mp4: "video/mp4",
    webm: "video/webm",
    gif: "image/gif",
  };
  return mimeTypes[format] ?? "application/octet-stream";
}
