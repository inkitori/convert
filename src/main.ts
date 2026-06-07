import "./style.css";
import { convertImage } from "./converters/image";
import { MediaConverter } from "./converters/ffmpeg";
import {
  ACCEPTED_EXTENSIONS,
  DEFAULT_OUTPUT,
  OUTPUTS,
  detectCategory,
  formatBytes,
  validateFileSizes,
} from "./formats";
import { outputName } from "./naming";
import type {
  MediaCategory,
  OutputFormat,
  QualityPreset,
  QueueItem,
} from "./types";

const fileInput = requiredElement<HTMLInputElement>("file-input");
const dropZone = requiredElement<HTMLButtonElement>("drop-zone");
const workspace = requiredElement<HTMLDivElement>("workspace");
const formatSelect = requiredElement<HTMLSelectElement>("format-select");
const qualitySelect = requiredElement<HTMLSelectElement>("quality-select");
const addFilesButton = requiredElement<HTMLButtonElement>("add-files");
const clearButton = requiredElement<HTMLButtonElement>("clear-button");
const fileList = requiredElement<HTMLUListElement>("file-list");
const queueSummary = requiredElement<HTMLSpanElement>("queue-summary");
const notice = requiredElement<HTMLDivElement>("notice");
const progressStatus = requiredElement<HTMLDivElement>("progress-status");
const convertButton = requiredElement<HTMLButtonElement>("convert-button");
const cancelButton = requiredElement<HTMLButtonElement>("cancel-button");
const zipButton = requiredElement<HTMLButtonElement>("zip-button");

fileInput.accept = ACCEPTED_EXTENSIONS;

let queue: QueueItem[] = [];
let category: MediaCategory | null = null;
let converting = false;
let batchController: AbortController | null = null;
const mediaConverter = new MediaConverter();

dropZone.addEventListener("click", () => fileInput.click());
addFilesButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files) addFiles([...fileInput.files]);
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!converting) dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  if (!converting && event.dataTransfer?.files) {
    addFiles([...event.dataTransfer.files]);
  }
});

formatSelect.addEventListener("change", resetResults);
qualitySelect.addEventListener("change", resetResults);
clearButton.addEventListener("click", clearQueue);
convertButton.addEventListener("click", convertQueue);
cancelButton.addEventListener("click", cancelConversion);
zipButton.addEventListener("click", downloadZip);

function addFiles(files: File[]): void {
  if (converting || files.length === 0) return;

  const categorized = files.map((file) => ({
    file,
    category: detectCategory(file),
  }));
  const unsupported = categorized.filter((entry) => !entry.category);
  const supported = categorized.filter(
    (entry): entry is { file: File; category: MediaCategory } =>
      entry.category !== null,
  );

  if (unsupported.length > 0) {
    showNotice(
      `Unsupported: ${unsupported.map((entry) => entry.file.name).join(", ")}`,
      "error",
    );
  }
  if (supported.length === 0) return;

  const incomingCategories = new Set(supported.map((entry) => entry.category));
  if (incomingCategories.size > 1) {
    showNotice("Use one file type per batch: images, audio, or video.", "error");
    return;
  }

  const incomingCategory = supported[0].category;
  if (category && category !== incomingCategory) {
    showNotice(`This batch already contains ${category} files. Clear it first.`, "error");
    return;
  }

  const currentSize = queue.reduce((total, item) => total + item.file.size, 0);
  const validation = validateFileSizes(
    supported.map((entry) => entry.file),
    currentSize,
  );
  const acceptedFiles = new Set(validation.accepted);

  if (validation.errors.length > 0) {
    showNotice(validation.errors.join(" "), "error");
  } else if (validation.hasLargeFile) {
    showNotice(
      "Large media files can use significant memory and may take several minutes.",
      "warning",
    );
  } else if (unsupported.length === 0) {
    hideNotice();
  }

  const accepted = supported.filter((entry) => acceptedFiles.has(entry.file));
  if (accepted.length === 0) return;

  if (!category) {
    category = incomingCategory;
    populateFormats(category);
  }

  queue.push(
    ...accepted.map(({ file, category: itemCategory }) => ({
      id: crypto.randomUUID(),
      file,
      category: itemCategory,
      status: "pending" as const,
      progress: 0,
    })),
  );
  render();
}

function populateFormats(nextCategory: MediaCategory): void {
  formatSelect.replaceChildren(
    ...OUTPUTS[nextCategory].map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === DEFAULT_OUTPUT[nextCategory];
      return option;
    }),
  );
}

function resetResults(): void {
  if (converting) return;
  for (const item of queue) {
    if (item.result) URL.revokeObjectURL(item.result.url);
    item.result = undefined;
    item.status = "pending";
    item.progress = 0;
    item.error = undefined;
  }
  render();
}

