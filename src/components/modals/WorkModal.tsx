import { ImagePlus, Save, Star, X } from "lucide-react";
import { type ChangeEvent, type FormEvent } from "react";
import { getCategoryLineage } from "../../core/category-tree";
import { createDisplayImageDataUrl } from "../../core/image-utils";
import type { Category, Library as TasteLibrary } from "../../core/model";
import type { WorkModalState } from "../../types/workspace";
import { readDimensionDrafts } from "../rating/RatingDrafts";
import { resolveWorkModalRootId } from "../work/WorkModalState";

interface WorkModalProps {
  state: WorkModalState;
  library: TasteLibrary;
  rootCategories: Category[];
  onChange(state: WorkModalState): void;
  onCategoryChange(categoryId: string | null): void;
  onClose(): void;
  onSave(state: WorkModalState): Promise<void> | void;
}

export function WorkModal({
  state,
  library,
  rootCategories,
  onChange,
  onCategoryChange,
  onClose,
  onSave,
}: WorkModalProps) {
  const selectedRootId =
    resolveWorkModalRootId(library, state.categoryId) ??
    rootCategories[0]?.id ??
    "";
  const selectedRootCategory =
    rootCategories.find((category) => category.id === selectedRootId) ?? null;
  const childCategories = selectedRootCategory
    ? library.categories.filter(
        (category) => category.parentCategoryId === selectedRootCategory.id,
      )
    : [];
  const subcategoryValue =
    state.categoryId && state.categoryId !== selectedRootId
      ? state.categoryId
      : "";
  const dimensionState = readDimensionDrafts(state.ratingDimensions);
  const scoreLabel = dimensionState.errorMessage
    ? "评分维度需要修正后才能保存"
    : dimensionState.finalScore === null
      ? "当前大类还没有评分维度"
      : `当前评分 ${dimensionState.finalScore}`;

  function updateField(
    field: keyof Pick<
      WorkModalState,
      "title" | "tagsText" | "shortReview" | "longReview"
    >,
    value: string,
  ) {
    onChange({
      ...state,
      [field]: value,
    });
  }

  function updateDimensionScore(id: string, score: string) {
    onChange({
      ...state,
      ratingDimensions: state.ratingDimensions.map((dimension) =>
        dimension.id === id ? { ...dimension, score } : dimension,
      ),
    });
  }

  async function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const coverPreviewUrl = await createDisplayImageDataUrl(file.name, bytes);
    onChange({
      ...state,
      coverFileName: file.name,
      coverBytes: bytes,
      coverPreviewUrl,
    });
    event.currentTarget.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(state);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell work-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">作品</p>
            <h3 id="work-modal-title">
              {state.mode === "edit" ? "编辑评测" : "添加新作品"}
            </h3>
            <p>
              {state.mode === "edit"
                ? "修改作品信息与评分详情"
                : "记录并评价你最近欣赏的媒体作品"}
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭作品弹窗"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <form className="modal-form" noValidate onSubmit={handleSubmit}>
          <div className="work-modal-grid">
            <div className="modal-column">
              <div className="modal-field">
                <label htmlFor="work-modal-title-input">作品名称</label>
                <input
                  id="work-modal-title-input"
                  value={state.title}
                  onChange={(event) =>
                    updateField("title", event.currentTarget.value)
                  }
                  placeholder="输入作品全称"
                  autoFocus
                />
              </div>

              <div className="modal-grid-two">
                <div className="modal-field">
                  <label htmlFor="work-modal-root-category">所属大类</label>
                  <select
                    id="work-modal-root-category"
                    value={selectedRootId}
                    onChange={(event) =>
                      onCategoryChange(event.currentTarget.value || null)
                    }
                  >
                    {rootCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-field">
                  <label htmlFor="work-modal-child-category">所属小类</label>
                  <select
                    id="work-modal-child-category"
                    value={subcategoryValue}
                    onChange={(event) =>
                      onCategoryChange(
                        event.currentTarget.value || selectedRootId || null,
                      )
                    }
                    disabled={selectedRootCategory === null}
                  >
                    <option value="">不使用小类</option>
                    {childCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-field">
                <label htmlFor="work-modal-tags">标签</label>
                <input
                  id="work-modal-tags"
                  value={state.tagsText}
                  onChange={(event) =>
                    updateField("tagsText", event.currentTarget.value)
                  }
                  placeholder="新番, 2026年1月, 原创"
                />
              </div>

              <div className="cover-row">
                <div className="cover-preview">
                  {state.coverPreviewUrl ? (
                    <img src={state.coverPreviewUrl} alt="" />
                  ) : (
                    <ImagePlus aria-hidden="true" size={22} />
                  )}
                  <span>{state.coverFileName ?? "未设置封面"}</span>
                </div>
                <label className="file-picker">
                  <ImagePlus aria-hidden="true" size={16} />
                  导入封面
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleCoverChange(event)}
                  />
                </label>
              </div>
            </div>

            <div className="modal-column">
              <div className="modal-section compact">
                <div className="modal-section-heading">
                  <div>
                    <h4>维度评分</h4>
                    <p className="score-note" aria-live="polite">
                      <Star aria-hidden="true" size={16} />
                      {scoreLabel}
                    </p>
                  </div>
                </div>

                {state.ratingDimensions.length > 0 ? (
                  <div className="dimension-list">
                    {state.ratingDimensions.map((dimension, index) => {
                      const number = index + 1;
                      const scoreId = `work-modal-score-${dimension.id}`;

                      return (
                        <div
                          className="dimension-row work-dimension-row modal-work-score-row"
                          key={dimension.id}
                        >
                          <div className="dimension-summary">
                            <strong>{dimension.name}</strong>
                            <small>权重 {dimension.weight}</small>
                          </div>
                          <div className="dimension-field">
                            <label htmlFor={scoreId}>评分 {number}</label>
                            <input
                              id={scoreId}
                              type="number"
                              min="0"
                              step="any"
                              value={dimension.score}
                              onChange={(event) =>
                                updateDimensionScore(
                                  dimension.id,
                                  event.currentTarget.value,
                                )
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">先在大类里设置评分维度。</p>
                )}
              </div>

              <div className="modal-field">
                <label htmlFor="work-modal-short-review">短评</label>
                <input
                  id="work-modal-short-review"
                  value={state.shortReview}
                  onChange={(event) =>
                    updateField("shortReview", event.currentTarget.value)
                  }
                  placeholder="一句话总结核心感受"
                />
              </div>

              <div className="modal-field">
                <label htmlFor="work-modal-long-review">长评</label>
                <textarea
                  id="work-modal-long-review"
                  value={state.longReview}
                  onChange={(event) =>
                    updateField("longReview", event.currentTarget.value)
                  }
                  placeholder="写下完整评测"
                  rows={6}
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="text-button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="text-button primary" type="submit">
              <Save aria-hidden="true" size={16} />
              保存作品
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
