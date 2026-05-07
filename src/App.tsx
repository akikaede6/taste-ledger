import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ClipboardCopy,
  Download,
  FileText,
  FolderPlus,
  FolderOpen,
  ImagePlus,
  Library,
  Layers,
  ListPlus,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  sortCategoriesByRecentUpdate,
  sortRankingsByRecentUpdate,
  sortTierListsByRecentUpdate,
} from "./core/library-actions";
import { useLibraryState } from "./core/library-store";
import type {
  Category,
  Ranking,
  RankingMode,
  RatingDimensionScore,
  RatingDimensionTemplate,
  TierLevelId,
  TierList,
  Work,
} from "./core/model";
import {
  collectRankingDimensionOptions,
  getRankingWorks,
  type RankingDimensionOption,
} from "./core/ranking";
import {
  convertSvgTextToExportFile,
  copyImageToClipboard,
  createDisplayImageDataUrl,
  createSvgDataUrl,
} from "./core/image-utils";
import type { LibraryRepository } from "./core/repository";
import { createLibraryRepository } from "./core/repository";
import { calculateFinalScore } from "./core/scoring";
import type { ShareImageFile, WorkShareVariant } from "./core/share-export";
import { createRuntimeBackend } from "./platform/runtime-backend";
import { getDesktopBridge } from "./platform/runtime-bridge";

interface WorkSaveInput {
  title: string;
  shortReview: string;
  longReview: string;
  ratingDimensions: RatingDimensionScore[];
}

interface RankingSaveInput {
  name: string;
  mode: RankingMode;
  dimensionId: string | null;
}

interface TierListSaveInput {
  name: string;
}

interface ExportDialogState {
  title: string;
  svgText: string;
  previewUrl: string;
  fileNameBase: string;
  canRasterize: boolean;
}

interface ExportPreferences {
  directory: string | null;
}

const RANKING_MODE_LABELS: Record<RankingMode, string> = {
  finalScore: "最终评分",
  dimension: "单维度评分",
  manual: "手动排序",
};

