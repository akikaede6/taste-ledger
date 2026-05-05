import { createBrowserStorageBackend } from "./browser-backend";
import type { JsonFileBackend } from "../core/repository";

export interface NativeBridge {
  storage: JsonFileBackend;
}

declare global {
  interface Window {
    rankingNative?: NativeBridge;
  }
}

export async function createRuntimeBackend(): Promise<JsonFileBackend> {
  if (typeof window !== "undefined" && window.rankingNative?.storage) {
    return window.rankingNative.storage;
  }

  return createBrowserStorageBackend();
}
