import type { Library, Ranking, RatingDimensionTemplate, Work } from "./model";
import { getCategoryDescendantIds } from "./category-tree";

export interface RankingDimensionOption {
  id: string;
  name: string;
}

export function collectRankingDimensionOptions(
  templates: RatingDimensionTemplate[],
): RankingDimensionOption[] {
  return templates.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
  }));
}

export function sortWorksForRanking(
  works: Work[],
  ranking: Pick<Ranking, "mode" | "dimensionId">,
): Work[] {
  if (ranking.mode === "dimension") {
    return sortWorksByDimension(works, ranking.dimensionId);
  }

  return sortWorksByFinalScore(works);
}

export function buildRankingWorkIds(
  library: Library,
  ranking: Pick<Ranking, "mode" | "dimensionId" | "workIds" | "categoryId">,
): string[] {
  const categoryScopeIds = new Set(
    getCategoryDescendantIds(library, ranking.categoryId),
  );
  const categoryWorks = library.works.filter((work) =>
    categoryScopeIds.has(work.categoryId),
  );

  if (ranking.mode === "manual") {
    const knownWorks = new Set(categoryWorks.map((work) => work.id));
    const ordered = ranking.workIds.filter((workId) => knownWorks.has(workId));
    const missingWorks = sortWorksByFinalScore(
      categoryWorks.filter((work) => !ordered.includes(work.id)),
    ).map((work) => work.id);

    return [...ordered, ...missingWorks];
  }

  return sortWorksForRanking(categoryWorks, ranking).map((work) => work.id);
}

export function getRankingWorks(
  library: Library,
  ranking: Pick<Ranking, "mode" | "dimensionId" | "workIds" | "categoryId">,
): Work[] {
  const workById = new Map(
    library.works.map((work) => [work.id, work] as const),
  );
  const categoryScopeIds = new Set(
    getCategoryDescendantIds(library, ranking.categoryId),
  );

  if (ranking.mode === "manual") {
    return ranking.workIds.flatMap((workId) => {
      const work = workById.get(workId);
      return work && categoryScopeIds.has(work.categoryId) ? [work] : [];
    });
  }

  const categoryWorks = library.works.filter((work) =>
    categoryScopeIds.has(work.categoryId),
  );

  return sortWorksForRanking(categoryWorks, ranking);
}

function sortWorksByFinalScore(works: Work[]): Work[] {
  return [...works].sort((left, right) => {
    const leftScore = left.finalScore ?? Number.NEGATIVE_INFINITY;
    const rightScore = right.finalScore ?? Number.NEGATIVE_INFINITY;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function sortWorksByDimension(
  works: Work[],
  dimensionId: string | null,
): Work[] {
  if (!dimensionId) {
    return sortWorksByFinalScore(works);
  }

  return [...works].sort((left, right) => {
    const leftScore = getDimensionScore(left, dimensionId);
    const rightScore = getDimensionScore(right, dimensionId);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function getDimensionScore(work: Work, dimensionId: string): number {
  return (
    work.ratingDimensions.find((dimension) => dimension.id === dimensionId)
      ?.score ?? Number.NEGATIVE_INFINITY
  );
}
