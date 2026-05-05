import type { JsonFileBackend } from "../core/repository";

const TEXT_PREFIX = "ranking:text:";
const BYTES_PREFIX = "ranking:bytes:";

export function createBrowserStorageBackend(): JsonFileBackend {
  return {
    async ensureDirectory() {
      return;
    },

    async readText(path) {
      const value = storageGet(textKey(path));
      return value === null ? null : value;
    },

    async writeTextAtomic(path, content) {
      storageSet(textKey(path), content);
    },

    async readBytes(path) {
      const value = storageGet(bytesKey(path));
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
      storageSet(bytesKey(path), bytesToBase64(content));
    },

    async deletePath(path) {
      storageDelete(textKey(path));
      storageDelete(bytesKey(path));
    },

    async exists(path) {
      return (
        storageGet(textKey(path)) !== null ||
        storageGet(bytesKey(path)) !== null
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

function storageGet(key: string): string | null {
  const storage = window.localStorage as Partial<Storage> &
    Record<string, unknown>;

  if (typeof storage.getItem === "function") {
    return storage.getItem(key);
  }

  const value = storage[key];
  return typeof value === "string" ? value : null;
}

function storageSet(key: string, value: string) {
  const storage = window.localStorage as Partial<Storage> &
    Record<string, unknown>;

  if (typeof storage.setItem === "function") {
    storage.setItem(key, value);
    return;
  }

  storage[key] = value;
}

function storageDelete(key: string) {
  const storage = window.localStorage as Partial<Storage> &
    Record<string, unknown>;

  if (typeof storage.removeItem === "function") {
    storage.removeItem(key);
    return;
  }

  delete storage[key];
}
