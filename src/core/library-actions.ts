import type {
  Category,
  Library,
  Ranking,
  RankingMode,
  RatingDimensionScore,
  RatingDimensionTemplate,
  TierLevel,
  TierLevelId,
  TierList,
  Work,
} from "./model";
import {
  getCategoryAncestorIds,
  getCategoryDescendantIds,
  getCategoryRootId,
} from "./category-tree";
import { DEFAULT_TIER_LEVELS as DEFAULT_TIER_LEVEL_DEFINITIONS } from "./model";
import { buildRankingWorkIds } from "./ranking";
import { recalculateWorkScore } from "./scoring";

export interface CategoryInput {
  name: string;
  parentCategoryId?: string | null;
}

export interface WorkInput {
  categoryId: string;
  title: string;
  coverImagePath?: string | null;
  tags?: string[];
  shortReview?: string;
  longReview?: string;
}

export interface WorkUpdateInput {
  title?: string;
  coverImagePath?: string | null;
  tags?: string[];
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

export interface TierListInput {
  categoryId: string;
  name: string;
}

export interface TierListUpdateInput {
  name?: string;
  levels?: TierLevel[];
}

export function createCategory(
  library: Library,
  input: CategoryInput,
): Library {
  const next = cloneLibrary(library);
  const now = new Date().toISOString();
  const name = input.name.trim();
  const parentCategoryId = input.parentCategoryId ?? null;

  if (name.length === 0) {
    throw new Error("Category name cannot be empty.");
  }

  if (parentCategoryId && !findCategory(next, parentCategoryId)) {
    throw new Error("Parent category not found.");
  }

  if (parentCategoryId) {
    const parentCategory = findCategory(next, parentCategoryId);

    if (parentCategory && parentCategory.parentCategoryId !== null) {
      throw new Error(
        "Subcategories may only be created under root categories.",
      );
    }
  }

  next.categories.push({
    id: crypto.randomUUID(),
    parentCategoryId,
    name,
    createdAt: now,
    updatedAt: now,
    ratingDimensionTemplates: [],
  });

  if (parentCategoryId) {
    touchCategoryPath(next, parentCategoryId, now);
  }

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

export function updateCategoryRatingDimensions(
  library: Library,
  categoryId: string,
  templates: RatingDimensionTemplate[],
): Library {
  const next = cloneLibrary(library);
  const rootCategoryId = getCategoryRootId(next, categoryId) ?? categoryId;
  const category = findCategory(next, rootCategoryId);
  const now = new Date().toISOString();

  if (!category) {
    throw new Error("Category not found.");
  }

  const normalizedTemplates = normalizeRatingDimensionTemplates(templates);
  category.ratingDimensionTemplates = normalizedTemplates;
  category.updatedAt = now;

  const categoryScopeIds = new Set(getCategoryDescendantIds(next, category.id));

  next.works = next.works.map((work) =>
    categoryScopeIds.has(work.categoryId)
      ? recalculateWorkScore({
          ...work,
          ratingDimensions: syncWorkDimensionsWithCategory(
            work.ratingDimensions,
            normalizedTemplates,
          ),
          updatedAt: now,
        })
      : work,
  );

  retargetDimensionRankings(next, category.id, normalizedTemplates, now);
  refreshCategoryRankings(next, category.id, now);
  touchCategoryPath(next, category.id, now);

  return next;
}

export function deleteCategory(library: Library, categoryId: string): Library {
  const next = cloneLibrary(library);
  const category = findCategory(next, categoryId);
  const now = new Date().toISOString();

  if (!category) {
    throw new Error("Category not found.");
  }

  const rootCategoryId = getCategoryRootId(next, categoryId) ?? categoryId;
  const subtreeCategoryIds = new Set(
    getCategoryDescendantIds(next, categoryId),
  );
  const subtreeWorkIds = new Set(
    next.works
      .filter((work) => subtreeCategoryIds.has(work.categoryId))
      .map((work) => work.id),
  );

  next.categories = next.categories.filter(
    (item) => !subtreeCategoryIds.has(item.id),
  );
  next.works = next.works.filter(
    (work) => !subtreeCategoryIds.has(work.categoryId),
  );
  next.tierLists = next.tierLists
    .filter((tierList) => !subtreeCategoryIds.has(tierList.categoryId))
    .map((tierList) => {
      const levels = tierList.levels.map((level) => ({
        ...level,
        workIds: level.workIds.filter((workId) => !subtreeWorkIds.has(workId)),
      }));
      const changed = levels.some(
        (level, index) =>
          !sameIdList(level.workIds, tierList.levels[index]?.workIds ?? []),
      );

      return {
        ...tierList,
        levels,
        updatedAt: changed ? now : tierList.updatedAt,
      };
    });

  if (category.parentCategoryId === null) {
    next.rankings = next.rankings.filter(
      (ranking) => ranking.categoryId !== categoryId,
    );
    return next;
  }

  refreshCategoryRankings(next, rootCategoryId, now);
  touchCategoryPath(next, category.parentCategoryId, now);
  return next;
}

export function createWork(
  library: Library,
  input: WorkInput,
): { library: Library; work: Work } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const rootCategoryId = category
    ? (getCategoryRootId(next, category.id) ?? category.id)
    : null;
  const sharedCategory = rootCategoryId
    ? findCategory(next, rootCategoryId)
    : undefined;
  const now = new Date().toISOString();
  const title = input.title.trim();

  if (!category || !sharedCategory) {
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
    tags: normalizeTags(input.tags ?? []),
    shortReview: input.shortReview ?? "",
    longReview: input.longReview ?? "",
    ratingDimensions: syncWorkDimensionsWithCategory(
      [],
      sharedCategory.ratingDimensionTemplates,
    ),
    finalScore: null,
    createdAt: now,
    updatedAt: now,
  });

