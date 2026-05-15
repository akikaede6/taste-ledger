import { ImagePlus, Save, Trash2 } from "lucide-react";
import { type DragEvent, type FormEvent, useMemo, useState } from "react";
import type { TierLevel, TierLevelId, TierList, Work } from "../../core/model";
import type { TierListSaveInput } from "../../types/workspace";
import { TierWorkCard } from "./TierWorkCard";

interface TierListEditorProps {
  tierList: TierList;
  works: Work[];
  coverImageUrls: Map<string, string>;
  onSave(input: TierListSaveInput): Promise<void>;
  onDelete(): Promise<void>;
  onMoveWork(workId: string, levelId: TierLevelId): Promise<void>;
  onRemoveWork(workId: string): Promise<void>;
  onExport(input: TierListSaveInput): Promise<void>;
}

export function TierListEditor({
  tierList,
  works,
  coverImageUrls,
  onSave,
  onDelete,
  onMoveWork,
  onRemoveWork,
  onExport,
}: TierListEditorProps) {
  const [name, setName] = useState(tierList.name);
  const [levelDrafts, setLevelDrafts] = useState<TierLevel[]>(() =>
    tierList.levels.map((level) => ({
      ...level,
      workIds: [...level.workIds],
    })),
  );
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [draggedWorkId, setDraggedWorkId] = useState<string | null>(null);
  const workById = useMemo(
    () => new Map(works.map((work) => [work.id, work] as const)),
    [works],
  );
  const assignedWorkIds = useMemo(
    () => new Set(tierList.levels.flatMap((level) => level.workIds)),
    [tierList.levels],
  );
  const unassignedWorks = works.filter((work) => !assignedWorkIds.has(work.id));
  const hasAssignedWorks = tierList.levels.some(
    (level) => level.workIds.length > 0,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length === 0) {
      setDraftError("分级名称不能为空。");
      return;
    }

    setDraftError(null);
    await onSave({ name, levels: levelDrafts });
  }

  function updateLevelName(levelId: TierLevelId, nextName: string) {
    setDraftError(null);
    setLevelDrafts((current) =>
      current.map((level) =>
        level.id === levelId ? { ...level, name: nextName } : level,
      ),
    );
  }

  async function handleExport() {
    if (!hasAssignedWorks) {
      return;
    }

    if (name.trim().length === 0) {
      setDraftError("分级名称不能为空。");
      return;
    }

    setDraftError(null);
    setIsExporting(true);
    try {
      await onExport({ name, levels: levelDrafts });
    } finally {
      setIsExporting(false);
    }
  }

  function getDraggedWorkId(event: DragEvent<HTMLElement>): string | null {
    return (
      draggedWorkId ||
      event.dataTransfer.getData("text/plain") ||
      event.dataTransfer.getData("text") ||
      null
    );
  }

  function handleDragStart(workId: string, event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", workId);
    event.dataTransfer.setData("text", workId);
    setDraggedWorkId(workId);
  }

  function handleDragEnd() {
    setDraggedWorkId(null);
  }

  function handleDropToLevel(
    levelId: TierLevelId,
    event: DragEvent<HTMLElement>,
  ) {
    event.preventDefault();
    const workId = getDraggedWorkId(event);

    setDraggedWorkId(null);

    if (!workId) {
      return;
    }

    void onMoveWork(workId, levelId);
  }

  function handleDropToUnassigned(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const workId = getDraggedWorkId(event);

    setDraggedWorkId(null);

    if (!workId) {
      return;
    }

    void onRemoveWork(workId);
  }

  return (
    <div className="tier-editor">
      <form
        className="tier-editor-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label htmlFor={`tier-list-name-${tierList.id}`}>分级名称</label>
        <input
          id={`tier-list-name-${tierList.id}`}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />

        <div className="button-row">
          <button className="text-button primary" type="submit">
            <Save aria-hidden="true" size={16} />
            保存分级
          </button>
          <button
            className="text-button danger"
            type="button"
            onClick={() => void onDelete()}
          >
            <Trash2 aria-hidden="true" size={16} />
            删除分级
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || !hasAssignedWorks}
          >
            <ImagePlus aria-hidden="true" size={16} />
            {isExporting ? "导出中" : "导出分级图"}
          </button>
        </div>

        <div className="tier-level-editor">
          <div className="tier-section-heading">
            <h4>等级名称</h4>
            <small>可直接修改导出显示</small>
          </div>
          <div className="tier-level-name-grid">
            {levelDrafts.map((level, index) => (
              <div className="tier-level-name-field" key={level.id}>
                <label htmlFor={`tier-level-name-${tierList.id}-${level.id}`}>
                  等级 {index + 1}
                </label>
                <input
                  id={`tier-level-name-${tierList.id}-${level.id}`}
                  value={level.name}
                  onChange={(event) =>
                    updateLevelName(level.id, event.currentTarget.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {!hasAssignedWorks ? (
          <p className="inline-hint">至少放入一个作品后再导出分级图。</p>
        ) : null}

        {draftError ? (
          <p className="inline-error" role="alert">
            {draftError}
          </p>
        ) : null}
      </form>

      <div
        className="tier-unassigned tier-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDropToUnassigned(event)}
      >
        <div className="tier-section-heading">
          <h4>未分级作品</h4>
          <small>{unassignedWorks.length}</small>
        </div>
        {works.length === 0 ? (
          <p className="muted">这个分类还没有作品。</p>
        ) : unassignedWorks.length > 0 ? (
          <div className="tier-card-grid" aria-label="未分级作品">
            {unassignedWorks.map((work) => (
              <TierWorkCard
                key={work.id}
                work={work}
                coverImageUrl={coverImageUrls.get(work.id) ?? null}
                isDragging={draggedWorkId === work.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        ) : (
          <p className="muted">所有作品都已经放入分级。</p>
        )}
      </div>

      <div className="tier-board" aria-label="五级分级">
        {levelDrafts.map((level) => {
          const levelWorks = level.workIds.flatMap((workId) => {
            const work = workById.get(workId);
            return work ? [work] : [];
          });

          return (
            <section
              className="tier-row tier-dropzone"
              key={level.id}
              role="region"
              aria-label={`等级 ${level.name}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropToLevel(level.id, event)}
            >
              <div className={`tier-level-label ${level.id}`}>
                <strong>{level.name}</strong>
                <small>{levelWorks.length}</small>
              </div>
              {levelWorks.length > 0 ? (
                <div className="tier-card-grid">
                  {levelWorks.map((work) => (
                    <TierWorkCard
                      key={work.id}
                      work={work}
                      coverImageUrl={coverImageUrls.get(work.id) ?? null}
                      isDragging={draggedWorkId === work.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">暂无作品</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
