import { Capacitor } from "@capacitor/core";
import { createBrowserStorageBackend } from "./browser-backend";
import { createMemoryBackend } from "./memory-backend";
import type { JsonFileBackend } from "../core/repository";
import { createCapacitorFilesystemBackend } from "./capacitor-backend";

export interface NativeBridge {
  storage: JsonFileBackend;
}

declare global {
  interface Window {
    tasteLedgerNative?: NativeBridge;
  }
}

export async function createRuntimeBackend(): Promise<JsonFileBackend> {
  if (typeof window !== "undefined" && window.tasteLedgerNative?.storage) {
    return window.tasteLedgerNative.storage;
  }

  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    return createCapacitorFilesystemBackend();
  }

  if (typeof window !== "undefined" && hasFunctionalLocalStorage()) {
    return createBrowserStorageBackend();
  }

  if (typeof window !== "undefined") {
    const globalWindow = window as typeof window & {
      __tasteLedgerMemoryBackend?: JsonFileBackend;
    };

    if (!globalWindow.__tasteLedgerMemoryBackend) {
      globalWindow.__tasteLedgerMemoryBackend = createMemoryBackend();
    }

    return globalWindow.__tasteLedgerMemoryBackend;
  }

  return createBrowserStorageBackend();
}

function hasFunctionalLocalStorage(): boolean {
  try {
    const storage = window.localStorage as Partial<Storage>;
    return (
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    );
  } catch {
    return false;
  }
}
