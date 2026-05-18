import { Download, ImagePlus } from "lucide-react";
import type { TierList, Work } from "../../core/model";
import { countTierListWorks } from "../rankings/RankingHelpers";

type SharingViewProps = {
  selectedWork: Work | null | undefined;
  selectedWorkCoverImageUrl: string | null;
  selectedWorkCategoryPath: string;
  selectedCategoryPath: string;
  selectedCategoryName: string | null;

  selectedRootCategoryName: string | null;
  rankingPreviewWorkCount: number;

  selectedTierList: TierList | null | undefined;

  onExportWorkCover: () => void | Promise<void>;
  onExportWorkLong: () => void | Promise<void>;
  onExportRankingPreview: () => void | Promise<void>;
  onExportTierList: () => void | Promise<void>;
};

export function SharingView({
  selectedWork,
  selectedWorkCoverImageUrl,
  selectedWorkCategoryPath,
  selectedCategoryPath,
  selectedCategoryName,
  selectedRootCategoryName,
  rankingPreviewWorkCount,
  selectedTierList,
  onExportWorkCover,
  onExportWorkLong,
  onExportRankingPreview,
  onExportTierList,
}: SharingViewProps) {
  return (
    <>
      <section className="content-grid two-columns">
        <article className="panel">
          <div className="section-heading">
            <span>作品导出</span>
          </div>

          {selectedWork ? (
            <>
              <div className="sharing-work-card">
                {selectedWorkCoverImageUrl ? (
                  <img
                    src={selectedWorkCoverImageUrl}
                    alt={`${selectedWork.title} 封面`}
                  />
                ) : (
                  <div className="cover-placeholder">
                    <ImagePlus aria-hidden="true" size={18} />
                    {selectedWork.coverImagePath ?? "未设置封面"}
                  </div>
                )}

                <div>
                  <small>当前作品</small>
                  <strong>{selectedWork.title}</strong>
                  <p>
                    {selectedWork.finalScore === null
                      ? "未评分"
                      : `${selectedWork.finalScore} 分`}
                  </p>
                  <small>
                    {selectedWorkCategoryPath ||
                      selectedCategoryPath ||
                      selectedCategoryName ||
                      "未分类"}
                  </small>
                </div>
              </div>

              <div className="detail-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onExportWorkCover()}
                >
                  <Download aria-hidden="true" size={16} />
                  导出封面图
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void onExportWorkLong()}
                >
                  <Download aria-hidden="true" size={16} />
                  导出长图
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state">先在仪表盘选择一个作品。</p>
          )}
        </article>

        <article className="panel">
          <div className="section-heading">
            <span>排行导出</span>
          </div>

          <p>
            {selectedRootCategoryName
              ? `当前大分类：${selectedRootCategoryName}，${rankingPreviewWorkCount} 个作品。`
              : "先选择一个大分类。"}
          </p>

          <button
            className="secondary-button"
            type="button"
            disabled={rankingPreviewWorkCount === 0}
            onClick={() => void onExportRankingPreview()}
          >
            <Download aria-hidden="true" size={16} />
            导出排名图
          </button>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span>分级导出</span>
        </div>

        <p>
          {selectedTierList
            ? `当前分级：${selectedTierList.name}，${countTierListWorks(
                selectedTierList,
              )} 个作品。`
            : "先在排行榜里创建并选择一个分级。"}
        </p>

        <button
          className="secondary-button"
          type="button"
          disabled={!selectedTierList}
          onClick={() => void onExportTierList()}
        >
          <Download aria-hidden="true" size={16} />
          导出分级图
        </button>
      </section>
    </>
  );
}
