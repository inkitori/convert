import { describe, expect, it } from "vitest";
import { buildFFmpegCommand } from "./commands";

describe("buildFFmpegCommand", () => {
  it("uses the selected MP3 bitrate preset", () => {
    const command = buildFFmpegCommand("in.wav", "out.mp3", "mp3", "high");
    expect(command).toContain("320k");
    expect(command).toContain("libmp3lame");
  });

  it("maps MP4 quality to H.264 CRF", () => {
    const command = buildFFmpegCommand("in.mov", "out.mp4", "mp4", "balanced");
    expect(command.slice(command.indexOf("-crf"), command.indexOf("-crf") + 2)).toEqual([
      "-crf",
      "23",
    ]);
    expect(command).toContain("yuv420p");
  });

  it("builds a palette-based GIF command", () => {
    const command = buildFFmpegCommand("in.mp4", "out.gif", "gif", "small");
    expect(command.join(" ")).toContain("palettegen=max_colors=96");
    expect(command.join(" ")).toContain("fps=8");
  });
});
