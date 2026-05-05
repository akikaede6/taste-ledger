import type { JsonFileBackend } from "../core/repository";

export function createMemoryBackend(): JsonFileBackend {
  const textFiles = new Map<string, string>();
  const byteFiles = new Map<string, Uint8Array>();

  return {
    async ensureDirectory() {
      return;
    },

    async readText(path) {
      return textFiles.get(path) ?? null;
    },

    async writeTextAtomic(path, content) {
      textFiles.set(path, content);
    },

    async readBytes(path) {
      return byteFiles.get(path) ?? null;
    },

    async writeBytesAtomic(path, content) {
      byteFiles.set(path, new Uint8Array(content));
    },

    async deletePath(path) {
      textFiles.delete(path);
      byteFiles.delete(path);
    },

    async exists(path) {
      return textFiles.has(path) || byteFiles.has(path);
    },
  };
}