async function convertQueue(): Promise<void> {
  if (converting || !category || queue.length === 0) return;
  converting = true;
  batchController = new AbortController();
  const signal = batchController.signal;
  const format = formatSelect.value as OutputFormat;
  const quality = qualitySelect.value as QualityPreset;
  const usedNames = new Set(
    queue.flatMap((item) => (item.result ? [item.result.name.toLowerCase()] : [])),
  );

  for (const item of queue) {
    if (!["pending", "error", "cancelled"].includes(item.status)) continue;
    if (signal.aborted) {
      item.status = "cancelled";
      continue;
    }

    item.status = "converting";
    item.error = undefined;
    item.progress = 0;
    render();
    progressStatus.textContent = `Converting ${item.file.name}`;

    try {
      const updateProgress = (value: number) => {
        item.progress = value;
        updateQueueItem(item);
      };
      const blob =
        item.category === "image"
          ? await convertImage(item.file, format, quality, signal)
          : await mediaConverter.convert(item.file, format, quality, updateProgress, signal);
      const name = outputName(item.file.name, format, usedNames);
      item.result = { name, blob, url: URL.createObjectURL(blob) };
      item.status = "done";
      item.progress = 1;
    } catch (error) {
      if (isAbortError(error) || signal.aborted) {
        item.status = "cancelled";
      } else {
        item.status = "error";
        item.error = readableError(error);
      }
    }
    render();
  }

  if (signal.aborted) {
    for (const item of queue) {
      if (item.status === "pending") item.status = "cancelled";
    }
    showNotice("Conversion cancelled. Completed files are still available.", "warning");
  } else {
    const failures = queue.filter((item) => item.status === "error").length;
    showNotice(
      failures > 0
        ? `Finished with ${failures} failed ${failures === 1 ? "file" : "files"}.`
        : "Conversion complete.",
      failures > 0 ? "warning" : "success",
    );
  }

  converting = false;
  batchController = null;
  progressStatus.textContent = "";
  render();
}

function cancelConversion(): void {
  batchController?.abort();
  cancelButton.disabled = true;
  cancelButton.textContent = "Cancelling…";
}

async function downloadZip(): Promise<void> {
  const completed = queue.filter((item) => item.result);
  if (completed.length === 0) return;

  zipButton.disabled = true;
  zipButton.textContent = "Building ZIP…";
  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const item of completed) {
      if (item.result) zip.file(item.result.name, item.result.blob);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    downloadBlob(blob, "converted-files.zip");
  } catch (error) {
    showNotice(`Could not build ZIP: ${readableError(error)}`, "error");
  } finally {
    zipButton.disabled = false;
    zipButton.textContent = "Download ZIP";
  }
}

function clearQueue(): void {
  if (converting) return;
  for (const item of queue) {
    if (item.result) URL.revokeObjectURL(item.result.url);
  }
  queue = [];
  category = null;
  hideNotice();
  render();
}

function render(): void {
  workspace.hidden = queue.length === 0;
  dropZone.hidden = queue.length > 0;
  fileList.replaceChildren(...queue.map(createQueueItem));

  const totalSize = queue.reduce((total, item) => total + item.file.size, 0);
  queueSummary.textContent = `${queue.length} ${queue.length === 1 ? "file" : "files"} · ${formatBytes(totalSize)}`;

  const completed = queue.filter((item) => item.status === "done").length;
  const convertible = queue.some((item) =>
    ["pending", "error", "cancelled"].includes(item.status),
  );
  convertButton.hidden = converting || !convertible;
  convertButton.disabled = !convertible;
  convertButton.textContent = completed > 0 ? "Convert remaining" : "Convert";
  cancelButton.hidden = !converting;
  cancelButton.disabled = false;
  cancelButton.textContent = "Cancel";
  zipButton.hidden = completed < 2 || converting;

  formatSelect.disabled = converting;
  qualitySelect.disabled = converting;
  addFilesButton.disabled = converting;
  clearButton.disabled = converting;
}

function createQueueItem(item: QueueItem): HTMLLIElement {
  const row = document.createElement("li");
  row.className = `file-row status-${item.status}`;
  row.dataset.id = item.id;

  const info = document.createElement("span");
  info.className = "file-info";
  const name = document.createElement("strong");
  name.textContent = item.file.name;
  const detail = document.createElement("span");
  detail.className = "file-detail";
  detail.textContent = item.error ?? statusText(item);
  info.append(name, detail);

  const action = document.createElement("span");
  action.className = "file-action";
  if (item.result) {
    const link = document.createElement("a");
    link.href = item.result.url;
    link.download = item.result.name;
    link.className = "download-link";
    link.textContent = "Download";
    action.append(link);
  } else if (item.status === "converting") {
    const progress = document.createElement("span");
    progress.className = "progress-value";
    progress.textContent = `${Math.round(item.progress * 100)}%`;
    action.append(progress);
  } else {
    const status = document.createElement("span");
    status.className = "status-mark";
    status.textContent =
      item.status === "error" ? "Failed" : item.status === "cancelled" ? "Stopped" : "Ready";
    action.append(status);
  }

  const track = document.createElement("span");
  track.className = "progress-track";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(item.progress * 100)}%`;
  track.append(fill);

  row.append(info, action, track);
  return row;
}

function updateQueueItem(item: QueueItem): void {
  const row = fileList.querySelector<HTMLElement>(`[data-id="${item.id}"]`);
  const progress = row?.querySelector<HTMLElement>(".progress-value");
  const fill = row?.querySelector<HTMLElement>(".progress-track span");
  const percent = `${Math.round(item.progress * 100)}%`;
  if (progress) progress.textContent = percent;
  if (fill) fill.style.width = percent;
}

function statusText(item: QueueItem): string {
  if (item.status === "done" && item.result) {
    return `${formatBytes(item.file.size)} → ${formatBytes(item.result.blob.size)}`;
  }
  if (item.status === "converting") return "Converting locally…";
  if (item.status === "cancelled") return "Conversion cancelled";
  return formatBytes(item.file.size);
}

function showNotice(
  message: string,
  tone: "error" | "warning" | "success",
): void {
  notice.hidden = false;
  notice.className = `notice notice-${tone}`;
  notice.textContent = message;
}

function hideNotice(): void {
  notice.hidden = true;
  notice.textContent = "";
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown conversion error.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

render();