  next.works.push(work);
  touchCategoryPath(next, category.id, now);
  refreshCategoryRankings(next, sharedCategory.id, now, {
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

  const category = findCategory(next, work.categoryId);
  const rootCategoryId = category
    ? (getCategoryRootId(next, category.id) ?? category.id)
    : null;
  const sharedCategory = rootCategoryId
    ? findCategory(next, rootCategoryId)
    : undefined;

  if (!category || !sharedCategory) {
    throw new Error("Work category not found.");
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

  if (input.tags !== undefined) {
    work.tags = normalizeTags(input.tags);
  }

  if (input.shortReview !== undefined) {
    work.shortReview = input.shortReview;
  }

  if (input.longReview !== undefined) {
    work.longReview = input.longReview;
  }

  if (input.ratingDimensions !== undefined) {
    work.ratingDimensions = normalizeWorkScoresForCategory(
      input.ratingDimensions,
      sharedCategory.ratingDimensionTemplates,
    );
  } else {
    work.ratingDimensions = syncWorkDimensionsWithCategory(
      work.ratingDimensions,
      sharedCategory.ratingDimensionTemplates,
    );
  }

  const updatedWork = recalculateWorkScore({
    ...work,
    updatedAt: now,
  });
  Object.assign(work, updatedWork);
  touchCategoryPath(next, work.categoryId, now);
  refreshCategoryRankings(next, sharedCategory.id, now);

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
  next.tierLists = next.tierLists.map((tierList) =>
    isCategoryInScope(next, tierList.categoryId, work.categoryId)
      ? {
          ...tierList,
          levels: tierList.levels.map((level) => ({
            ...level,
            workIds: level.workIds.filter((item) => item !== workId),
          })),
          updatedAt: now,
        }
      : tierList,
  );
  touchCategoryPath(next, work.categoryId, now);
  refreshCategoryRankings(
    next,
    getCategoryRootId(next, work.categoryId) ?? work.categoryId,
    now,
    {
      removedWorkId: workId,
    },
  );

  return next;
}

export function createRanking(
  library: Library,
  input: RankingInput,
): { library: Library; ranking: Ranking } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const rootCategoryId = category
    ? (getCategoryRootId(next, category.id) ?? category.id)
    : null;
  const sharedCategory = rootCategoryId
    ? findCategory(next, rootCategoryId)
    : undefined;
  const now = new Date().toISOString();
  const name = input.name.trim();

  if (!category || !sharedCategory) {
    throw new Error("Category not found.");
  }

  if (name.length === 0) {
    throw new Error("Ranking name cannot be empty.");
  }

  const ranking: Ranking = {
    id: crypto.randomUUID(),
    categoryId: sharedCategory.id,
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
  touchCategoryPath(next, category.id, now);

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
  touchCategoryPath(next, ranking.categoryId, now);

  return next;
}

export function deleteRanking(library: Library, rankingId: string): Library {
  const next = cloneLibrary(library);
  const ranking = findRanking(next, rankingId);

  if (!ranking) {
    throw new Error("Ranking not found.");
  }

  next.rankings = next.rankings.filter((item) => item.id !== rankingId);
  touchCategoryPath(next, ranking.categoryId, new Date().toISOString());

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
  touchCategoryPath(next, ranking.categoryId, now);

  return next;
}

export function createTierList(
  library: Library,
  input: TierListInput,
): { library: Library; tierList: TierList } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const rootCategoryId = category
    ? (getCategoryRootId(next, category.id) ?? category.id)
    : null;
  const sharedCategory = rootCategoryId
    ? findCategory(next, rootCategoryId)
    : undefined;
  const now = new Date().toISOString();
  const name = input.name.trim();

  if (!category || !sharedCategory) {
    throw new Error("Category not found.");
  }

  if (name.length === 0) {
    throw new Error("Tier list name cannot be empty.");
  }

  const tierList: TierList = {
    id: crypto.randomUUID(),
    categoryId: sharedCategory.id,
    name,
    levels: createDefaultTierLevels(),
    createdAt: now,
    updatedAt: now,
  };

  next.tierLists.push(tierList);
  touchCategoryPath(next, category.id, now);

  return {
    library: next,
    tierList,
  };
}

export function updateTierList(
  library: Library,
  tierListId: string,
  input: TierListUpdateInput,
): Library {
  const next = cloneLibrary(library);
  const tierList = findTierList(next, tierListId);
  const now = new Date().toISOString();

  if (!tierList) {
    throw new Error("Tier list not found.");
  }

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (name.length === 0) {
      throw new Error("Tier list name cannot be empty.");
    }

    tierList.name = name;
  }

  if (input.levels !== undefined) {
    tierList.levels = normalizeTierLevels(
      next,
      tierList.categoryId,
      input.levels,
    );
  }

  tierList.updatedAt = now;
  touchCategoryPath(next, tierList.categoryId, now);

  return next;
}

export function deleteTierList(library: Library, tierListId: string): Library {
  const next = cloneLibrary(library);
  const tierList = findTierList(next, tierListId);

  if (!tierList) {
    throw new Error("Tier list not found.");
  }

  next.tierLists = next.tierLists.filter((item) => item.id !== tierListId);
  touchCategoryPath(next, tierList.categoryId, new Date().toISOString());

  return next;
}

export function moveTierListWork(
  library: Library,
  tierListId: string,
  workId: string,
  levelId: TierLevelId,
): Library {
  const next = cloneLibrary(library);
  const tierList = findTierList(next, tierListId);
  const now = new Date().toISOString();

  if (!tierList) {
    throw new Error("Tier list not found.");
  }

  const work = findWork(next, workId);

  if (!work || !isCategoryInScope(next, tierList.categoryId, work.categoryId)) {
    throw new Error("Tier list work must belong to the same category.");
  }

  if (!tierList.levels.some((level) => level.id === levelId)) {
    throw new Error("Tier level not found.");
  }

  tierList.levels = tierList.levels.map((level) => {
    const withoutWork = level.workIds.filter((item) => item !== workId);
    return {
      ...level,
      workIds:
        level.id === levelId && !withoutWork.includes(workId)
          ? [...withoutWork, workId]
          : withoutWork,
    };
  });
  tierList.updatedAt = now;
  touchCategoryPath(next, tierList.categoryId, now);

  return next;
}

export function removeTierListWork(
  library: Library,
  tierListId: string,
  workId: string,
): Library {
  const next = cloneLibrary(library);
  const tierList = findTierList(next, tierListId);
  const now = new Date().toISOString();

  if (!tierList) {
    throw new Error("Tier list not found.");
  }

  tierList.levels = tierList.levels.map((level) => ({
    ...level,
    workIds: level.workIds.filter((item) => item !== workId),
  }));
  tierList.updatedAt = now;
  touchCategoryPath(next, tierList.categoryId, now);

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

export function sortTierListsByRecentUpdate(tierLists: TierList[]): TierList[] {
  return [...tierLists].sort((left, right) =>
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

function touchCategoryPath(library: Library, categoryId: string, now: string) {
  touchCategory(library, categoryId, now);

  for (const ancestorId of getCategoryAncestorIds(library, categoryId)) {
    touchCategory(library, ancestorId, now);
  }
}

function findRanking(library: Library, rankingId: string): Ranking | undefined {
  return library.rankings.find((ranking) => ranking.id === rankingId);
}

function findTierList(
  library: Library,
  tierListId: string,
): TierList | undefined {
  return library.tierLists.find((tierList) => tierList.id === tierListId);
}

function refreshCategoryRankings(
  library: Library,
  categoryId: string,
  now: string,
  options: { addedWorkId?: string; removedWorkId?: string } = {},
) {
  const categoryScopeIds = new Set(
    getCategoryDescendantIds(library, categoryId),
  );
  const categoryWorks = library.works.filter((work) =>
    categoryScopeIds.has(work.categoryId),
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

  if (ranking.mode === "dimension" && ranking.dimensionId) {
    const category = findCategory(library, ranking.categoryId);

    if (
      !category?.ratingDimensionTemplates.some(
        (dimension) => dimension.id === ranking.dimensionId,
      )
    ) {
      throw new Error("Dimension rankings require a category dimension.");
    }
  }

  const categoryScopeIds = new Set(
    getCategoryDescendantIds(library, ranking.categoryId),
  );
  const categoryWorks = library.works.filter((work) =>
    categoryScopeIds.has(work.categoryId),
  );

  if (ranking.mode === "manual" && categoryWorks.length === 0) {
    throw new Error("Manual rankings require at least one work id.");
  }
}

function normalizeRatingDimensionTemplates(
  templates: RatingDimensionTemplate[],
): RatingDimensionTemplate[] {
  const seenIds = new Set<string>();

  return templates.map((dimension, index) => {
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

    if (!Number.isFinite(dimension.weight) || dimension.weight <= 0) {
      throw new Error(`Rating dimension ${index + 1} weight must be valid.`);
    }

    return {
      id,
      name,
      weight: dimension.weight,
    };
  });
}

function normalizeWorkScoresForCategory(
  dimensions: RatingDimensionScore[],
  templates: RatingDimensionTemplate[],
): RatingDimensionScore[] {
  const templateIds = new Set(templates.map((dimension) => dimension.id));
  const scoresById = new Map<string, number>();

  dimensions.forEach((dimension, index) => {
    const id = dimension.id.trim();

    if (!templateIds.has(id)) {
      throw new Error(
        `Rating dimension ${index + 1} must belong to the category.`,
      );
    }

    if (!Number.isFinite(dimension.score) || dimension.score < 0) {
      throw new Error(`Rating dimension ${index + 1} score must be valid.`);
    }

    scoresById.set(id, dimension.score);
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    score: scoresById.get(template.id) ?? 0,
    weight: template.weight,
  }));
}

function syncWorkDimensionsWithCategory(
  dimensions: RatingDimensionScore[],
  templates: RatingDimensionTemplate[],
): RatingDimensionScore[] {
  const scoreById = new Map(
    dimensions.map((dimension) => [dimension.id, dimension.score] as const),
  );

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    score: scoreById.get(template.id) ?? 0,
    weight: template.weight,
  }));
}

function retargetDimensionRankings(
  library: Library,
  categoryId: string,
  templates: RatingDimensionTemplate[],
  now: string,
) {
  const templateIds = new Set(templates.map((dimension) => dimension.id));

  library.rankings = library.rankings.map((ranking) => {
    if (
      ranking.categoryId !== categoryId ||
      ranking.mode !== "dimension" ||
      !ranking.dimensionId ||
      templateIds.has(ranking.dimensionId)
    ) {
      return ranking;
    }

    if (templates.length > 0) {
      return {
        ...ranking,
        dimensionId: templates[0].id,
        updatedAt: now,
      };
    }

    return {
      ...ranking,
      mode: "finalScore",
      dimensionId: null,
      updatedAt: now,
    };
  });
}

function createDefaultTierLevels(): TierLevel[] {
  return DEFAULT_TIER_LEVEL_DEFINITIONS.map((level) => ({
    id: level.id,
    name: level.name,
    workIds: [],
  }));
}

function normalizeTierLevels(
  library: Library,
  categoryId: string,
  levels: TierLevel[],
): TierLevel[] {
  const worksInCategory = new Set(
    library.works
      .filter((work) => isCategoryInScope(library, categoryId, work.categoryId))
      .map((work) => work.id),
  );
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const seenWorkIds = new Set<string>();

  return DEFAULT_TIER_LEVEL_DEFINITIONS.map((definition) => {
    const level = levelById.get(definition.id);
    const name = level?.name.trim() || definition.name;
    const workIds: string[] = [];

    for (const workId of level?.workIds ?? []) {
      if (!worksInCategory.has(workId)) {
        throw new Error("Tier list work must belong to the same category.");
      }

      if (seenWorkIds.has(workId)) {
        throw new Error("Tier list work ids must be unique.");
      }

      seenWorkIds.add(workId);
      workIds.push(workId);
    }

    return {
      id: definition.id,
      name,
      workIds,
    };
  });
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags) {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      continue;
    }

    const key = tag.toLocaleLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(tag);
  }

  return normalized;
}

function isCategoryInScope(
  library: Library,
  scopeCategoryId: string,
  categoryId: string,
): boolean {
  return (
    scopeCategoryId === categoryId ||
    getCategoryAncestorIds(library, categoryId).includes(scopeCategoryId)
  );
}
