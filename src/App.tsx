import {
  FolderPlus,
  Library,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { sortCategoriesByRecentUpdate } from "./core/library-actions";
import { useLibraryState } from "./core/library-store";
import type { LibraryRepository } from "./core/repository";
import { createLibraryRepository } from "./core/repository";
import { createRuntimeBackend } from "./platform/runtime-backend";

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
          </div>
        )}

        {actionError ? <p className="inline-error">{actionError}</p> : null}
      </section>
    </main>
  );
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
