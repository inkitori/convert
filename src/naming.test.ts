import { describe, expect, it } from "vitest";
import { outputName } from "./naming";

describe("outputName", () => {
  it("changes the extension and resolves duplicate names", () => {
    const used = new Set<string>();
    expect(outputName("photo.png", "webp", used)).toBe("photo.webp");
    expect(outputName("photo.jpg", "webp", used)).toBe("photo-2.webp");
    expect(outputName("photo.jpeg", "webp", used)).toBe("photo-3.webp");
  });

  it("handles extensionless input", () => {
    expect(outputName("recording", "mp3", new Set())).toBe("recording.mp3");
  });
});
