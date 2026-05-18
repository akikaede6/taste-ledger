import {
  FileText,
  Filter,
  ImagePlus,
  ListPlus,
  Pencil,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import type { FormEvent } from "react";
import { getCategoryLineage } from "../../core/category-tree";
import type {
  Category,
  Library as TasteLibrary,
  RatingDimensionTemplate,
  Work,
} from "../../core/model";
import { CategoryDimensionEditor } from "../category/CategoryDimensionEditor";

type TagOption = {
  value: string;
  count: number;
};

type DashboardViewProps = {
  library: TasteLibrary;

  selectedCategory: Category | null | undefined;
  selectedRootCategory: Category | null;
  categoryWorks: Work[];
  visibleWorks: Work[];
  recentWorks: Work[];
  pendingWorks: Work[];
  categoryTagOptions: TagOption[];
  activeTagFilters: string[];

  rootCategoryCount: number;
  childCategoryCount: number;
  dashboardScopeWorkCount: number;
  dashboardAverageScore: number | null;

  coverImageUrls: Map<string, string>;

  onOpenWorkDetail: (workId: string) => void;
  onCreateWork: () => void;
  onToggleTagFilter: (tag: string) => void;
  onClearTagFilters: () => void;
  onRenameCategory: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDeleteCategory: () => void | Promise<void>;
  onSaveCategoryDimensions: (
    templates: RatingDimensionTemplate[],
  ) => Promise<void>;
};

export function DashboardView({
  library,
  selectedCategory,
  selectedRootCategory,
  categoryWorks,
  visibleWorks,
  recentWorks,
  pendingWorks,
  categoryTagOptions,
  activeTagFilters,
  rootCategoryCount,
  childCategoryCount,
  dashboardScopeWorkCount,
  dashboardAverageScore,
  coverImageUrls,
  onOpenWorkDetail,
  onCreateWork,
  onToggleTagFilter,
  onClearTagFilters,
  onRenameCategory,
  onDeleteCategory,
  onSaveCategoryDimensions,
}: DashboardViewProps) {
  return (
    <>
      <section className="summary-grid">
        <article className="summary-card">
          <span>大分类</span>
          <strong>{rootCategoryCount}</strong>
        </article>

        <article className="summary-card">
          <span>子分类</span>
          <strong>{childCategoryCount}</strong>
        </article>

        <article className="summary-card">
          <span>当前作品</span>
          <strong>{dashboardScopeWorkCount}</strong>
        </article>

        <article className="summary-card">
          <span>平均评分</span>
          <strong>{dashboardAverageScore ?? "-"}</strong>
        </article>
      </section>

      <section className="content-grid two-columns">
        <article className="panel">
          <div className="section-heading">
            <span>最近评测</span>
          </div>

          {recentWorks.length > 0 ? (
            <div className="preview-list">
              {recentWorks.map((work) => (
                <DashboardWorkPreviewCard
                  key={work.id}
                  library={library}
                  work={work}
                  coverImageUrl={coverImageUrls.get(work.id) ?? null}
                  badge={
                    work.finalScore === null ? "未评分" : `${work.finalScore}`
                  }
                  onOpen={() => onOpenWorkDetail(work.id)}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">这个范围还没有作品。</p>
          )}
        </article>

        <article className="panel">
          <div className="section-heading">
            <span>待评分</span>
          </div>

          {pendingWorks.length > 0 ? (
            <div className="preview-list">
              {pendingWorks.map((work) => (
                <DashboardWorkPreviewCard
                  key={work.id}
                  library={library}
                  work={work}
                  coverImageUrl={coverImageUrls.get(work.id) ?? null}
                  badge="待评分"
                  onOpen={() => onOpenWorkDetail(work.id)}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">当前范围内的作品都已经有综合评分。</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="section-heading">
          <span>作品</span>

          <button className="text-button" type="button" onClick={onCreateWork}>
            <ListPlus aria-hidden="true" size={16} />
            添加作品
          </button>
        </div>

        <div className="tag-filter-panel">
          <div className="section-heading compact">
            <span>
              <Filter aria-hidden="true" size={16} />
              标签筛选
            </span>

            <small>{activeTagFilters.length} 已选</small>
          </div>

          {categoryTagOptions.length > 0 ? (
            <div className="tag-filter-list">
              {categoryTagOptions.map((tag) => {
                const selected = activeTagFilters.includes(tag.value);

                return (
                  <button
                    key={tag.value}
                    className={selected ? "tag-filter selected" : "tag-filter"}
                    type="button"
                    onClick={() => onToggleTagFilter(tag.value)}
                  >
                    <Tag aria-hidden="true" size={14} />
                    {tag.value}
                    <small>{tag.count}</small>
                  </button>
                );
              })}

              {activeTagFilters.length > 0 ? (
                <button
                  className="text-button"
                  type="button"
                  onClick={onClearTagFilters}
                >
                  清除筛选
                </button>
              ) : null}
            </div>
          ) : (
            <p className="empty-state">当前分类树还没有可筛选的标签。</p>
          )}
        </div>

        {categoryWorks.length === 0 ? (
          <p className="empty-state">这个分类还没有作品。</p>
        ) : visibleWorks.length > 0 ? (
          <div className="work-list">
            {visibleWorks.map((work) => (
              <button
                key={work.id}
                className="work-list-item"
                type="button"
                onClick={() => onOpenWorkDetail(work.id)}
              >
                <span>{work.title}</span>
                <small>
                  {work.finalScore === null
                    ? "未评分"
                    : `${work.finalScore} 分`}
                  {work.tags.length > 0 ? ` · ${work.tags.join(" · ")}` : ""}
                  {work.shortReview ? ` · ${work.shortReview}` : ""}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">当前标签筛选没有匹配作品。</p>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <span>分类资料</span>
        </div>

        {selectedCategory ? (
          <>
            <form className="inline-form" onSubmit={onRenameCategory}>
              <label htmlFor="categoryName">分类名称</label>
              <input
                id="categoryName"
                name="categoryName"
                defaultValue={selectedCategory.name}
              />

              <button className="secondary-button" type="submit">
                <Pencil aria-hidden="true" size={16} />
                重命名
              </button>

              <button
                className="danger-button"
                type="button"
                onClick={() => void onDeleteCategory()}
              >
                <Trash2 aria-hidden="true" size={16} />
                删除分类
              </button>
            </form>

            {selectedRootCategory &&
            selectedRootCategory.id !== selectedCategory.id ? (
              <p className="helper-text">
                这个子分类共用「{selectedRootCategory.name}」的评分维度与排行。
              </p>
            ) : null}

            {selectedRootCategory &&
            selectedRootCategory.id === selectedCategory.id ? (
              <CategoryDimensionEditor
                category={selectedRootCategory}
                onSave={onSaveCategoryDimensions}
              />
            ) : null}
          </>
        ) : (
          <p className="empty-state">
            先创建一个大分类，再添加作品、评分和分级。
          </p>
        )}
      </section>
    </>
  );
}

type DashboardWorkPreviewCardProps = {
  library: TasteLibrary;
  work: Work;
  coverImageUrl: string | null;
  badge: string;
  onOpen: () => void;
};

function DashboardWorkPreviewCard({
  library,
  work,
  coverImageUrl,
  badge,
  onOpen,
}: DashboardWorkPreviewCardProps) {
  const categoryPath = getCategoryLineage(library, work.categoryId)
    .map((category) => category.name)
    .join(" / ");

  return (
    <button className="work-preview-card" type="button" onClick={onOpen}>
      {coverImageUrl ? (
        <img src={coverImageUrl} alt={`${work.title} 封面`} />
      ) : (
        <div className="cover-placeholder">
          <ImagePlus aria-hidden="true" size={18} />
          {work.coverImagePath ?? "未设置封面"}
        </div>
      )}

      <span className="score-pill">
        <Star aria-hidden="true" size={14} />
        {badge}
      </span>

      <strong>{work.title}</strong>
      <small>{categoryPath || "未分类"}</small>
    </button>
  );
}
