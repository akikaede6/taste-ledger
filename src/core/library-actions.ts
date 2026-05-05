import type {
  Category,
  Library,
  Ranking,
  RankingMode,
  RatingDimensionScore,
  Work,
} from "./model";
import { buildRankingWorkIds } from "./ranking";
import { recalculateWorkScore } from "./scoring";

export interface CategoryInput {
  name: string;
}

export interface WorkInput {
  categoryId: string;
  title: string;
  coverImagePath?: string | null;
  shortReview?: string;
  longReview?: string;
}

export interface WorkUpdateInput {
  title?: string;
  coverImagePath?: string | null;
  shortReview?: string;
  longReview?: string;
  ratingDimensions?: RatingDimensionScore[];
}

export interface RankingInput {
  categoryId: string;
  name: string;
  mode: RankingMode;
  dimensionId?: string | null;
}

export interface RankingUpdateInput {
  name?: string;
  mode?: RankingMode;
  dimensionId?: string | null;
}

export function createCategory(
  library: Library,
  input: CategoryInput,
): Library {
  const next = cloneLibrary(library);
  const now = new Date().toISOString();
  const name = input.name.trim();

  if (name.length === 0) {
    throw new Error("Category name cannot be empty.");
  }

  next.categories.push({
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    ratingDimensionTemplates: [],
  });

  return next;
}

export function renameCategory(
  library: Library,
  categoryId: string,
  name: string,
): Library {
  const next = cloneLibrary(library);
  const category = findCategory(next, categoryId);
  const trimmedName = name.trim();

  if (!category) {
    throw new Error("Category not found.");
  }

  if (trimmedName.length === 0) {
    throw new Error("Category name cannot be empty.");
  }

  category.name = trimmedName;
  category.updatedAt = new Date().toISOString();

  return next;
}

export function deleteCategory(library: Library, categoryId: string): Library {
  const next = cloneLibrary(library);
  next.categories = next.categories.filter(
    (category) => category.id !== categoryId,
  );
  next.works = next.works.filter((work) => work.categoryId !== categoryId);
  next.rankings = next.rankings.filter(
    (ranking) => ranking.categoryId !== categoryId,
  );
  return next;
}

export function createWork(
  library: Library,
  input: WorkInput,
): { library: Library; work: Work } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const now = new Date().toISOString();
  const title = input.title.trim();

  if (!category) {
    throw new Error("Category not found.");
  }

  if (title.length === 0) {
    throw new Error("Work title cannot be empty.");
  }

  const work = recalculateWorkScore({
    id: crypto.randomUUID(),
    categoryId: category.id,
    title,
    coverImagePath: input.coverImagePath ?? null,
    shortReview: input.shortReview ?? "",
    longReview: input.longReview ?? "",
    ratingDimensions: category.ratingDimensionTemplates.map((dimension) => ({
      id: dimension.id,
      name: dimension.name,
      score: 0,
      weight: dimension.weight,
    })),
    finalScore: null,
    createdAt: now,
    updatedAt: now,
  });

  next.works.push(work);
  category.updatedAt = now;
  refreshCategoryRankings(next, category.id, now, {
    addedWorkId: work.id,
  });

  return {
    library: next,
    work,
  };
}

export function updateWork(
  library: Library,
  workId: string,
  input: WorkUpdateInput,
): Library {
  const next = cloneLibrary(library);
  const work = findWork(next, workId);
  const now = new Date().toISOString();

  if (!work) {
    throw new Error("Work not found.");
  }

  if (input.title !== undefined) {
    const title = input.title.trim();

    if (title.length === 0) {
      throw new Error("Work title cannot be empty.");
    }

    work.title = title;
  }

  if (input.coverImagePath !== undefined) {
    work.coverImagePath = input.coverImagePath;
  }

  if (input.shortReview !== undefined) {
    work.shortReview = input.shortReview;
  }

  if (input.longReview !== undefined) {
    work.longReview = input.longReview;
  }

  if (input.ratingDimensions !== undefined) {
    work.ratingDimensions = normalizeRatingDimensions(input.ratingDimensions);
  }

  const updatedWork = recalculateWorkScore({
    ...work,
    updatedAt: now,
  });
  Object.assign(work, updatedWork);
  touchCategory(next, work.categoryId, now);
  refreshCategoryRankings(next, work.categoryId, now);

  return next;
}

