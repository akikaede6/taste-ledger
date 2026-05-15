import { Plus, Save, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import type { Category, RatingDimensionTemplate } from "../../core/model";
import {
  createNewTemplateDraft,
  createTemplateDrafts,
  readTemplateDrafts,
  type RatingTemplateDraft,
} from "../rating/ratingDrafts";

type CategoryDimensionEditorProps = {
  category: Category;
  onSave(templates: RatingDimensionTemplate[]): Promise<void>;
};

export function CategoryDimensionEditor({
  category,
  onSave,
}: CategoryDimensionEditorProps) {
  const [drafts, setDrafts] = useState<RatingTemplateDraft[]>(() =>
    createTemplateDrafts(category.ratingDimensionTemplates),
  );
  const [draftError, setDraftError] = useState<string | null>(null);

  const templateState = useMemo(() => readTemplateDrafts(drafts), [drafts]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (templateState.errorMessage) {
      setDraftError(templateState.errorMessage);
      return;
    }

    setDraftError(null);
    await onSave(templateState.templates);
  }

  function updateTemplateDraft(
    id: string,
    field: keyof Omit<RatingTemplateDraft, "id">,
    value: string,
  ) {
    setDraftError(null);

    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              [field]: value,
            }
          : draft,
      ),
    );
  }

  function addTemplateDraft() {
    setDraftError(null);
    setDrafts((current) => [
      ...current,
      createNewTemplateDraft(current.length),
    ]);
  }

  function removeTemplateDraft(id: string) {
    setDraftError(null);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  return (
    <form
      className="dimension-editor"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="section-heading">
        <span>评分维度</span>

        <button className="text-button" type="button" onClick={addTemplateDraft}>
          <Plus aria-hidden="true" size={16} />
          添加维度
        </button>
      </div>

      <div className="dimension-editor-grid">
        {drafts.map((draft, index) => {
          const number = index + 1;
          const nameId = `category-dimension-${draft.id}`;
          const weightId = `category-weight-${draft.id}`;

          return (
            <div className="dimension-editor-row" key={draft.id}>
              <label htmlFor={nameId}>维度名称 {number}</label>
              <input
                id={nameId}
                value={draft.name}
                onChange={(event) =>
                  updateTemplateDraft(
                    draft.id,
                    "name",
                    event.currentTarget.value,
                  )
                }
              />

              <label htmlFor={weightId}>权重 {number}</label>
              <input
                id={weightId}
                inputMode="decimal"
                value={draft.weight}
                onChange={(event) =>
                  updateTemplateDraft(
                    draft.id,
                    "weight",
                    event.currentTarget.value,
                  )
                }
              />

              <button
                className="icon-button danger"
                type="button"
                aria-label={`删除评分维度 ${number}`}
                onClick={() => removeTemplateDraft(draft.id)}
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {draftError ? (
        <p className="inline-error" role="alert">
          {draftError}
        </p>
      ) : null}

      <button className="text-button primary" type="submit">
        <Save aria-hidden="true" size={16} />
        保存评分维度
      </button>
    </form>
  );
}