import type { RatingDimensionScore, Work } from "./model";

export function calculateFinalScore(
  dimensions: RatingDimensionScore[],
): number | null {
  const validDimensions = dimensions.filter(
    (dimension) =>
      Number.isFinite(dimension.score) &&
      Number.isFinite(dimension.weight) &&
      dimension.weight > 0,
  );

  if (validDimensions.length === 0) {
    return null;
  }

  const totalWeight = validDimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );

  if (totalWeight <= 0) {
    return null;
  }

  const weightedSum = validDimensions.reduce(
    (sum, dimension) => sum + dimension.score * dimension.weight,
    0,
  );

  return roundScore(weightedSum / totalWeight);
}

export function recalculateWorkScore(work: Work): Work {
  return {
    ...work,
    finalScore: calculateFinalScore(work.ratingDimensions),
  };
}

export function sortWorksByFinalScore(works: Work[]): Work[] {
  return [...works].sort((left, right) => {
    const leftScore = left.finalScore ?? Number.NEGATIVE_INFINITY;
    const rightScore = right.finalScore ?? Number.NEGATIVE_INFINITY;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
