import type { TierList, Work } from "../../core/model";
import type { RankingDimensionOption } from "../../core/ranking";
import type { ScoreRankingMode } from "../../types/workspace";

export function getRankingDimensionValue(
  dimensionId: string,
  options: RankingDimensionOption[],
): string {
  return options.some((option) => option.id === dimensionId)
    ? dimensionId
    : (options[0]?.id ?? "");
}

export function getRankingDimensionName(
  dimensionId: string,
  options: RankingDimensionOption[],
): string {
  return (
    options.find((option) => option.id === dimensionId)?.name ??
    `维度 ${dimensionId}`
  );
}

export function formatRankingPreviewScore(
  work: Work,
  mode: ScoreRankingMode,
  dimensionId: string | null,
): string {
  if (mode === "dimension" && dimensionId) {
    const dimension = work.ratingDimensions.find(
      (item) => item.id === dimensionId,
    );

    return dimension ? `${dimension.score} 分` : "未评分";
  }

  return work.finalScore === null ? "未评分" : `${work.finalScore} 分`;
}

export function countTierListWorks(tierList: TierList): number {
  return tierList.levels.reduce(
    (count, level) => count + level.workIds.length,
    0,
  );
}
