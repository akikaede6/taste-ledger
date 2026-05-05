import type { JsonFileBackend } from "../core/repository";

const TEXT_PREFIX = "ranking:text:";
const BYTES_PREFIX = "ranking:bytes:";

export function createBrowserStorageBackend(): JsonFileBackend {
  return {
    async ensureDirectory() {
      return;
    },

    async readText(path) {
      const value = window.localStorage.getItem(textKey(path));
      return value === null ? null : value;
    },

    async writeTextAtomic(path, content) {
      window.localStorage.setItem(textKey(path), content);
    },

    async readBytes(path) {
      const value = window.localStorage.getItem(bytesKey(path));
      if (value === null) {
        return null;
      }

      const binary = window.atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    },

    async writeBytesAtomic(path, content) {
      window.localStorage.setItem(bytesKey(path), bytesToBase64(content));
    },

    async deletePath(path) {
      window.localStorage.removeItem(textKey(path));
      window.localStorage.removeItem(bytesKey(path));
    },

    async exists(path) {
      return (
        window.localStorage.getItem(textKey(path)) !== null ||
        window.localStorage.getItem(bytesKey(path)) !== null
      );
    },
  };
}

function textKey(path: string): string {
  return `${TEXT_PREFIX}${path}`;
}

function bytesKey(path: string): string {
  return `${BYTES_PREFIX}${path}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
}
