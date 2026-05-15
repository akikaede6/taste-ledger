import { ChevronRight, ImagePlus } from "lucide-react";
import { useState } from "react";
import { getCategoryLineage } from "../../core/category-tree";
import type { Category, Library as TasteLibrary, Work } from "../../core/model";
import type { RankingDimensionOption } from "../../core/ranking";
import type { ScoreRankingMode } from "../../types/workspace";
import {
  formatRankingPreviewScore,
  getRankingDimensionName,
} from "./RankingHelpers";

interface RankingPreviewPanelProps {
  rootCategory: Category | null;
  library: TasteLibrary;
  mode: ScoreRankingMode;
  dimensionOptions: RankingDimensionOption[];
  selectedDimensionId: string | null;
  works: Work[];
  coverImageUrls: Map<string, string>;
  onOpenWork(workId: string): void;
  onExport(): Promise<void> | void;
  onModeChange(mode: ScoreRankingMode): void;
  onDimensionChange(dimensionId: string): void;
}

export function RankingPreviewPanel({
  rootCategory,
  library,
  mode,
  dimensionOptions,
  selectedDimensionId,
  works,
  coverImageUrls,
  onOpenWork,
  onExport,
  onModeChange,
  onDimensionChange,
}: RankingPreviewPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const canExport =
    rootCategory !== null &&
    works.length > 0 &&
    (mode !== "dimension" || selectedDimensionId !== null);

  async function handleExport() {
    if (!canExport) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  }

  if (!rootCategory) {
    return <p className="muted">先创建一个大分类，再查看排名。</p>;
  }

  return (
    <div className="ranking-preview">
      <div className="score-ranking-header">
        <div>
          <h3>数值排行榜</h3>
          <p>
            {mode === "dimension" && selectedDimensionId
              ? getRankingDimensionName(selectedDimensionId, dimensionOptions)
              : "综合评分"}
          </p>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || !canExport}
        >
          <ImagePlus aria-hidden="true" size={16} />
          {isExporting ? "导出中" : "导出排名图"}
        </button>
      </div>

      <section
        className="ranking-toolbar ranking-toolbar-inline"
        aria-label="分值排名筛选"
      >
        <div className="toolbar-field">
          <span>排序维度</span>
          <select
            aria-label="排序维度类型"
            value={mode}
            onChange={(event) => {
              const nextMode = event.currentTarget.value as ScoreRankingMode;
              onModeChange(nextMode);
            }}
          >
            <option value="finalScore">综合评分</option>
            <option value="dimension">单个评分维度</option>
          </select>
        </div>

        <div className="toolbar-field">
          <span>评分维度</span>
          <select
            aria-label="评分维度"
            value={selectedDimensionId ?? ""}
            onChange={(event) => onDimensionChange(event.currentTarget.value)}
            disabled={mode !== "dimension" || dimensionOptions.length === 0}
          >
            {dimensionOptions.length > 0 ? (
              dimensionOptions.map((dimension) => (
                <option key={dimension.id} value={dimension.id}>
                  {dimension.name}
                </option>
              ))
            ) : (
              <option value="">暂无可用评分维度</option>
            )}
          </select>
        </div>
      </section>

      {mode === "dimension" && dimensionOptions.length === 0 ? (
        <p className="inline-hint">先添加评分维度，再按单个维度排名。</p>
      ) : null}

      {works.length > 0 ? (
        <ol className="ranking-work-list" aria-label="排名作品">
          {works.map((work, index) => {
            const coverImageUrl = coverImageUrls.get(work.id) ?? null;
            const categoryPath = getCategoryLineage(library, work.categoryId)
              .map((category) => category.name)
              .join(" / ");

            return (
              <li className="ranking-work-row" key={work.id}>
                <span className="rank-number">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                <span className="ranking-work-cover">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="" />
                  ) : (
                    <ImagePlus aria-hidden="true" size={18} />
                  )}
                </span>
                <div className="ranking-work-copy">
                  <strong>{work.title}</strong>
                  <small>{categoryPath || rootCategory.name}</small>
                </div>
                <strong className="ranking-work-score">
                  {formatRankingPreviewScore(work, mode, selectedDimensionId)}
                </strong>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`打开 ${work.title}`}
                  onClick={() => onOpenWork(work.id)}
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="muted">这个大分类还没有作品。</p>
      )}
    </div>
  );
}
