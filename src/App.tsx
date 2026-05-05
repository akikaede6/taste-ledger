import {
  BookOpen,
  FileText,
  FolderPlus,
  ImagePlus,
  Library,
  ListPlus,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sortCategoriesByRecentUpdate } from "./core/library-actions";
import { useLibraryState } from "./core/library-store";
import type { RatingDimensionScore, Work } from "./core/model";
import type { LibraryRepository } from "./core/repository";
import { createLibraryRepository } from "./core/repository";
import { calculateFinalScore } from "./core/scoring";
import { createRuntimeBackend } from "./platform/runtime-backend";

interface WorkSaveInput {
  title: string;
  shortReview: string;
  longReview: string;
  ratingDimensions: RatingDimensionScore[];
}

export function App() {
  const [repository, setRepository] = useState<LibraryRepository | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void createRuntimeBackend()
      .then((backend) => {
        if (mounted) {
          setRepository(createLibraryRepository(backend));
        }
      })
      .catch((error) => {
        if (mounted) {
          setBootstrapError(
            error instanceof Error
              ? error.message
              : "Failed to initialize storage.",
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (bootstrapError) {
    return <FatalState message={bootstrapError} />;
  }

  if (!repository) {
    return <LoadingShell label="正在准备本地数据目录" />;
  }

  return <Workspace repository={repository} />;
}

function Workspace({ repository }: { repository: LibraryRepository }) {
  const { state, controller } = useLibraryState(repository);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = useMemo(
    () => sortCategoriesByRecentUpdate(state.library.categories),
    [state.library.categories],
  );
  const selectedCategory = state.selectedCategoryId
    ? state.library.categories.find(
        (category) => category.id === state.selectedCategoryId,
      )
    : null;
  const categoryWorks = selectedCategory
    ? state.library.works.filter(
        (work) => work.categoryId === selectedCategory.id,
      )
    : [];
  const selectedWork = state.selectedWorkId
    ? state.library.works.find((work) => work.id === state.selectedWorkId)
    : null;

  async function runAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败。");
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newCategoryName.trim().length === 0) {
      setActionError("分类名称不能为空。");
      return;
    }

    await runAction(async () => {
      await controller.createCategory(newCategoryName);
      setNewCategoryName("");
    });
  }

  async function handleRenameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("categoryName") ?? "");

    await runAction(async () => controller.renameSelectedCategory(name));
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) {
      return;
    }

    const confirmed = window.confirm(
      `删除分类「${selectedCategory.name}」？相关作品和排行也会删除。`,
    );

    if (!confirmed) {
      return;
    }

    await runAction(async () => controller.deleteSelectedCategory());
  }

  async function handleCreateWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newWorkTitle.trim().length === 0) {
      setActionError("作品名称不能为空。");
      return;
    }

    await runAction(async () => {
      await controller.createWork(newWorkTitle);
      setNewWorkTitle("");
    });
  }

  async function handleSaveWork(input: WorkSaveInput) {
    await runAction(async () => controller.updateSelectedWork(input));
  }

  async function handleDeleteWork() {
    if (!selectedWork) {
      return;
    }

    const confirmed = window.confirm(
      `删除作品「${selectedWork.title}」？相关排行条目也会移除。`,
    );

    if (!confirmed) {
      return;
    }

    await runAction(async () => controller.deleteSelectedWork());
  }

  async function handleStoreWorkCover(fileName: string, bytes: Uint8Array) {
    await runAction(async () =>
      controller.storeSelectedWorkCover(fileName, bytes),
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="分类">
        <div className="brand-row">
          <Library aria-hidden="true" size={24} />
          <div>
            <p className="eyebrow">Ranking</p>
            <h1>本地个人评分工具</h1>
          </div>
        </div>

        <form className="create-form" onSubmit={handleCreateCategory}>
          <label htmlFor="new-category">新分类</label>
          <div className="inline-form-row">
            <input
              id="new-category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="影视作品 / 音乐 / Drama CD"
            />
            <button
              className="icon-button primary"
              type="submit"
              aria-label="创建分类"
            >
              <FolderPlus aria-hidden="true" size={18} />
            </button>
          </div>
        </form>

        <nav className="category-list" aria-label="分类列表">
          {categories.map((category) => {
            const workCount = state.library.works.filter(
              (work) => work.categoryId === category.id,
            ).length;
            const rankingCount = state.library.rankings.filter(
              (ranking) => ranking.categoryId === category.id,
            ).length;
            const selected = category.id === state.selectedCategoryId;

            return (
              <button
                key={category.id}
                className={
                  selected ? "category-button selected" : "category-button"
                }
                type="button"
                onClick={() => controller.selectCategory(category.id)}
              >
                <span>{category.name}</span>
                <small>
                  {workCount} 作品 · {rankingCount} 排行
                </small>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{selectedCategory?.name ?? "创建第一个分类"}</h2>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => void controller.refresh()}
          >
            <RefreshCw aria-hidden="true" size={16} />
            重新载入
          </button>
        </header>

        {state.status === "loading" ? (
          <LoadingShell label="正在读取本地资料库" />
        ) : state.status === "error" ? (
          <FatalState message={state.errorMessage ?? "资料库读取失败。"} />
        ) : (
          <div className="content-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <Pencil aria-hidden="true" size={18} />
                  <h3>分类资料</h3>
                </div>

                {selectedCategory ? (
                  <form className="edit-form" onSubmit={handleRenameCategory}>
                    <label htmlFor="category-name">分类名称</label>
                    <div className="inline-form-row">
                      <input
                        key={selectedCategory.id}
                        id="category-name"
                        name="categoryName"
                        defaultValue={selectedCategory.name}
                      />
                      <button
                        className="icon-button primary"
                        type="submit"
                        aria-label="保存分类名称"
                      >
                        <Save aria-hidden="true" size={18} />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label="删除分类"
                        onClick={() => void handleDeleteCategory()}
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="muted">
                    先创建一个分类，再添加作品、评分和排行。
                  </p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <ListPlus aria-hidden="true" size={18} />
                  <h3>作品</h3>
                </div>

                <form className="create-form" onSubmit={handleCreateWork}>
                  <label htmlFor="new-work">新作品</label>
                  <div className="inline-form-row">
                    <input
                      id="new-work"
                      value={newWorkTitle}
                      onChange={(event) => setNewWorkTitle(event.target.value)}
                      placeholder="作品名"
                      disabled={!selectedCategory}
                    />
                    <button
                      className="icon-button primary"
                      type="submit"
                      aria-label="创建作品"
                      disabled={!selectedCategory}
                    >
                      <ListPlus aria-hidden="true" size={18} />
                    </button>
                  </div>
                </form>

                <div className="work-list" aria-label="作品列表">
                  {categoryWorks.length > 0 ? (
                    categoryWorks.map((work) => (
                      <button
                        key={work.id}
                        className={
                          work.id === state.selectedWorkId
                            ? "work-button selected"
                            : "work-button"
                        }
                        type="button"
                        onClick={() => controller.selectWork(work.id)}
                      >
                        <span>{work.title}</span>
                        <small>
                          {work.finalScore === null
                            ? "未评分"
                            : `${work.finalScore} 分`}
                          {work.shortReview ? ` · ${work.shortReview}` : ""}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="muted">这个分类还没有作品。</p>
                  )}
                </div>
              </section>
            </div>

            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <Library aria-hidden="true" size={18} />
                  <h3>概览</h3>
                </div>
                <dl className="stats-grid">
                  <div>
                    <dt>分类</dt>
                    <dd>{state.library.categories.length}</dd>
                  </div>
                  <div>
                    <dt>作品</dt>
                    <dd>{state.library.works.length}</dd>
                  </div>
                  <div>
                    <dt>排行</dt>
                    <dd>{state.library.rankings.length}</dd>
                  </div>
                </dl>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <FileText aria-hidden="true" size={18} />
                  <h3>作品详情</h3>
                </div>

                {selectedWork ? (
                  <WorkEditor
                    key={`${selectedWork.id}-${selectedWork.updatedAt}`}
                    work={selectedWork}
                    onSave={handleSaveWork}
                    onDelete={handleDeleteWork}
                    onCoverUpload={handleStoreWorkCover}
                  />
                ) : (
                  <p className="muted">
                    <BookOpen aria-hidden="true" size={16} />
                    选择或创建一个作品后，可以编辑封面、短评和长评。
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {actionError ? <p className="inline-error">{actionError}</p> : null}
      </section>
    </main>
  );
}

interface WorkEditorProps {
  work: Work;
  onSave(input: WorkSaveInput): Promise<void>;
  onDelete(): Promise<void>;
  onCoverUpload(fileName: string, bytes: Uint8Array): Promise<void>;
}

interface RatingDimensionDraft {
  id: string;
  name: string;
  score: string;
  weight: string;
}

interface RatingDimensionDraftState {
  errorMessage: string | null;
  finalScore: number | null;
  ratingDimensions: RatingDimensionScore[];
}

interface WorkDraft {
  title: string;
  shortReview: string;
  longReview: string;
}

function WorkEditor({
  work,
  onSave,
  onDelete,
  onCoverUpload,
}: WorkEditorProps) {
  const [workDraft, setWorkDraft] = useState<WorkDraft>(() => ({
    title: work.title,
    shortReview: work.shortReview,
    longReview: work.longReview,
  }));
  const [dimensionDrafts, setDimensionDrafts] = useState<
    RatingDimensionDraft[]
  >(() => createDimensionDrafts(work.ratingDimensions));
  const [draftError, setDraftError] = useState<string | null>(null);

  const dimensionState = useMemo(
    () => readDimensionDrafts(dimensionDrafts),
    [dimensionDrafts],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dimensionState.errorMessage) {
      setDraftError(dimensionState.errorMessage);
      return;
    }

    setDraftError(null);

    await onSave({
      ...workDraft,
      ratingDimensions: dimensionState.ratingDimensions,
    });
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    await onCoverUpload(file.name, new Uint8Array(await file.arrayBuffer()));
    event.currentTarget.value = "";
  }

  function updateDimensionDraft(
    id: string,
    field: keyof Omit<RatingDimensionDraft, "id">,
    value: string,
  ) {
    setDraftError(null);
    setDimensionDrafts((current) =>
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

  function updateWorkDraft(field: keyof WorkDraft, value: string) {
    setWorkDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addDimensionDraft() {
    setDraftError(null);
    setDimensionDrafts((current) => [
      ...current,
      createNewDimensionDraft(current.length),
    ]);
  }

  function removeDimensionDraft(id: string) {
    setDraftError(null);
    setDimensionDrafts((current) =>
      current.filter((dimension) => dimension.id !== id),
    );
  }

  const scoreLabel = dimensionState.errorMessage
    ? "评分维度需要修正后才能保存。"
    : dimensionState.finalScore === null
      ? "还没有评分维度。"
      : `当前评分 ${dimensionState.finalScore}`;

  return (
    <form
      className="detail-form"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label htmlFor="work-title">作品名</label>
      <input
        id="work-title"
        name="workTitle"
        value={workDraft.title}
        onChange={(event) =>
          updateWorkDraft("title", event.currentTarget.value)
        }
      />

      <div className="cover-row">
        <div className="cover-preview">
          <ImagePlus aria-hidden="true" size={22} />
          <span>{work.coverImagePath ?? "未设置封面"}</span>
        </div>
        <label className="file-picker">
          <ImagePlus aria-hidden="true" size={16} />
          导入封面
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void handleCoverUpload(event)}
          />
        </label>
      </div>

      <div className="dimension-editor">
        <div className="dimension-header">
          <div>
            <h4>评分维度</h4>
            <p className="score-note" aria-live="polite">
              <Star aria-hidden="true" size={16} />
              {scoreLabel}
            </p>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={addDimensionDraft}
          >
            <ListPlus aria-hidden="true" size={16} />
            添加评分维度
          </button>
        </div>

        {dimensionDrafts.length > 0 ? (
          <div className="dimension-list">
            {dimensionDrafts.map((dimension, index) => {
              const number = index + 1;
              const nameId = `${work.id}-${dimension.id}-name`;
              const scoreId = `${work.id}-${dimension.id}-score`;
              const weightId = `${work.id}-${dimension.id}-weight`;

              return (
                <div className="dimension-row" key={dimension.id}>
                  <div className="dimension-field">
                    <label htmlFor={nameId}>维度名称 {number}</label>
                    <input
                      id={nameId}
                      value={dimension.name}
                      onChange={(event) =>
                        updateDimensionDraft(
                          dimension.id,
                          "name",
                          event.currentTarget.value,
                        )
                      }
                    />
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
                        updateDimensionDraft(
                          dimension.id,
                          "score",
                          event.currentTarget.value,
                        )
                      }
                    />
                  </div>
                  <div className="dimension-field">
                    <label htmlFor={weightId}>权重 {number}</label>
                    <input
                      id={weightId}
                      type="number"
                      min="0"
                      step="any"
                      value={dimension.weight}
                      onChange={(event) =>
                        updateDimensionDraft(
                          dimension.id,
                          "weight",
                          event.currentTarget.value,
                        )
                      }
                    />
                  </div>
                  <button
                    className="icon-button danger dimension-remove"
                    type="button"
                    aria-label={`删除评分维度 ${number}`}
                    onClick={() => removeDimensionDraft(dimension.id)}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">添加一个评分维度后可以计算最终评分。</p>
        )}

        {draftError ? (
          <p className="inline-error" role="alert">
            {draftError}
          </p>
        ) : null}
      </div>

      <label htmlFor="short-review">短评</label>
      <textarea
        id="short-review"
        name="shortReview"
        value={workDraft.shortReview}
        onChange={(event) =>
          updateWorkDraft("shortReview", event.currentTarget.value)
        }
        rows={3}
      />

      <label htmlFor="long-review">长评</label>
      <textarea
        id="long-review"
        name="longReview"
        value={workDraft.longReview}
        onChange={(event) =>
          updateWorkDraft("longReview", event.currentTarget.value)
        }
        rows={8}
      />

      <div className="button-row">
        <button className="text-button primary" type="submit">
          <Save aria-hidden="true" size={16} />
          保存作品
        </button>
        <button
          className="text-button danger"
          type="button"
          onClick={() => void onDelete()}
        >
          <Trash2 aria-hidden="true" size={16} />
          删除作品
        </button>
      </div>
    </form>
  );
}

function createDimensionDrafts(
  ratingDimensions: RatingDimensionScore[],
): RatingDimensionDraft[] {
  return ratingDimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    score: String(dimension.score),
    weight: String(dimension.weight),
  }));
}

function createNewDimensionDraft(index: number): RatingDimensionDraft {
  return {
    id: `dimension-${crypto.randomUUID()}`,
    name: `维度 ${index + 1}`,
    score: "0",
    weight: "1",
  };
}

function readDimensionDrafts(
  drafts: RatingDimensionDraft[],
): RatingDimensionDraftState {
  const seenIds = new Set<string>();
  const ratingDimensions: RatingDimensionScore[] = [];

  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    const id = draft.id.trim();
    const name = draft.name.trim();
    const scoreText = draft.score.trim();
    const weightText = draft.weight.trim();

    if (id.length === 0 || seenIds.has(id)) {
      return failDimensionDraft(`评分维度 ${number} 无法保存。`);
    }

    seenIds.add(id);

    if (name.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 名称不能为空。`);
    }

    if (scoreText.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 评分不能为空。`);
    }

    const score = Number(scoreText);

    if (!Number.isFinite(score) || score < 0) {
      return failDimensionDraft(`评分维度 ${number} 评分必须是非负数字。`);
    }

    if (weightText.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 权重不能为空。`);
    }

    const weight = Number(weightText);

    if (!Number.isFinite(weight) || weight <= 0) {
      return failDimensionDraft(`评分维度 ${number} 权重必须大于 0。`);
    }

    ratingDimensions.push({
      id,
      name,
      score,
      weight,
    });
  }

  return {
    errorMessage: null,
    finalScore: calculateFinalScore(ratingDimensions),
    ratingDimensions,
  };
}

function failDimensionDraft(message: string): RatingDimensionDraftState {
  return {
    errorMessage: message,
    finalScore: null,
    ratingDimensions: [],
  };
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="center-state">
      <Loader2 aria-hidden="true" className="spin" size={24} />
      <p>{label}</p>
    </div>
  );
}

function FatalState({ message }: { message: string }) {
  return (
    <div className="center-state error-state" role="alert">
      <h2>资料库不可用</h2>
      <p>{message}</p>
    </div>
  );
}
