import { createEmptyLibrary, type Library } from "./model";
import {
  createCategory,
  createWork,
  deleteCategory,
  deleteWork,
  renameCategory,
  sortCategoriesByRecentUpdate,
  type WorkUpdateInput,
  updateWork,
} from "./library-actions";
import type { LibraryRepository } from "./repository";

export interface LibraryState {
  status: "loading" | "ready" | "error";
  library: Library;
  selectedCategoryId: string | null;
  selectedWorkId: string | null;
  errorMessage: string | null;
}

export interface LibraryController {
  getState(): LibraryState;
  load(): Promise<void>;
  selectCategory(categoryId: string | null): void;
  selectWork(workId: string | null): void;
  createCategory(name: string): Promise<void>;
  renameSelectedCategory(name: string): Promise<void>;
  deleteSelectedCategory(): Promise<void>;
  createWork(title: string): Promise<void>;
  updateSelectedWork(input: WorkUpdateInput): Promise<void>;
  deleteSelectedWork(): Promise<void>;
  storeSelectedWorkCover(fileName: string, bytes: Uint8Array): Promise<void>;
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
    selectedWorkId: null,
    errorMessage: null,
  };

  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function setState(next: LibraryState) {
    state = next;
    notify();
  }

  function normalizeSelection(
    library: Library,
  ): Pick<LibraryState, "selectedCategoryId" | "selectedWorkId"> {
    const categoryId =
      state.selectedCategoryId &&
      library.categories.some(
        (category) => category.id === state.selectedCategoryId,
      )
        ? state.selectedCategoryId
        : (library.categories[0]?.id ?? null);

    const workId =
      state.selectedWorkId &&
      library.works.some(
        (work) =>
          work.id === state.selectedWorkId && work.categoryId === categoryId,
      )
        ? state.selectedWorkId
        : categoryId
          ? (library.works.find((work) => work.categoryId === categoryId)?.id ??
            null)
          : null;

    return {
      selectedCategoryId: categoryId,
      selectedWorkId: workId,
    };
  }

  async function saveLibrary(
    library: Library,
    selectionOverride?: Pick<
      LibraryState,
      "selectedCategoryId" | "selectedWorkId"
    >,
  ) {
    try {
      await repository.save(library);
      const selection = selectionOverride ?? normalizeSelection(library);
      setState({
        ...state,
        library,
        status: "ready",
        errorMessage: null,
        selectedCategoryId: selection.selectedCategoryId,
        selectedWorkId: selection.selectedWorkId,
      });
    } catch (error) {
      setState({
        ...state,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Failed to save library.",
      });
      throw error;
    }
  }

  async function loadLibrary() {
    setState({
      ...state,
      status: "loading",
      errorMessage: null,
    });

    try {
      const result = await repository.load();
      const selection = normalizeSelection(result.library);
      setState({
        status: "ready",
        library: result.library,
        selectedCategoryId: selection.selectedCategoryId,
        selectedWorkId: selection.selectedWorkId,
        errorMessage: null,
      });
    } catch (error) {
      setState({
        status: "error",
        library: createEmptyLibrary(),
        selectedCategoryId: null,
        selectedWorkId: null,
        errorMessage:
          error instanceof Error ? error.message : "Failed to load library.",
      });
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
      const selectedWorkId =
        categoryId === null
          ? null
          : (state.library.works.find((work) => work.categoryId === categoryId)
              ?.id ?? null);
      setState({
        ...state,
        selectedCategoryId: categoryId,
        selectedWorkId,
      });
    },

    selectWork(workId) {
      setState({
        ...state,
        selectedWorkId: workId,
      });
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

    async createWork(title) {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        throw new Error("Category not selected.");
      }

      const result = createWork(state.library, {
        categoryId,
        title,
      });
      await saveLibrary(result.library, {
        selectedCategoryId: categoryId,
        selectedWorkId: result.work.id,
      });
    },

    async updateSelectedWork(input) {
      const workId = state.selectedWorkId;

      if (!workId) {
        return;
      }

      const nextLibrary = updateWork(state.library, workId, input);
      await saveLibrary(nextLibrary);
    },

    async deleteSelectedWork() {
      const workId = state.selectedWorkId;

      if (!workId) {
        return;
      }

      const nextLibrary = deleteWork(state.library, workId);
      await saveLibrary(nextLibrary);
    },

    async storeSelectedWorkCover(fileName, bytes) {
      const workId = state.selectedWorkId;

      if (!workId) {
        return;
      }

      const extension = fileName.split(".").pop() ?? "png";
      const coverImagePath = await repository.storeImage({
        id: `${workId}-${Date.now()}`,
        extension,
        bytes,
      });

      const nextLibrary = updateWork(state.library, workId, {
        coverImagePath,
      });
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
