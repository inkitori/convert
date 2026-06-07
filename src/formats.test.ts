import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTPUT,
  MAX_BATCH_SIZE,
  MAX_FILE_SIZE,
  detectCategory,
  formatBytes,
  validateFileSizes,
} from "./formats";

it("uses PNG as the default image output", () => {
  expect(DEFAULT_OUTPUT.image).toBe("png");
});

describe("detectCategory", () => {
  it("detects supported file extensions without relying on MIME data", () => {
    expect(detectCategory({ name: "photo.JPEG" })).toBe("image");
    expect(detectCategory({ name: "track.flac" })).toBe("audio");
    expect(detectCategory({ name: "clip.mkv" })).toBe("video");
  });

  it("falls back to supported MIME categories", () => {
    expect(detectCategory({ name: "recording", type: "audio/aac" })).toBe("audio");
    expect(detectCategory({ name: "notes.txt", type: "text/plain" })).toBeNull();
  });
});

describe("validateFileSizes", () => {
  it("rejects files over the individual limit", () => {
    const result = validateFileSizes([{ name: "huge.mp4", size: MAX_FILE_SIZE + 1 }]);
    expect(result.accepted).toHaveLength(0);
    expect(result.errors[0]).toContain("500 MB");
  });

  it("accepts files only while the batch remains within its limit", () => {
    const result = validateFileSizes(
      [
        { name: "one.mp4", size: 100 },
        { name: "two.mp4", size: 100 },
      ],
      MAX_BATCH_SIZE - 150,
    );
    expect(result.accepted.map((file) => file.name)).toEqual(["one.mp4"]);
    expect(result.errors[0]).toContain("1 GB");
  });
});

describe("formatBytes", () => {
  it("formats compact human-readable values", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
  });
});
