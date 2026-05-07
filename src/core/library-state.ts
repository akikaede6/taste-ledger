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
import { getCategoryDescendantIds, getCategoryRootId } from "./category-tree";
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
  createCategory(name: string, parentCategoryId?: string | null): Promise<void>;
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
    const categoryId = resolveSelectedCategoryId(
      library,
      state.selectedCategoryId,
    );
    const rootCategoryId = categoryId
      ? (getCategoryRootId(library, categoryId) ?? categoryId)
      : null;
    const categoryScopeIds = categoryId
      ? new Set(getCategoryDescendantIds(library, categoryId))
      : new Set<string>();
    const selectedWorkId = resolveSelectedWorkId(
      library,
      categoryScopeIds,
      state.selectedWorkId,
    );
    const selectedRankingId = resolveSharedRankingId(
      library,
      rootCategoryId,
      state.selectedRankingId,
    );
    const selectedTierListId = resolveSharedTierListId(
      library,
      rootCategoryId,
      state.selectedTierListId,
    );

    return {
      selectedCategoryId: categoryId,
      selectedWorkId,
      selectedRankingId,
      selectedTierListId,
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
      const selectedCategoryId = resolveSelectedCategoryId(
        state.library,
        categoryId,
      );
      const categoryScopeIds = selectedCategoryId
        ? new Set(getCategoryDescendantIds(state.library, selectedCategoryId))
        : new Set<string>();
      const rootCategoryId = selectedCategoryId
        ? (getCategoryRootId(state.library, selectedCategoryId) ??
          selectedCategoryId)
        : null;
      setState({
        ...state,
        selectedCategoryId,
        selectedWorkId: resolveSelectedWorkId(
          state.library,
          categoryScopeIds,
          state.selectedWorkId,
        ),
        selectedRankingId: resolveSharedRankingId(
          state.library,
          rootCategoryId,
          state.selectedRankingId,
        ),
        selectedTierListId: resolveSharedTierListId(
          state.library,
          rootCategoryId,
          state.selectedTierListId,
        ),
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

      const selectedCategoryId = resolveSelectedCategoryId(
        state.library,
        state.selectedCategoryId,
      );
      const categoryScopeIds = selectedCategoryId
        ? new Set(getCategoryDescendantIds(state.library, selectedCategoryId))
        : new Set<string>();
      const selectedWorkId =
        ranking.workIds.find((workId) =>
          state.library.works.some((work) => {
            if (work.id !== workId) {
              return false;
            }

            return categoryScopeIds.has(work.categoryId);
          }),
        ) ??
        resolveSelectedWorkId(
          state.library,
          categoryScopeIds,
          state.selectedWorkId,
        );

      setState({
        ...state,
        selectedCategoryId,
        selectedWorkId,
        selectedRankingId: rankingId,
        selectedTierListId: resolveSharedTierListId(
          state.library,
          ranking.categoryId,
          state.selectedTierListId,
        ),
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

      const selectedCategoryId = resolveSelectedCategoryId(
        state.library,
        state.selectedCategoryId,
      );
      const categoryScopeIds = selectedCategoryId
        ? new Set(getCategoryDescendantIds(state.library, selectedCategoryId))
        : new Set<string>();
      setState({
        ...state,
        selectedCategoryId,
        selectedWorkId: resolveSelectedWorkId(
          state.library,
          categoryScopeIds,
          state.selectedWorkId,
        ),
        selectedRankingId: resolveSharedRankingId(
          state.library,
          tierList.categoryId,
          state.selectedRankingId,
        ),
        selectedTierListId: tierListId,
      });
    },

    async createCategory(name, parentCategoryId) {
      const nextLibrary = createCategoryAction(
        state.library,
        name,
        parentCategoryId,
      );
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

      const rootCategoryId = getCategoryRootId(state.library, categoryId);
      const nextLibrary = updateCategoryRatingDimensions(
        state.library,
        rootCategoryId ?? categoryId,
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

      const rootCategoryId =
        getCategoryRootId(state.library, categoryId) ?? categoryId;

      const result = createRanking(state.library, {
        ...input,
        categoryId: rootCategoryId,
      });

      await saveLibrary(result.library, {
        selectedCategoryId: categoryId,
        selectedWorkId: resolveSelectedWorkId(
          state.library,
          new Set(getCategoryDescendantIds(state.library, categoryId)),
          state.selectedWorkId,
        ),
        selectedRankingId: result.ranking.id,
        selectedTierListId: resolveSharedTierListId(
          state.library,
          rootCategoryId,
          state.selectedTierListId,
        ),
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

      const rootCategoryId =
        getCategoryRootId(state.library, categoryId) ?? categoryId;

      const result = createTierList(state.library, {
        ...input,
        categoryId: rootCategoryId,
      });

      await saveLibrary(result.library, {
        selectedCategoryId: categoryId,
        selectedWorkId: resolveSelectedWorkId(
          state.library,
          new Set(getCategoryDescendantIds(state.library, categoryId)),
          state.selectedWorkId,
        ),
        selectedRankingId: resolveSharedRankingId(
          state.library,
          rootCategoryId,
          state.selectedRankingId,
        ),
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

function createCategoryAction(
  library: Library,
  name: string,
  parentCategoryId?: string | null,
): Library {
  const next = createCategory(library, { name, parentCategoryId });
  next.categories = sortCategoriesByRecentUpdate(next.categories);
  return next;
}

function resolveSelectedCategoryId(
  library: Library,
  categoryId: string | null,
): string | null {
  if (
    categoryId &&
    library.categories.some((category) => category.id === categoryId)
  ) {
    return categoryId;
  }

  return (
    library.categories.find((category) => category.parentCategoryId === null)
      ?.id ??
    library.categories[0]?.id ??
    null
  );
}

function resolveSharedRankingId(
  library: Library,
  rootCategoryId: string | null,
  currentRankingId: string | null,
): string | null {
  if (
    currentRankingId &&
    library.rankings.some(
      (ranking) =>
        ranking.id === currentRankingId &&
        ranking.categoryId === rootCategoryId,
    )
  ) {
    return currentRankingId;
  }

  if (!rootCategoryId) {
    return null;
  }

  return (
    sortRankingsByRecentUpdate(
      library.rankings.filter(
        (ranking) => ranking.categoryId === rootCategoryId,
      ),
    )[0]?.id ?? null
  );
}

function resolveSharedTierListId(
  library: Library,
  rootCategoryId: string | null,
  currentTierListId: string | null,
): string | null {
  if (
    currentTierListId &&
    library.tierLists.some(
      (tierList) =>
        tierList.id === currentTierListId &&
        tierList.categoryId === rootCategoryId,
    )
  ) {
    return currentTierListId;
  }

  if (!rootCategoryId) {
    return null;
  }

  return (
    sortTierListsByRecentUpdate(
      library.tierLists.filter(
        (tierList) => tierList.categoryId === rootCategoryId,
      ),
    )[0]?.id ?? null
  );
}

function resolveSelectedWorkId(
  library: Library,
  categoryScopeIds: Set<string>,
  currentWorkId: string | null,
): string | null {
  if (
    currentWorkId &&
    library.works.some(
      (work) =>
        work.id === currentWorkId && categoryScopeIds.has(work.categoryId),
    )
  ) {
    return currentWorkId;
  }

  return getFirstVisibleWorkId(library, categoryScopeIds);
}

function getFirstVisibleWorkId(
  library: Library,
  categoryScopeIds: Set<string>,
): string | null {
  return (
    library.works.find((work) => categoryScopeIds.has(work.categoryId))?.id ??
    null
  );
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
