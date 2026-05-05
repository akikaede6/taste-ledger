import { createEmptyLibrary, type Library } from "./model";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  sortCategoriesByRecentUpdate,
} from "./library-actions";
import type { LibraryRepository } from "./repository";

export interface LibraryState {
  status: "loading" | "ready" | "error";
  library: Library;
  selectedCategoryId: string | null;
  errorMessage: string | null;
}

export interface LibraryController {
  getState(): LibraryState;
  load(): Promise<void>;
  selectCategory(categoryId: string | null): void;
  createCategory(name: string): Promise<void>;
  renameSelectedCategory(name: string): Promise<void>;
  deleteSelectedCategory(): Promise<void>;
  refresh(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export function createLibraryController(
  repository: LibraryRepository,
): LibraryController {
  let state: LibraryState = {
    status: "loading",
    library: createEmptyLibrary(),
    selectedCategoryId: null,
    errorMessage: null,
  };

  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  async function saveLibrary(library: Library) {
    await repository.save(library);
    state = {
      ...state,
      library,
      status: "ready",
      errorMessage: null,
      selectedCategoryId:
        state.selectedCategoryId &&
        library.categories.some(
          (category) => category.id === state.selectedCategoryId,
        )
          ? state.selectedCategoryId
          : (library.categories[0]?.id ?? null),
    };
    notify();
  }

  async function loadLibrary() {
    state = {
      ...state,
      status: "loading",
      errorMessage: null,
    };
    notify();

    try {
      const result = await repository.load();
      state = {
        status: "ready",
        library: result.library,
        selectedCategoryId:
          state.selectedCategoryId ?? result.library.categories[0]?.id ?? null,
        errorMessage: null,
      };
      notify();
    } catch (error) {
      state = {
        status: "error",
        library: createEmptyLibrary(),
        selectedCategoryId: null,
        errorMessage:
          error instanceof Error ? error.message : "Failed to load library.",
      };
      notify();
    }
  }

  const controller: LibraryController = {
    getState() {
      return state;
    },

    load() {
      return loadLibrary();
    },

    selectCategory(categoryId) {
      state = {
        ...state,
        selectedCategoryId: categoryId,
      };
      notify();
    },

    async createCategory(name) {
      const nextLibrary = createCategoryAction(state.library, name);
      await saveLibrary(nextLibrary);
    },

    async renameSelectedCategory(name) {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        return;
      }

      const nextLibrary = renameCategory(state.library, categoryId, name);
      await saveLibrary(nextLibrary);
    },

    async deleteSelectedCategory() {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        return;
      }

      const nextLibrary = deleteCategory(state.library, categoryId);
      await saveLibrary(nextLibrary);
    },

    refresh() {
      return loadLibrary();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return controller;
}

function createCategoryAction(library: Library, name: string): Library {
  const next = createCategory(library, { name });
  next.categories = sortCategoriesByRecentUpdate(next.categories);
  return next;
}
