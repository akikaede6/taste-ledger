import {
  ArrowLeft,
  Download,
  ImagePlus,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import type { Work } from "../../core/model";

type WorkDetailViewProps = {
  work: Work | null | undefined;
  coverImageUrl: string | null;
  categoryPath: string;
  fallbackCategoryPath: string;
  onEditWork: (work: Work) => void;
  onDeleteWork: () => void | Promise<void>;
  onExportCover: () => void | Promise<void>;
  onExportLong: () => void | Promise<void>;
  onBackToDashboard: () => void;
};

export function WorkDetailView({
  work,
  coverImageUrl,
  categoryPath,
  fallbackCategoryPath,
  onEditWork,
  onDeleteWork,
  onExportCover,
  onExportLong,
  onBackToDashboard,
}: WorkDetailViewProps) {
  if (!work) {
    return (
      <section className="panel">
        <p className="empty-state">先在仪表盘选择一个作品。</p>

        <button
          className="secondary-button"
          type="button"
          onClick={onBackToDashboard}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          返回仪表盘
        </button>
      </section>
    );
  }

  const displayCategoryPath = categoryPath || fallbackCategoryPath || "未分类";

  return (
    <>
      <section className="work-detail-hero">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt={`${work.title} 封面`} />
        ) : (
          <div className="cover-placeholder large">
            <ImagePlus aria-hidden="true" size={22} />
            {work.coverImagePath ?? "未设置封面"}
          </div>
        )}

        <div className="work-detail-summary">
          <small>{displayCategoryPath}</small>

          {work.tags.length > 0 ? (
            <div className="tag-list">
              {work.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <h3>{work.title}</h3>

          <p>{work.shortReview || "还没有短评，可以打开编辑补充。"}</p>

          <div className="score-grid">
            <article>
              <span>综合评分</span>
              <strong>
                {work.finalScore === null ? "未评分" : `${work.finalScore}`}
              </strong>
            </article>

            <article>
              <span>评分维度</span>
              <strong>{work.ratingDimensions.length}</strong>
            </article>
          </div>

          <div className="detail-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => onEditWork(work)}
            >
              <Pencil aria-hidden="true" size={16} />
              编辑评测
            </button>

            <button
              className="danger-button"
              type="button"
              onClick={() => void onDeleteWork()}
            >
              <Trash2 aria-hidden="true" size={16} />
              删除作品
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void onExportCover()}
            >
              <Download aria-hidden="true" size={16} />
              导出封面图
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => void onExportLong()}
            >
              <Download aria-hidden="true" size={16} />
              导出长图
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span>长评</span>
        </div>

        {work.longReview.trim() ? (
          <div className="long-review">
            {work.longReview.split(/\r?\n/).map((line, index) => (
              <p key={`${index}-${line}`}>{line.trim() || " "}</p>
            ))}
          </div>
        ) : (
          <p className="empty-state">还没有长评。</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <span>维度详情</span>
        </div>

        {work.ratingDimensions.length > 0 ? (
          <div className="dimension-score-list">
            {work.ratingDimensions.map((dimension) => (
              <article className="dimension-score-card" key={dimension.id}>
                <span>{dimension.name}</span>
                <strong>
                  <Star aria-hidden="true" size={16} />
                  {dimension.score}
                </strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">这个作品还没有评分维度。</p>
        )}
      </section>
    </>
  );
}
