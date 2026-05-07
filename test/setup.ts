import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

beforeEach(() => {
  if (typeof window === "undefined") {
    return;
  }

  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  delete (window as typeof window & { __tasteLedgerMemoryBackend?: unknown })
    .__tasteLedgerMemoryBackend;
});

afterEach(() => {
  cleanup();
});

function clearStorage(storage: Storage) {
  const storageLike = storage as Partial<Storage> & Record<string, unknown>;

  if (typeof storageLike.clear === "function") {
    storageLike.clear();
    return;
  }

  if (
    typeof storageLike.length === "number" &&
    typeof storageLike.key === "function" &&
    typeof storageLike.removeItem === "function"
  ) {
    for (let index = storageLike.length - 1; index >= 0; index -= 1) {
      const key = storageLike.key(index);
      if (key) {
        storageLike.removeItem(key);
      }
    }
    return;
  }

  for (const key of Object.keys(storageLike)) {
    delete storageLike[key];
  }
}
