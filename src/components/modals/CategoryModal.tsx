import { ListPlus, Plus, Save, Trash2, X } from "lucide-react";
import { type FormEvent } from "react";
import type { Library as TasteLibrary } from "../../core/model";
import type { CategoryModalState } from "../../types/workspace";
import {
  createNewTemplateDraft,
  type RatingTemplateDraft,
} from "../rating/RatingDrafts";

export interface CategoryModalProps {
  state: CategoryModalState;
  library: TasteLibrary;
  onChange(state: CategoryModalState): void;
  onClose(): void;
  onSave(state: CategoryModalState): Promise<void> | void;
}

export function CategoryModal({
  state,
  library,
  onChange,
  onClose,
  onSave,
}: CategoryModalProps) {
  const parentCategory = state.parentCategoryId
    ? (library.categories.find(
        (category) => category.id === state.parentCategoryId,
      ) ?? null)
    : null;
  const isRootMode = state.mode === "root";
  const title = isRootMode ? "创建新大类" : "创建新小类";
  const description = isRootMode
    ? "定义分类和默认评分维度"
    : "在大类下细分作品";

  function updateName(name: string) {
    onChange({
      ...state,
      name,
    });
  }

  function updateDimensionDraft(
    id: string,
    field: keyof Omit<RatingTemplateDraft, "id">,
    value: string,
  ) {
    onChange({
      ...state,
      dimensionDrafts: state.dimensionDrafts.map((draft) =>
        draft.id === id ? { ...draft, [field]: value } : draft,
      ),
    });
  }

  function addDimensionDraft() {
    onChange({
      ...state,
      dimensionDrafts: [
        ...state.dimensionDrafts,
        createNewTemplateDraft(state.dimensionDrafts.length),
      ],
    });
  }

  function removeDimensionDraft(id: string) {
    onChange({
      ...state,
      dimensionDrafts: state.dimensionDrafts.filter((draft) => draft.id !== id),
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(state);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-shell category-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">分类</p>
            <h3 id="category-modal-title">{title}</h3>
            <p>{description}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭分类弹窗"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <form className="modal-form" noValidate onSubmit={handleSubmit}>
          {!isRootMode ? (
            <div className="modal-field">
              <label htmlFor="category-parent-name">所属大类</label>
              <input
                id="category-parent-name"
                value={parentCategory?.name ?? ""}
                readOnly
              />
            </div>
          ) : null}

          <div className="modal-field">
            <label htmlFor="category-modal-name">
              {isRootMode ? "大类名称" : "小类名称"}
            </label>
            <input
              id="category-modal-name"
              value={state.name}
              onChange={(event) => updateName(event.currentTarget.value)}
              placeholder={
                isRootMode ? "如：动画、图书、游戏" : "如：2026年1月新番"
              }
              autoFocus
            />
          </div>

          {isRootMode ? (
            <div className="modal-section">
              <div className="modal-section-heading">
                <div>
                  <h4>默认评分维度</h4>
                  <p>同一个大类及其小类会共用这些维度。</p>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={addDimensionDraft}
                >
                  <ListPlus aria-hidden="true" size={16} />
                  添加维度
                </button>
              </div>

              <div className="modal-dimension-list">
                {state.dimensionDrafts.map((draft, index) => {
                  const number = index + 1;
                  const nameId = `category-modal-dimension-${draft.id}`;
                  const weightId = `category-modal-weight-${draft.id}`;

                  return (
                    <div className="modal-dimension-row" key={draft.id}>
                      <div className="dimension-field">
                        <label htmlFor={nameId}>默认维度名称 {number}</label>
                        <input
                          id={nameId}
                          value={draft.name}
                          onChange={(event) =>
                            updateDimensionDraft(
                              draft.id,
                              "name",
                              event.currentTarget.value,
                            )
                          }
                        />
                      </div>
                      <div className="dimension-field">
                        <label htmlFor={weightId}>默认权重 {number}</label>
                        <input
                          id={weightId}
                          type="number"
                          min="0"
                          step="any"
                          value={draft.weight}
                          onChange={(event) =>
                            updateDimensionDraft(
                              draft.id,
                              "weight",
                              event.currentTarget.value,
                            )
                          }
                        />
                      </div>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={`删除默认评分维度 ${number}`}
                        onClick={() => removeDimensionDraft(draft.id)}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="inline-hint">
              小类不单独设置评分维度，会共用所属大类的维度和排行。
            </p>
          )}

          <div className="modal-actions">
            <button className="text-button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="text-button primary" type="submit">
              <Save aria-hidden="true" size={16} />
              {isRootMode ? "确认创建" : "完成创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
