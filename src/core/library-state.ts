import {
  createEmptyLibrary,
  type Library,
  type RatingDimensionTemplate,
  type TierLevelId,
  type TierList,
} from "./model";
import {
  createCategory,
  createRanking,
  createTierList,
  createWork,
  deleteCategory,
  deleteRanking,
  deleteTierList,
  deleteWork,
  moveRankingWork,
  moveTierListWork,
  renameCategory,
  removeTierListWork,
  sortCategoriesByRecentUpdate,
  sortRankingsByRecentUpdate,
  sortTierListsByRecentUpdate,
  type TierListInput,
  type TierListUpdateInput,
  type RankingInput,
  type RankingUpdateInput,
  type WorkUpdateInput,
  updateCategoryRatingDimensions,
  updateWork,
  updateRanking,
  updateTierList,
} from "./library-actions";
import { getRankingWorks } from "./ranking";
import { createDisplayImageDataUrl } from "./image-utils";
import {
  createRankingShareImage,
  createTierListShareImage,
  createWorkShareImage,
  type ShareImageFile,
  type WorkShareVariant,
} from "./share-export";
import type { LibraryRepository } from "./repository";

export interface LibraryState {
  status: "loading" | "ready" | "error";
  library: Library;
  selectedCategoryId: string | null;
  selectedWorkId: string | null;
  selectedRankingId: string | null;
  selectedTierListId: string | null;
  errorMessage: string | null;
}

export interface LibraryController {
  getState(): LibraryState;
  load(): Promise<void>;
  selectCategory(categoryId: string | null): void;
  selectWork(workId: string | null): void;
  selectRanking(rankingId: string | null): void;
  selectTierList(tierListId: string | null): void;
  createCategory(name: string): Promise<void>;
  renameSelectedCategory(name: string): Promise<void>;
  updateSelectedCategoryRatingDimensions(
    templates: RatingDimensionTemplate[],
  ): Promise<void>;
  deleteSelectedCategory(): Promise<void>;
  createWork(title: string): Promise<void>;
  updateSelectedWork(input: WorkUpdateInput): Promise<void>;
  deleteSelectedWork(): Promise<void>;
  storeSelectedWorkCover(fileName: string, bytes: Uint8Array): Promise<void>;
  prepareSelectedWorkShare(variant: WorkShareVariant): Promise<ShareImageFile>;
  exportSelectedWorkShare(variant: WorkShareVariant): Promise<string>;
  prepareSelectedRankingShare(): Promise<ShareImageFile>;
  exportSelectedRankingShare(): Promise<string>;
  prepareSelectedTierListShare(): Promise<ShareImageFile>;
  exportSelectedTierListShare(): Promise<string>;
  createRanking(input: RankingInput): Promise<void>;
  updateSelectedRanking(input: RankingUpdateInput): Promise<void>;
  deleteSelectedRanking(): Promise<void>;
  moveSelectedRankingWork(workId: string, direction: -1 | 1): Promise<void>;
  createTierList(input: TierListInput): Promise<void>;
  updateSelectedTierList(input: TierListUpdateInput): Promise<void>;
  deleteSelectedTierList(): Promise<void>;
  moveSelectedTierListWork(workId: string, levelId: TierLevelId): Promise<void>;
  removeSelectedTierListWork(workId: string): Promise<void>;
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
    selectedTierListId: null,
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
    | "selectedCategoryId"
    | "selectedWorkId"
    | "selectedRankingId"
    | "selectedTierListId"
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

    const tierListId =
      state.selectedTierListId &&
      library.tierLists.some(
        (tierList) =>
          tierList.id === state.selectedTierListId &&
          tierList.categoryId === categoryId,
      )
        ? state.selectedTierListId
        : categoryId
          ? (sortTierListsByRecentUpdate(
              library.tierLists.filter(
                (tierList) => tierList.categoryId === categoryId,
              ),
            )[0]?.id ?? null)
          : null;