const EXPORT_DIRECTORY_KEY = "taste-ledger:export-directory";

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
  const [newRankingName, setNewRankingName] = useState("");
  const [newRankingMode, setNewRankingMode] =
    useState<RankingMode>("finalScore");
  const [newRankingDimensionId, setNewRankingDimensionId] = useState("");
  const [newTierListName, setNewTierListName] = useState("五级分级");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState<ExportDialogState | null>(
    null,
  );
  const [exportPreferences, setExportPreferences] = useState<ExportPreferences>(
    () => loadExportPreferences(),
  );
  const desktopBridge = getDesktopBridge();

  const categories = useMemo(
    () => sortCategoriesByRecentUpdate(state.library.categories),
    [state.library.categories],
  );
  const selectedCategory = state.selectedCategoryId
    ? state.library.categories.find(
        (category) => category.id === state.selectedCategoryId,
      )
    : null;
  const categoryWorks = useMemo(
    () =>
      selectedCategory
        ? state.library.works.filter(
            (work) => work.categoryId === selectedCategory.id,
          )
        : [],
    [selectedCategory, state.library.works],
  );
  const categoryRankings = selectedCategory
    ? sortRankingsByRecentUpdate(
        state.library.rankings.filter(
          (ranking) => ranking.categoryId === selectedCategory.id,
        ),
      )
    : [];
  const categoryTierLists = selectedCategory
    ? sortTierListsByRecentUpdate(
        state.library.tierLists.filter(
          (tierList) => tierList.categoryId === selectedCategory.id,
        ),
      )
    : [];
  const rankingDimensionOptions = selectedCategory
    ? collectRankingDimensionOptions(selectedCategory.ratingDimensionTemplates)
    : [];
  const selectedWork = state.selectedWorkId
    ? state.library.works.find((work) => work.id === state.selectedWorkId)
    : null;
  const selectedRanking = state.selectedRankingId
    ? state.library.rankings.find(
        (ranking) => ranking.id === state.selectedRankingId,
      )
    : null;
  const selectedTierList = state.selectedTierListId
    ? state.library.tierLists.find(
        (tierList) =>
          tierList.id === state.selectedTierListId &&
          tierList.categoryId === selectedCategory?.id,
      )
    : null;
  const selectedRankingWorks = selectedRanking
    ? getRankingWorks(state.library, selectedRanking)
    : [];
  const coverImageUrls = useCoverImageUrls(repository, categoryWorks);

  useEffect(() => {
    storeExportPreferences(exportPreferences);
  }, [exportPreferences]);

  async function runAction<T>(action: () => Promise<T>): Promise<T | null> {
    setActionError(null);
    setActionMessage(null);
    try {
      return await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败。");
      return null;
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

  async function handleSaveCategoryDimensions(
    templates: RatingDimensionTemplate[],
  ) {
    await runAction(async () =>
      controller.updateSelectedCategoryRatingDimensions(templates),
    );
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) {
      return;
    }

    const confirmed = window.confirm(
      `删除分类「${selectedCategory.name}」？相关作品、排行和分级也会删除。`,
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
      `删除作品「${selectedWork.title}」？相关排行和分级条目也会移除。`,
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

  async function openExportDialog(
    title: string,
    createShareFile: () => Promise<ShareImageFile>,
  ) {
    const shareFile = await runAction(createShareFile);

    if (!shareFile) {
      return;
    }

    const svgText = new TextDecoder().decode(shareFile.bytes);
    setExportDialog({
      title,
      svgText,
      previewUrl: createSvgDataUrl(svgText),
      fileNameBase: sanitizeExportFileStem(shareFile.id),
      canRasterize: canRasterizeSvgForExport(),
    });
  }

  async function handleExportWorkShare(variant: WorkShareVariant) {
    const label = variant === "cover" ? "作品封面图预览" : "作品长图预览";
    await openExportDialog(label, () =>
      controller.prepareSelectedWorkShare(variant),
    );
  }

  async function handleExportRankingShare() {
    await openExportDialog("排行长图预览", () =>
      controller.prepareSelectedRankingShare(),
    );
  }

  async function handleExportTierListShare() {
    await openExportDialog("五级分级预览", () =>
      controller.prepareSelectedTierListShare(),
    );
  }

  function closeExportDialog() {
    setExportDialog(null);
  }

  async function handleCreateRanking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCategory) {
      return;
    }

    const name = newRankingName.trim();

    if (name.length === 0) {
      setActionError("排行名称不能为空。");
      return;
    }

    if (newRankingMode === "manual" && categoryWorks.length === 0) {
      setActionError("手动排行需要至少一个作品。");
      return;
    }

    const selectedDimensionId =
      newRankingMode === "dimension"
        ? getRankingDimensionValue(
            newRankingDimensionId,
            rankingDimensionOptions,
          )
        : null;

    if (newRankingMode === "dimension" && !selectedDimensionId) {
      setActionError("先为当前分类添加可用评分维度。");
      return;
    }

    await runAction(async () => {
      await controller.createRanking({
        categoryId: selectedCategory.id,
        name,
        mode: newRankingMode,
        dimensionId: selectedDimensionId,
      });
      setNewRankingName("");
      setNewRankingMode("finalScore");
      setNewRankingDimensionId("");
    });
  }

  async function handleSaveRanking(input: RankingSaveInput) {
    await runAction(async () => controller.updateSelectedRanking(input));
  }

  async function handleDeleteRanking() {
    if (!selectedRanking) {
      return;
    }

    const confirmed = window.confirm(`删除排行「${selectedRanking.name}」？`);

    if (!confirmed) {
      return;
    }

    await runAction(async () => controller.deleteSelectedRanking());
  }

  async function handleMoveRankingWork(workId: string, direction: -1 | 1) {
    await runAction(async () =>
      controller.moveSelectedRankingWork(workId, direction),
    );
  }

  async function handleCreateTierList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCategory) {
      return;
    }

    const name = newTierListName.trim();

    if (name.length === 0) {
      setActionError("分级名称不能为空。");
      return;
    }

    await runAction(async () => {
      await controller.createTierList({
        categoryId: selectedCategory.id,
        name,
      });
      setNewTierListName("五级分级");
    });
  }

  async function handleSaveTierList(input: TierListSaveInput) {
    await runAction(async () => controller.updateSelectedTierList(input));
  }

  async function handleDeleteTierList() {
    if (!selectedTierList) {
      return;
    }

    const confirmed = window.confirm(`删除分级「${selectedTierList.name}」？`);

    if (!confirmed) {
      return;
    }

    await runAction(async () => controller.deleteSelectedTierList());
  }

  async function handleMoveTierListWork(workId: string, levelId: TierLevelId) {
    await runAction(async () =>
      controller.moveSelectedTierListWork(workId, levelId),
    );
  }

  async function handleRemoveTierListWork(workId: string) {
    await runAction(async () => controller.removeSelectedTierListWork(workId));
  }

  async function handleChooseExportDirectory() {
    if (!desktopBridge) {
      return;
    }

    const directory = await runAction(async () =>
      desktopBridge.chooseDirectory(),
    );

    if (directory) {
      setExportPreferences({ directory });
    }
  }

  async function handleCopyExportImage() {
    if (!exportDialog) {
      return;
    }

    const file = await runAction(async () =>
      convertSvgTextToExportFile(exportDialog.svgText),
    );

    if (!file) {
      return;
    }

    if (file.mimeType !== "image/png") {
      setActionError("当前环境无法复制位图预览。");
      return;
    }

    const copied = await runAction(async () => {
      if (desktopBridge) {
        await desktopBridge.copyImage(file.bytes);
        return true;
      }

      await copyImageToClipboard(file.bytes, file.mimeType);
      return true;
    });

    if (copied) {
      setActionMessage("已复制图片到剪贴板。");
      setExportDialog(null);
    }
  }

  async function handleSaveExportFile() {
    if (!exportDialog) {
      return;
    }

    const file = await runAction(async () =>
      convertSvgTextToExportFile(exportDialog.svgText),
    );

    if (!file) {
      return;
    }

    const fileName = `${exportDialog.fileNameBase}.${file.extension}`;

    if (desktopBridge) {
      let directory = exportPreferences.directory;

      if (!directory) {
        const selectedDirectory = await runAction(async () =>
          desktopBridge.chooseDirectory(),
        );

        if (!selectedDirectory) {
          return;
        }

        directory = selectedDirectory;
        setExportPreferences({ directory });
      }

      const savedPath = await runAction(async () =>
        desktopBridge.writeFile({
          directory,
          fileName,
          bytes: file.bytes,
        }),
      );

      if (savedPath) {
        setActionMessage(`已导出：${savedPath}`);
        setExportDialog(null);
      }

      return;
    }

    downloadFile(file.bytes, fileName, file.mimeType);
    setActionMessage(`已开始下载：${fileName}`);
    setExportDialog(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="分类">
        <div className="brand-row">
          <Library aria-hidden="true" size={24} />
          <div>
            <p className="eyebrow">Taste Ledger</p>
            <h1>Taste Ledger</h1>
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
            const tierListCount = state.library.tierLists.filter(
              (tierList) => tierList.categoryId === category.id,
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
                  {workCount} 作品 · {rankingCount} 排行 · {tierListCount} 分级
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
                  <>
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
                    <CategoryDimensionEditor
                      key={`${selectedCategory.id}-${selectedCategory.updatedAt}`}
                      category={selectedCategory}
                      onSave={handleSaveCategoryDimensions}
                    />
                  </>
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

              <section className="panel">
                <div className="panel-heading">
                  <Trophy aria-hidden="true" size={18} />
                  <h3>排行</h3>
                </div>

                {selectedCategory ? (
                  <>
                    <form
                      className="create-form ranking-create-form"
                      onSubmit={handleCreateRanking}
                    >
                      <label htmlFor="new-ranking">新排行</label>
                      <input
                        id="new-ranking"
                        value={newRankingName}
                        onChange={(event) =>
                          setNewRankingName(event.target.value)
                        }
                        placeholder="输入排行名称"
                      />

                      <div className="ranking-create-grid">
                        <label className="sr-only" htmlFor="new-ranking-mode">
                          排行方式
                        </label>
                        <select
                          id="new-ranking-mode"
                          value={newRankingMode}
                          onChange={(event) => {
                            const mode = event.target.value as RankingMode;
                            setNewRankingMode(mode);
                            if (mode !== "dimension") {
                              setNewRankingDimensionId("");
                            }
                          }}
                        >
                          <option value="finalScore">最终评分</option>
                          <option value="dimension">单维度评分</option>
                          <option value="manual">手动排序</option>
                        </select>

                        <label
                          className="sr-only"
                          htmlFor="new-ranking-dimension"
                        >
                          评分维度
                        </label>
                        <select
                          id="new-ranking-dimension"
                          value={getRankingDimensionValue(
                            newRankingDimensionId,
                            rankingDimensionOptions,
                          )}
                          onChange={(event) =>
                            setNewRankingDimensionId(event.target.value)
                          }
                          disabled={
                            newRankingMode !== "dimension" ||
                            rankingDimensionOptions.length === 0
                          }
                        >
                          {rankingDimensionOptions.length > 0 ? (
                            rankingDimensionOptions.map((dimension) => (
                              <option key={dimension.id} value={dimension.id}>
                                {dimension.name}
                              </option>
                            ))
                          ) : (
                            <option value="">暂无可用评分维度</option>
                          )}
                        </select>

                        <button
                          className="icon-button primary"
                          type="submit"
                          aria-label="创建排行"
                        >
                          <ListPlus aria-hidden="true" size={18} />
                        </button>
                      </div>
                    </form>

                    <div className="ranking-list" aria-label="排行列表">
                      {categoryRankings.length > 0 ? (
                        categoryRankings.map((ranking) => {
                          const selected =
                            ranking.id === state.selectedRankingId;

                          return (
                            <button
                              key={ranking.id}
                              className={
                                selected
                                  ? "ranking-button selected"
                                  : "ranking-button"
                              }
                              type="button"
                              onClick={() =>
                                controller.selectRanking(ranking.id)
                              }
                            >
                              <span>{ranking.name}</span>
                              <small>
                                {RANKING_MODE_LABELS[ranking.mode]}
                                {ranking.mode === "dimension" &&
                                ranking.dimensionId
                                  ? ` · ${getRankingDimensionName(
                                      ranking.dimensionId,
                                      rankingDimensionOptions,
                                    )}`
                                  : ""}
                                {" · "}
                                {ranking.workIds.length} 作品
                              </small>
                            </button>
                          );
                        })
                      ) : (
                        <p className="muted">这个分类还没有排行。</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="muted">先创建一个分类，再创建排行。</p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <Layers aria-hidden="true" size={18} />
                  <h3>五级分级</h3>
                </div>

                {selectedCategory ? (
                  <>
                    <form
                      className="create-form tier-create-form"
                      onSubmit={handleCreateTierList}
                    >
                      <label htmlFor="new-tier-list">新分级</label>
                      <div className="inline-form-row">
                        <input
                          id="new-tier-list"
                          value={newTierListName}
                          onChange={(event) =>
                            setNewTierListName(event.target.value)
                          }
                          placeholder="五级分级"
                        />
                        <button
                          className="icon-button primary"
                          type="submit"
                          aria-label="创建分级"
                        >
                          <ListPlus aria-hidden="true" size={18} />
                        </button>
                      </div>
                    </form>

                    <div className="tier-list" aria-label="分级列表">
                      {categoryTierLists.length > 0 ? (
                        categoryTierLists.map((tierList) => {
                          const selected =
                            tierList.id === state.selectedTierListId;
                          const assignedCount = countTierListWorks(tierList);

                          return (
                            <button
                              key={tierList.id}
                              className={
                                selected
                                  ? "tier-list-button selected"
                                  : "tier-list-button"
                              }
                              type="button"
                              onClick={() =>
                                controller.selectTierList(tierList.id)
                              }
                            >
                              <span>{tierList.name}</span>
                              <small>{assignedCount} 作品</small>
                            </button>
                          );
                        })
                      ) : (
                        <p className="muted">这个分类还没有五级分级。</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="muted">先创建一个分类，再创建分级。</p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <Layers aria-hidden="true" size={18} />
                  <h3>分级详情</h3>
                </div>

                {selectedTierList ? (
                  <TierListEditor
                    key={`${selectedTierList.id}-${selectedTierList.updatedAt}`}
                    tierList={selectedTierList}
                    works={categoryWorks}
                    coverImageUrls={coverImageUrls}
                    onSave={handleSaveTierList}
                    onDelete={handleDeleteTierList}
                    onMoveWork={handleMoveTierListWork}
                    onRemoveWork={handleRemoveTierListWork}
                    onExport={handleExportTierListShare}
                  />
                ) : (
                  <p className="muted">
                    创建一个五级分级后，可以把作品放进 S 到 D。
                  </p>
                )}
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
                  <div>
                    <dt>分级</dt>
                    <dd>{state.library.tierLists.length}</dd>
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
                    categoryName={selectedCategory?.name ?? ""}
                    coverImageUrl={coverImageUrls.get(selectedWork.id) ?? null}
                    onSave={handleSaveWork}
                    onDelete={handleDeleteWork}
                    onCoverUpload={handleStoreWorkCover}
                    onExport={handleExportWorkShare}
                  />
                ) : (
                  <p className="muted">
                    <BookOpen aria-hidden="true" size={16} />
                    选择或创建一个作品后，可以编辑封面、短评和长评。
                  </p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <Trophy aria-hidden="true" size={18} />
                  <h3>排行详情</h3>
                </div>

                {selectedRanking ? (
                  <RankingEditor
                    key={`${selectedRanking.id}-${selectedRanking.updatedAt}`}
                    ranking={selectedRanking}
                    works={selectedRankingWorks}
                    dimensionOptions={rankingDimensionOptions}
                    onSave={handleSaveRanking}
                    onDelete={handleDeleteRanking}
                    onMoveWork={handleMoveRankingWork}
                    onExport={handleExportRankingShare}
                  />
                ) : (
                  <p className="muted">
                    选择或创建一个排行后，可以查看排序结果。
                  </p>
                )}
              </section>
            </div>
          </div>
        )}

        {actionError ? <p className="inline-error">{actionError}</p> : null}
        {actionMessage ? (
          <p className="inline-message" role="status">
            {actionMessage}
          </p>
        ) : null}

        {exportDialog ? (
          <div
            className="export-overlay"
            role="presentation"
            onClick={closeExportDialog}
          >
            <div
              className="export-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="export-dialog-header">
                <div>
                  <p className="eyebrow">导出预览</p>
                  <h3 id="export-dialog-title">{exportDialog.title}</h3>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="关闭导出预览"
                  onClick={closeExportDialog}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>

              <div className="export-dialog-preview">
                <img src={exportDialog.previewUrl} alt={exportDialog.title} />
              </div>

              <div className="export-dialog-meta">
                <p className="muted">
                  预览文件：{exportDialog.fileNameBase}.
                  {exportDialog.canRasterize ? "png" : "svg"}
                </p>

                {desktopBridge ? (
                  <div className="export-directory-row">
                    <div>
                      <label>导出文件夹</label>
                      <p className="export-directory-path">
                        {exportPreferences.directory ?? "未选择"}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void handleChooseExportDirectory()}
                    >
                      <FolderOpen aria-hidden="true" size={16} />
                      选择文件夹
                    </button>
                  </div>
                ) : (
                  <p className="inline-hint">浏览器环境会直接下载文件。</p>
                )}
              </div>

              <div className="button-row export-dialog-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void handleCopyExportImage()}
                  disabled={
                    !exportDialog.canRasterize ||
                    (!desktopBridge && !canCopyImageToClipboard())
                  }
                >
                  <ClipboardCopy aria-hidden="true" size={16} />
                  复制图片
                </button>
                <button
                  className="text-button primary"
                  type="button"
                  onClick={() => void handleSaveExportFile()}
                >
                  <Download aria-hidden="true" size={16} />
                  导出文件
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={closeExportDialog}
                >
                  <X aria-hidden="true" size={16} />
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

interface WorkEditorProps {
  work: Work;
  categoryName: string;
  coverImageUrl: string | null;
  onSave(input: WorkSaveInput): Promise<void>;
  onDelete(): Promise<void>;
  onCoverUpload(fileName: string, bytes: Uint8Array): Promise<void>;
  onExport(variant: WorkShareVariant): Promise<void>;
}

interface CategoryDimensionEditorProps {
  category: Category;
  onSave(templates: RatingDimensionTemplate[]): Promise<void>;
}

interface RatingTemplateDraft {
  id: string;
  name: string;
  weight: string;
}

interface RatingTemplateDraftState {
  errorMessage: string | null;
  templates: RatingDimensionTemplate[];
}

function CategoryDimensionEditor({
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
      className="category-dimension-editor"
      noValidate
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="dimension-header">
        <h4>分类评分维度</h4>
        <button
          className="text-button"
          type="button"
          onClick={addTemplateDraft}
        >
          <ListPlus aria-hidden="true" size={16} />
          添加评分维度
        </button>
      </div>

      {drafts.length > 0 ? (
        <div className="dimension-list">
          {drafts.map((draft, index) => {
            const number = index + 1;
            const nameId = `${category.id}-${draft.id}-template-name`;
            const weightId = `${category.id}-${draft.id}-template-weight`;

            return (
              <div className="dimension-row template-row" key={draft.id}>
                <div className="dimension-field">
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
                </div>
                <div className="dimension-field">
                  <label htmlFor={weightId}>权重 {number}</label>
                  <input
                    id={weightId}
                    type="number"
                    min="0"
                    step="any"
                    value={draft.weight}
                    onChange={(event) =>
                      updateTemplateDraft(
                        draft.id,
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
                  onClick={() => removeTemplateDraft(draft.id)}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">这个分类还没有评分维度。</p>
      )}

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
  categoryName,
  coverImageUrl,
  onSave,
  onDelete,
  onCoverUpload,
  onExport,
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
  const [exportingVariant, setExportingVariant] =
    useState<WorkShareVariant | null>(null);

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

  async function handleExport(variant: WorkShareVariant) {
    setExportingVariant(variant);
    try {
      await onExport(variant);
    } finally {
      setExportingVariant(null);
    }
  }

  function updateDimensionDraft(id: string, value: string) {
    setDraftError(null);
    setDimensionDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              score: value,
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

  const scoreLabel = dimensionState.errorMessage
    ? "评分维度需要修正后才能保存。"
    : dimensionState.finalScore === null
      ? "当前分类还没有评分维度。"
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
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" />
          ) : (
            <ImagePlus aria-hidden="true" size={22} />
          )}
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

      <div className="work-share-preview" aria-label="作品分享预览">
        <div className="work-share-preview-cover">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" />
          ) : (
            (work.coverImagePath ?? "未设置封面")
          )}
        </div>
        <div className="work-share-preview-copy">
          <p className="eyebrow">{categoryName || "未分类"}</p>
          <strong>{work.title}</strong>
          <small>
            {work.finalScore === null ? "未评分" : `${work.finalScore} 分`}
          </small>
          {work.shortReview ? <p>{work.shortReview}</p> : null}
        </div>
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
        </div>

        {dimensionDrafts.length > 0 ? (
          <div className="dimension-list">
            {dimensionDrafts.map((dimension, index) => {
              const number = index + 1;
              const scoreId = `${work.id}-${dimension.id}-score`;

              return (
                <div
                  className="dimension-row work-dimension-row"
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
                        updateDimensionDraft(
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

      <div className="button-row">
        <button
          className="text-button"
          type="button"
          onClick={() => void handleExport("cover")}
          disabled={exportingVariant !== null}
        >
          <ImagePlus aria-hidden="true" size={16} />
          {exportingVariant === "cover" ? "导出中" : "导出封面图"}
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => void handleExport("long")}
          disabled={exportingVariant !== null}
        >
          <FileText aria-hidden="true" size={16} />
          {exportingVariant === "long" ? "导出中" : "导出长图"}
        </button>
      </div>
    </form>
  );
}

interface RankingEditorProps {
  ranking: Ranking;
  works: Work[];
  dimensionOptions: RankingDimensionOption[];
  onSave(input: RankingSaveInput): Promise<void>;
  onDelete(): Promise<void>;
  onMoveWork(workId: string, direction: -1 | 1): Promise<void>;
  onExport(): Promise<void>;
}

interface RankingDraft {
  name: string;
  mode: RankingMode;
  dimensionId: string;
}

function RankingEditor({
  ranking,
  works,
  dimensionOptions,
  onSave,
  onDelete,
  onMoveWork,
  onExport,
}: RankingEditorProps) {
  const [draft, setDraft] = useState<RankingDraft>(() => ({
    name: ranking.name,
    mode: ranking.mode,
    dimensionId: ranking.dimensionId ?? "",
  }));
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const editorDimensions = useMemo(
    () => ensureRankingDimensionOption(dimensionOptions, ranking.dimensionId),
    [dimensionOptions, ranking.dimensionId],
  );
  const selectedDimensionId = getRankingDimensionValue(
    draft.dimensionId,
    editorDimensions,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft.name.trim().length === 0) {
      setDraftError("排行名称不能为空。");
      return;
    }

    if (draft.mode === "dimension" && !selectedDimensionId) {
      setDraftError("先为当前分类添加可用评分维度。");
      return;
    }

    if (draft.mode === "manual" && works.length === 0) {
      setDraftError("手动排行需要至少一个作品。");
      return;
    }

    setDraftError(null);

    await onSave({
      name: draft.name,
      mode: draft.mode,
      dimensionId: draft.mode === "dimension" ? selectedDimensionId : null,
    });
  }

  async function handleExport() {
    if (works.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="ranking-editor">
      <form
        className="ranking-editor-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label htmlFor={`ranking-name-${ranking.id}`}>排行名称</label>
        <input
          id={`ranking-name-${ranking.id}`}
          value={draft.name}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              name: event.currentTarget.value,
            }))
          }
        />

        <div className="ranking-editor-grid">
          <div>
            <label htmlFor={`ranking-mode-${ranking.id}`}>排行方式</label>
            <select
              id={`ranking-mode-${ranking.id}`}
              value={draft.mode}
              onChange={(event) => {
                const mode = event.currentTarget.value as RankingMode;
                setDraft((current) => ({
                  ...current,
                  mode,
                  dimensionId: mode === "dimension" ? current.dimensionId : "",
                }));
              }}
            >
              <option value="finalScore">最终评分</option>
              <option value="dimension">单维度评分</option>
              <option value="manual">手动排序</option>
            </select>
          </div>

          <div>
            <label htmlFor={`ranking-dimension-${ranking.id}`}>评分维度</label>
            <select
              id={`ranking-dimension-${ranking.id}`}
              value={selectedDimensionId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dimensionId: event.currentTarget.value,
                }))
              }
              disabled={
                draft.mode !== "dimension" || editorDimensions.length === 0
              }
            >
              {editorDimensions.length > 0 ? (
                editorDimensions.map((dimension) => (
                  <option key={dimension.id} value={dimension.id}>
                    {dimension.name}
                  </option>
                ))
              ) : (
                <option value="">暂无可用评分维度</option>
              )}
            </select>
          </div>
        </div>

        <div className="button-row">
          <button className="text-button primary" type="submit">
            <Save aria-hidden="true" size={16} />
            保存排行
          </button>
          <button
            className="text-button danger"
            type="button"
            onClick={() => void onDelete()}
          >
            <Trash2 aria-hidden="true" size={16} />
            删除排行
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || works.length === 0}
          >
            <ImagePlus aria-hidden="true" size={16} />
            {isExporting ? "导出中" : "导出排行长图"}
          </button>
        </div>

        {works.length === 0 ? (
          <p className="inline-hint">先添加作品，再导出排行长图。</p>
        ) : null}

        {draftError ? (
          <p className="inline-error" role="alert">
            {draftError}
          </p>
        ) : null}
      </form>

      {works.length > 0 ? (
        <ol className="ranking-work-list" aria-label="排行作品">
          {works.map((work, index) => (
            <li className="ranking-work-row" key={work.id}>
              <span className="rank-number">{index + 1}</span>
              <div className="ranking-work-copy">
                <strong>{work.title}</strong>
                <small>{formatRankingWorkScore(work, ranking)}</small>
              </div>
              {ranking.mode === "manual" ? (
                <div className="ranking-work-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`上移 ${work.title}`}
                    disabled={index === 0}
                    onClick={() => void onMoveWork(work.id, -1)}
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`下移 ${work.title}`}
                    disabled={index === works.length - 1}
                    onClick={() => void onMoveWork(work.id, 1)}
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">这个排行还没有作品。</p>
      )}
    </div>
  );
}

interface TierListEditorProps {
  tierList: TierList;
  works: Work[];
  coverImageUrls: Map<string, string>;
  onSave(input: TierListSaveInput): Promise<void>;
  onDelete(): Promise<void>;
  onMoveWork(workId: string, levelId: TierLevelId): Promise<void>;
  onRemoveWork(workId: string): Promise<void>;
  onExport(): Promise<void>;
}

function TierListEditor({
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
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
    await onSave({ name });
  }

  async function handleExport() {
    if (!hasAssignedWorks) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
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

        {!hasAssignedWorks ? (
          <p className="inline-hint">至少放入一个作品后再导出分级图。</p>
        ) : null}

        {draftError ? (
          <p className="inline-error" role="alert">
            {draftError}
          </p>
        ) : null}
      </form>

      <div className="tier-unassigned">
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
                levels={tierList.levels}
                currentLevelId={null}
                onMoveWork={onMoveWork}
                onRemoveWork={onRemoveWork}
              />
            ))}
          </div>
        ) : (
          <p className="muted">所有作品都已经放入分级。</p>
        )}
      </div>

      <div className="tier-board" aria-label="五级分级">
        {tierList.levels.map((level) => {
          const levelWorks = level.workIds.flatMap((workId) => {
            const work = workById.get(workId);
            return work ? [work] : [];
          });

          return (
            <section className="tier-row" key={level.id}>
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
                      levels={tierList.levels}
                      currentLevelId={level.id}
                      onMoveWork={onMoveWork}
                      onRemoveWork={onRemoveWork}
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

interface TierWorkCardProps {
  work: Work;
  coverImageUrl: string | null;
  levels: TierList["levels"];
  currentLevelId: TierLevelId | null;
  onMoveWork(workId: string, levelId: TierLevelId): Promise<void>;
  onRemoveWork(workId: string): Promise<void>;
}

function TierWorkCard({
  work,
  coverImageUrl,
  levels,
  currentLevelId,
  onMoveWork,
  onRemoveWork,
}: TierWorkCardProps) {
  return (
    <article className="tier-work-card">
      <div className="tier-work-cover">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" />
        ) : (
          <span>{work.coverImagePath ?? "未设置封面"}</span>
        )}
      </div>
      <div className="tier-work-copy">
        <strong>{work.title}</strong>
        <select
          aria-label={`移动 ${work.title}`}
          value={currentLevelId ?? ""}
          onChange={(event) => {
            const value = event.currentTarget.value;

            if (value === "") {
              void onRemoveWork(work.id);
              return;
            }

            void onMoveWork(work.id, value as TierLevelId);
          }}
        >
          <option value="">未分级</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
    </article>
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

function createTemplateDrafts(
  templates: RatingDimensionTemplate[],
): RatingTemplateDraft[] {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    weight: String(template.weight),
  }));
}

function createNewTemplateDraft(index: number): RatingTemplateDraft {
  return {
    id: `template-${crypto.randomUUID()}`,
    name: `维度 ${index + 1}`,
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

function readTemplateDrafts(
  drafts: RatingTemplateDraft[],
): RatingTemplateDraftState {
  const seenIds = new Set<string>();
  const templates: RatingDimensionTemplate[] = [];

  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    const id = draft.id.trim();
    const name = draft.name.trim();
    const weightText = draft.weight.trim();

    if (id.length === 0 || seenIds.has(id)) {
      return failTemplateDraft(`评分维度 ${number} 无法保存。`);
    }

    seenIds.add(id);

    if (name.length === 0) {
      return failTemplateDraft(`评分维度 ${number} 名称不能为空。`);
    }

    if (weightText.length === 0) {
      return failTemplateDraft(`评分维度 ${number} 权重不能为空。`);
    }

    const weight = Number(weightText);

    if (!Number.isFinite(weight) || weight <= 0) {
      return failTemplateDraft(`评分维度 ${number} 权重必须大于 0。`);
    }

    templates.push({
      id,
      name,
      weight,
    });
  }

  return {
    errorMessage: null,
    templates,
  };
}

function failTemplateDraft(message: string): RatingTemplateDraftState {
  return {
    errorMessage: message,
    templates: [],
  };
}

function failDimensionDraft(message: string): RatingDimensionDraftState {
  return {
    errorMessage: message,
    finalScore: null,
    ratingDimensions: [],
  };
}

function ensureRankingDimensionOption(
  options: RankingDimensionOption[],
  dimensionId: string | null,
): RankingDimensionOption[] {
  if (!dimensionId || options.some((option) => option.id === dimensionId)) {
    return options;
  }

  return [
    ...options,
    {
      id: dimensionId,
      name: `维度 ${dimensionId}`,
    },
  ];
}

function getRankingDimensionValue(
  dimensionId: string,
  options: RankingDimensionOption[],
): string {
  return options.some((option) => option.id === dimensionId)
    ? dimensionId
    : (options[0]?.id ?? "");
}

function getRankingDimensionName(
  dimensionId: string,
  options: RankingDimensionOption[],
): string {
  return (
    options.find((option) => option.id === dimensionId)?.name ??
    `维度 ${dimensionId}`
  );
}

function formatRankingWorkScore(work: Work, ranking: Ranking): string {
  if (ranking.mode === "dimension" && ranking.dimensionId) {
    const dimension = work.ratingDimensions.find(
      (item) => item.id === ranking.dimensionId,
    );
    return dimension ? `${dimension.score} 分` : "未评分";
  }

  return work.finalScore === null ? "未评分" : `${work.finalScore} 分`;
}

function countTierListWorks(tierList: TierList): number {
  return tierList.levels.reduce(
    (count, level) => count + level.workIds.length,
    0,
  );
}

function useCoverImageUrls(
  repository: LibraryRepository,
  works: Work[],
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const worksWithCovers = works.filter((work) => work.coverImagePath);

    if (worksWithCovers.length === 0) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setUrls(new Map());
        }
      });
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      worksWithCovers.map(async (work) => {
        if (!work.coverImagePath) {
          return null;
        }

        const bytes = await repository.readImage(work.coverImagePath);

        if (!bytes) {
          return null;
        }

        return [
          work.id,
          await createDisplayImageDataUrl(work.coverImagePath, bytes),
        ] as const;
      }),
    ).then((entries) => {
      if (!cancelled) {
        setUrls(new Map(entries.filter((entry) => entry !== null)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repository, works]);

  return urls;
}

function loadExportPreferences(): ExportPreferences {
  if (typeof window === "undefined") {
    return { directory: null };
  }

  try {
    const raw = window.localStorage.getItem(EXPORT_DIRECTORY_KEY);

    if (!raw) {
      return { directory: null };
    }

    const parsed = JSON.parse(raw) as Partial<ExportPreferences>;

    return {
      directory:
        typeof parsed.directory === "string" && parsed.directory.length > 0
          ? parsed.directory
          : null,
    };
  } catch {
    return { directory: null };
  }
}

function storeExportPreferences(preferences: ExportPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (preferences.directory) {
      window.localStorage.setItem(
        EXPORT_DIRECTORY_KEY,
        JSON.stringify(preferences),
      );
    } else {
      window.localStorage.removeItem(EXPORT_DIRECTORY_KEY);
    }
  } catch {
    // Ignore storage failures in constrained browsers.
  }
}

function sanitizeExportFileStem(value: string): string {
  const normalized = Array.from(value.normalize("NFKC"), (character) =>
    character.charCodeAt(0) < 32 ? "_" : character,
  ).join("");
  const sanitized = normalized
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized.length > 0 ? sanitized : "taste-ledger-export";
}

function canRasterizeSvgForExport(): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return false;
  }

  const canvas = document.createElement("canvas");
  return canvas.getContext("2d") !== null;
}

function canCopyImageToClipboard(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

function downloadFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof document === "undefined") {
    return;
  }

  if (typeof URL.createObjectURL !== "function") {
    return;
  }

  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  const blob = new Blob([blobBytes.buffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
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