export function deleteWork(library: Library, workId: string): Library {
  const next = cloneLibrary(library);
  const work = findWork(next, workId);
  const now = new Date().toISOString();

  if (!work) {
    throw new Error("Work not found.");
  }

  next.works = next.works.filter((item) => item.id !== workId);
  touchCategory(next, work.categoryId, now);
  refreshCategoryRankings(next, work.categoryId, now, {
    removedWorkId: workId,
  });

  return next;
}

export function createRanking(
  library: Library,
  input: RankingInput,
): { library: Library; ranking: Ranking } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const now = new Date().toISOString();
  const name = input.name.trim();

  if (!category) {
    throw new Error("Category not found.");
  }

  if (name.length === 0) {
    throw new Error("Ranking name cannot be empty.");
  }

  const ranking: Ranking = {
    id: crypto.randomUUID(),
    categoryId: category.id,
    name,
    mode: input.mode,
    dimensionId:
      input.mode === "dimension" ? (input.dimensionId ?? null) : null,
    workIds: [],
    createdAt: now,
    updatedAt: now,
  };

  validateRankingInput(ranking, next);
  ranking.workIds = buildRankingWorkIds(next, ranking);
  next.rankings.push(ranking);
  category.updatedAt = now;

  return {
    library: next,
    ranking,
  };
}

export function updateRanking(
  library: Library,
  rankingId: string,
  input: RankingUpdateInput,
): Library {
  const next = cloneLibrary(library);
  const ranking = findRanking(next, rankingId);
  const now = new Date().toISOString();

  if (!ranking) {
    throw new Error("Ranking not found.");
  }

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new Error("Ranking name cannot be empty.");
    }

    ranking.name = name;
  }

  if (input.mode !== undefined) {
    ranking.mode = input.mode;
  }

  if (ranking.mode === "dimension") {
    ranking.dimensionId = input.dimensionId ?? ranking.dimensionId ?? null;
  } else {
    ranking.dimensionId = null;
  }

  validateRankingInput(ranking, next);
  ranking.workIds = buildRankingWorkIds(next, ranking);
  ranking.updatedAt = now;
  touchCategory(next, ranking.categoryId, now);

  return next;
}

export function deleteRanking(library: Library, rankingId: string): Library {
  const next = cloneLibrary(library);
  const ranking = findRanking(next, rankingId);

  if (!ranking) {
    throw new Error("Ranking not found.");
  }

  next.rankings = next.rankings.filter((item) => item.id !== rankingId);
  touchCategory(next, ranking.categoryId, new Date().toISOString());

  return next;
}

export function moveRankingWork(
  library: Library,
  rankingId: string,
  workId: string,
  direction: -1 | 1,
): Library {
  const next = cloneLibrary(library);
  const ranking = findRanking(next, rankingId);
  const now = new Date().toISOString();

  if (!ranking) {
    throw new Error("Ranking not found.");
  }

  if (ranking.mode !== "manual") {
    throw new Error("Only manual rankings can be reordered.");
  }

  const currentIndex = ranking.workIds.indexOf(workId);

  if (currentIndex === -1) {
    return next;
  }

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= ranking.workIds.length) {
    return next;
  }

  const workIds = [...ranking.workIds];
  const [moved] = workIds.splice(currentIndex, 1);
  workIds.splice(nextIndex, 0, moved);

  ranking.workIds = workIds;
  ranking.updatedAt = now;
  touchCategory(next, ranking.categoryId, now);

  return next;
}