    return {
      selectedCategoryId: categoryId,
      selectedWorkId: workId,
      selectedRankingId: rankingId,
      selectedTierListId: tierListId,
    };
  }

  async function saveLibrary(
    library: Library,
    selectionOverride?: Pick<
      LibraryState,
      | "selectedCategoryId"
      | "selectedWorkId"
      | "selectedRankingId"
      | "selectedTierListId"
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
        selectedTierListId: selection.selectedTierListId,
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
        selectedTierListId: selection.selectedTierListId,
        errorMessage: null,
      });
    } catch (error) {
      setState({
        status: "error",
        library: createEmptyLibrary(),
        selectedCategoryId: null,
        selectedWorkId: null,
        selectedRankingId: null,
        selectedTierListId: null,
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
      const selectedTierListId =
        categoryId === null
          ? null
          : (sortTierListsByRecentUpdate(
              state.library.tierLists.filter(
                (tierList) => tierList.categoryId === categoryId,
              ),
            )[0]?.id ?? null);
      setState({
        ...state,
        selectedCategoryId: categoryId,
        selectedWorkId,
        selectedRankingId,
        selectedTierListId,
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
        selectedTierListId:
          state.library.tierLists.find(
            (tierList) => tierList.categoryId === ranking.categoryId,
          )?.id ?? null,
      });
    },

    selectTierList(tierListId) {
      if (tierListId === null) {
        setState({
          ...state,
          selectedTierListId: null,
        });
        return;
      }

      const tierList = state.library.tierLists.find(
        (item) => item.id === tierListId,
      );

      if (!tierList) {
        return;
      }

      setState({
        ...state,
        selectedCategoryId: tierList.categoryId,
        selectedWorkId:
          state.library.works.find(
            (work) => work.categoryId === tierList.categoryId,
          )?.id ?? null,
        selectedRankingId:
          sortRankingsByRecentUpdate(
            state.library.rankings.filter(
              (ranking) => ranking.categoryId === tierList.categoryId,
            ),
          )[0]?.id ?? null,
        selectedTierListId: tierListId,
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

    async updateSelectedCategoryRatingDimensions(templates) {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        return;
      }

      const nextLibrary = updateCategoryRatingDimensions(
        state.library,
        categoryId,
        templates,
      );
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
        selectedTierListId: state.selectedTierListId,
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

    async prepareSelectedWorkShare(variant) {
      const workId = state.selectedWorkId;

      if (!workId) {
        throw new Error("Work not selected.");
      }

      const work = state.library.works.find((item) => item.id === workId);

      if (!work) {
        throw new Error("Work not found.");
      }

      const coverDataUrl =
        work.coverImagePath &&
        (await buildCoverDataUrl(repository, work.coverImagePath));

      return createWorkShareImage(
        state.library,
        workId,
        variant,
        coverDataUrl ?? null,
      );
    },

    async exportSelectedWorkShare(variant) {
      const image = await controller.prepareSelectedWorkShare(variant);
      return repository.storeExport({
        kind: "works",
        id: image.id,
        extension: image.extension,
        bytes: image.bytes,
      });
    },

    async prepareSelectedRankingShare() {
      const rankingId = state.selectedRankingId;

      if (!rankingId) {
        throw new Error("Ranking not selected.");
      }

      const ranking = state.library.rankings.find(
        (item) => item.id === rankingId,
      );

      if (!ranking) {
        throw new Error("Ranking not found.");
      }

      const works = getRankingWorks(state.library, ranking);
      return createRankingShareImage(state.library, ranking.id, works);
    },

    async exportSelectedRankingShare() {
      const image = await controller.prepareSelectedRankingShare();

      return repository.storeExport({
        kind: "rankings",
        id: image.id,
        extension: image.extension,
        bytes: image.bytes,
      });
    },

    async prepareSelectedTierListShare() {
      const tierListId = state.selectedTierListId;

      if (!tierListId) {
        throw new Error("Tier list not selected.");
      }

      const tierList = state.library.tierLists.find(
        (item) => item.id === tierListId,
      );

      if (!tierList) {
        throw new Error("Tier list not found.");
      }

      const coverImages = await buildCoverImageMap(
        repository,
        state.library,
        tierList,
      );
      return createTierListShareImage(state.library, tierList.id, coverImages);
    },

    async exportSelectedTierListShare() {
      const image = await controller.prepareSelectedTierListShare();

      return repository.storeExport({
        kind: "tiers",
        id: image.id,
        extension: image.extension,
        bytes: image.bytes,
      });
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
        selectedTierListId:
          state.library.tierLists.find(
            (tierList) => tierList.categoryId === categoryId,
          )?.id ?? null,
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

    async createTierList(input) {
      const categoryId = state.selectedCategoryId;

      if (!categoryId) {
        throw new Error("Category not selected.");
      }

      const result = createTierList(state.library, {
        ...input,
        categoryId,
      });

      await saveLibrary(result.library, {
        selectedCategoryId: categoryId,
        selectedWorkId:
          state.library.works.find((work) => work.categoryId === categoryId)
            ?.id ?? null,
        selectedRankingId:
          state.library.rankings.find(
            (ranking) => ranking.categoryId === categoryId,
          )?.id ?? null,
        selectedTierListId: result.tierList.id,
      });
    },

    async updateSelectedTierList(input) {
      const tierListId = state.selectedTierListId;

      if (!tierListId) {
        return;
      }

      const nextLibrary = updateTierList(state.library, tierListId, input);
      await saveLibrary(nextLibrary);
    },

    async deleteSelectedTierList() {
      const tierListId = state.selectedTierListId;

      if (!tierListId) {
        return;
      }

      const nextLibrary = deleteTierList(state.library, tierListId);
      await saveLibrary(nextLibrary);
    },

    async moveSelectedTierListWork(workId, levelId) {
      const tierListId = state.selectedTierListId;

      if (!tierListId) {
        return;
      }

      const nextLibrary = moveTierListWork(
        state.library,
        tierListId,
        workId,
        levelId,
      );
      await saveLibrary(nextLibrary);
    },

    async removeSelectedTierListWork(workId) {
      const tierListId = state.selectedTierListId;

      if (!tierListId) {
        return;
      }

      const nextLibrary = removeTierListWork(state.library, tierListId, workId);
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

async function buildCoverImageMap(
  repository: LibraryRepository,
  library: Library,
  tierList: TierList,
): Promise<Map<string, string>> {
  const assignedWorkIds = new Set(
    tierList.levels.flatMap((level) => level.workIds),
  );
  const works = library.works.filter(
    (work) => assignedWorkIds.has(work.id) && work.coverImagePath,
  );
  const entries = await Promise.all(
    works.map(async (work) => {
      if (!work.coverImagePath) {
        return null;
      }

      const coverDataUrl = await buildCoverDataUrl(
        repository,
        work.coverImagePath,
      );

      if (!coverDataUrl) {
        return null;
      }

      return [work.id, coverDataUrl] as const;
    }),
  );

  return new Map(entries.filter((entry) => entry !== null));
}

async function buildCoverDataUrl(
  repository: LibraryRepository,
  relativePath: string,
): Promise<string | null> {
  const bytes = await repository.readImage(relativePath);

  if (!bytes) {
    return null;
  }

  return createDisplayImageDataUrl(relativePath, bytes);
}
