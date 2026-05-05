import type { Library, Ranking, Work } from "./model";

export interface RankingDimensionOption {
  id: string;
  name: string;
}

export function collectRankingDimensionOptions(
  works: Work[],
): RankingDimensionOption[] {
  const dimensions = new Map<string, string>();

  for (const work of works) {
    for (const dimension of work.ratingDimensions) {
      if (!dimensions.has(dimension.id)) {
        dimensions.set(dimension.id, dimension.name);
      }
    }
  }

  return [...dimensions.entries()].map(([id, name]) => ({ id, name }));
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
  const categoryWorks = library.works.filter(
    (work) => work.categoryId === ranking.categoryId,
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

  if (ranking.mode === "manual") {
    return ranking.workIds.flatMap((workId) => {
      const work = workById.get(workId);
      return work && work.categoryId === ranking.categoryId ? [work] : [];
    });
  }

  const categoryWorks = library.works.filter(
    (work) => work.categoryId === ranking.categoryId,
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
