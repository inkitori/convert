import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/convert/",
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg"],
  },
  build: {
    target: "es2022",
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
