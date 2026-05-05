import { createEmptyLibrary, type Library } from "./model";
import {
  createCategory,
  createRanking,
  createWork,
  deleteCategory,
  deleteRanking,
  deleteWork,
  moveRankingWork,
  renameCategory,
  sortCategoriesByRecentUpdate,
  sortRankingsByRecentUpdate,
  type RankingInput,
  type RankingUpdateInput,
  type WorkUpdateInput,
  updateWork,
  updateRanking,
} from "./library-actions";
import type { LibraryRepository } from "./repository";

export interface LibraryState {
  status: "loading" | "ready" | "error";
  library: Library;
  selectedCategoryId: string | null;
  selectedWorkId: string | null;
  selectedRankingId: string | null;
  errorMessage: string | null;
}

export interface LibraryController {
  getState(): LibraryState;
  load(): Promise<void>;
  selectCategory(categoryId: string | null): void;
  selectWork(workId: string | null): void;
  selectRanking(rankingId: string | null): void;
  createCategory(name: string): Promise<void>;
  renameSelectedCategory(name: string): Promise<void>;
  deleteSelectedCategory(): Promise<void>;
  createWork(title: string): Promise<void>;
  updateSelectedWork(input: WorkUpdateInput): Promise<void>;
  deleteSelectedWork(): Promise<void>;
  storeSelectedWorkCover(fileName: string, bytes: Uint8Array): Promise<void>;
  createRanking(input: RankingInput): Promise<void>;
  updateSelectedRanking(input: RankingUpdateInput): Promise<void>;
  deleteSelectedRanking(): Promise<void>;
  moveSelectedRankingWork(workId: string, direction: -1 | 1): Promise<void>;
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
    selectedRankingId: null,
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
  ): Pick<
    LibraryState,
    "selectedCategoryId" | "selectedWorkId" | "selectedRankingId"
  > {
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

    const rankingId =
      state.selectedRankingId &&
      library.rankings.some(
        (ranking) =>
          ranking.id === state.selectedRankingId &&
          ranking.categoryId === categoryId,
      )
        ? state.selectedRankingId
        : categoryId
          ? (sortRankingsByRecentUpdate(
              library.rankings.filter(
                (ranking) => ranking.categoryId === categoryId,
              ),
            )[0]?.id ?? null)
          : null;

    return {
      selectedCategoryId: categoryId,
      selectedWorkId: workId,
      selectedRankingId: rankingId,
    };
  }

  async function saveLibrary(
    library: Library,
    selectionOverride?: Pick<
      LibraryState,
      "selectedCategoryId" | "selectedWorkId" | "selectedRankingId"
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
        selectedRankingId: selection.selectedRankingId,
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
        selectedRankingId: selection.selectedRankingId,
        errorMessage: null,
      });
    } catch (error) {
      setState({
        status: "error",
        library: createEmptyLibrary(),
        selectedCategoryId: null,
        selectedWorkId: null,
        selectedRankingId: null,
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
      const selectedRankingId =
        categoryId === null
          ? null
          : (sortRankingsByRecentUpdate(
              state.library.rankings.filter(
                (ranking) => ranking.categoryId === categoryId,
              ),
            )[0]?.id ?? null);
      setState({
        ...state,
        selectedCategoryId: categoryId,
        selectedWorkId,
        selectedRankingId,
      });
    },

    selectWork(workId) {
      setState({
        ...state,
        selectedWorkId: workId,
      });
    },

    selectRanking(rankingId) {
      if (rankingId === null) {
        setState({
          ...state,
          selectedRankingId: null,
        });
        return;
      }

      const ranking = state.library.rankings.find(
        (item) => item.id === rankingId,
      );

      if (!ranking) {
        return;
      }

      const selectedWorkId =
        ranking.workIds.find((workId) =>
          state.library.works.some(
            (work) =>
              work.id === workId && work.categoryId === ranking.categoryId,
          ),
        ) ??
        state.library.works.find(
          (work) => work.categoryId === ranking.categoryId,
        )?.id ??
        null;

      setState({
        ...state,
        selectedCategoryId: ranking.categoryId,
        selectedWorkId,
        selectedRankingId: rankingId,
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
        selectedRankingId: state.selectedRankingId,
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

    async createRanking(input) {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        throw new Error("Category not selected.");
      }

      const result = createRanking(state.library, {
        ...input,
        categoryId,
      });

      await saveLibrary(result.library, {
        selectedCategoryId: categoryId,
        selectedWorkId:
          state.library.works.find((work) => work.categoryId === categoryId)
            ?.id ?? null,
        selectedRankingId: result.ranking.id,
      });
    },

    async updateSelectedRanking(input) {
      const rankingId = state.selectedRankingId;

      if (!rankingId) {
        return;
      }

      const nextLibrary = updateRanking(state.library, rankingId, input);
      await saveLibrary(nextLibrary);
    },

    async deleteSelectedRanking() {
      const rankingId = state.selectedRankingId;

      if (!rankingId) {
        return;
      }

      const nextLibrary = deleteRanking(state.library, rankingId);
      await saveLibrary(nextLibrary);
    },

    async moveSelectedRankingWork(workId, direction) {
      const rankingId = state.selectedRankingId;

      if (!rankingId) {
        return;
      }

      const nextLibrary = moveRankingWork(
        state.library,
        rankingId,
        workId,
        direction,
      );
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