export function sortCategoriesByRecentUpdate(
  categories: Category[],
): Category[] {
  return [...categories].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export function sortRankingsByRecentUpdate(rankings: Ranking[]): Ranking[] {
  return [...rankings].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function cloneLibrary(library: Library): Library {
  return structuredClone(library);
}

function findCategory(
  library: Library,
  categoryId: string,
): Category | undefined {
  return library.categories.find((category) => category.id === categoryId);
}

function findWork(library: Library, workId: string): Work | undefined {
  return library.works.find((work) => work.id === workId);
}

function touchCategory(library: Library, categoryId: string, now: string) {
  const category = findCategory(library, categoryId);
  if (category) {
    category.updatedAt = now;
  }
}

function findRanking(library: Library, rankingId: string): Ranking | undefined {
  return library.rankings.find((ranking) => ranking.id === rankingId);
}

function refreshCategoryRankings(
  library: Library,
  categoryId: string,
  now: string,
  options: { addedWorkId?: string; removedWorkId?: string } = {},
) {
  const categoryWorks = library.works.filter(
    (work) => work.categoryId === categoryId,
  );
  const workIds = new Set(categoryWorks.map((work) => work.id));

  library.rankings = library.rankings.map((ranking) => {
    if (ranking.categoryId !== categoryId) {
      return ranking;
    }

    const nextRanking = {
      ...ranking,
      workIds: ranking.workIds,
    };

    if (ranking.mode === "manual") {
      const filteredWorkIds = ranking.workIds.filter((workId) =>
        workIds.has(workId),
      );

      if (
        options.addedWorkId &&
        !filteredWorkIds.includes(options.addedWorkId)
      ) {
        filteredWorkIds.push(options.addedWorkId);
      }

      if (options.removedWorkId) {
        nextRanking.workIds = filteredWorkIds.filter(
          (workId) => workId !== options.removedWorkId,
        );
      } else {
        nextRanking.workIds = filteredWorkIds;
      }
    } else {
      nextRanking.workIds = buildRankingWorkIds(library, ranking);
    }

    if (sameIdList(ranking.workIds, nextRanking.workIds)) {
      return ranking;
    }

    return {
      ...nextRanking,
      updatedAt: now,
    };
  });
}

function sameIdList(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateRankingInput(ranking: Ranking, library: Library) {
  if (ranking.mode === "dimension" && !ranking.dimensionId) {
    throw new Error("Dimension rankings require a dimension id.");
  }

  if (ranking.mode !== "dimension") {
    ranking.dimensionId = null;
  }

  const categoryWorks = library.works.filter(
    (work) => work.categoryId === ranking.categoryId,
  );

  if (ranking.mode === "manual" && categoryWorks.length === 0) {
    throw new Error("Manual rankings require at least one work id.");
  }
}

function normalizeRatingDimensions(
  dimensions: RatingDimensionScore[],
): RatingDimensionScore[] {
  const seenIds = new Set<string>();

  return dimensions.map((dimension, index) => {
    const id = dimension.id.trim();
    const name = dimension.name.trim();

    if (id.length === 0) {
      throw new Error(`Rating dimension ${index + 1} cannot be empty.`);
    }

    if (seenIds.has(id)) {
      throw new Error(`Rating dimension ${index + 1} id must be unique.`);
    }

    seenIds.add(id);

    if (name.length === 0) {
      throw new Error(`Rating dimension ${index + 1} name cannot be empty.`);
    }

    if (!Number.isFinite(dimension.score) || dimension.score < 0) {
      throw new Error(`Rating dimension ${index + 1} score must be valid.`);
    }

    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      throw new Error(`Rating dimension ${index + 1} weight must be valid.`);
    }

    return {
      id,
      name,
      score: dimension.score,
      weight: dimension.weight,
    };
  });
}
