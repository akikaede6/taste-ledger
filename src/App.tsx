import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardCopy,
  ChevronRight,
  Download,
  FileText,
  FolderPlus,
  FolderOpen,
  Filter,
  ImagePlus,
  Library,
  Layers,
  ListPlus,
  Loader2,
  Pencil,
  LayoutDashboard,
  Search,
  Share2,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Trophy,
  Tag,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sortTierListsByRecentUpdate } from "./core/library-actions";
import {
  getCategoryDescendantIds,
  getCategoryLineage,
  getCategoryRootId,
  getCategoryTree,
  type CategoryTreeNode,
} from "./core/category-tree";
import { useLibraryState } from "./core/library-store";
import type {
  Category,
  RankingMode,
  RatingDimensionScore,
  RatingDimensionTemplate,
  TierLevel,
  TierLevelId,
  TierList,
  Work,
} from "./core/model";
import {
  collectRankingDimensionOptions,
  sortWorksForRanking,
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
import {
  createRankingPreviewShareImage,
  createTierListPreviewShareImage,
} from "./core/share-export";
import { createRuntimeBackend } from "./platform/runtime-backend";
import { getDesktopBridge } from "./platform/runtime-bridge";

interface WorkSaveInput {
  title: string;
  tags: string[];
  shortReview: string;
  longReview: string;
  ratingDimensions: RatingDimensionScore[];
}

interface TierListSaveInput {
  name: string;
  levels: TierLevel[];
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

type ScoreRankingMode = Exclude<RankingMode, "manual">;
type WorkspaceView = "dashboard" | "work" | "rankings" | "sharing";

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
  const [newChildCategoryName, setNewChildCategoryName] = useState("");
  const [newWorkTitle, setNewWorkTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [rankingPreviewMode, setRankingPreviewMode] =
    useState<ScoreRankingMode>("finalScore");
  const [rankingPreviewDimensionId, setRankingPreviewDimensionId] =
    useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [newTierListName, setNewTierListName] = useState("五级分级");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState<ExportDialogState | null>(
    null,
  );
  const [exportPreferences, setExportPreferences] = useState<ExportPreferences>(
    () => loadExportPreferences(),
  );
  const [storageDirectory, setStorageDirectory] = useState<string | null>(null);
  const desktopBridge = getDesktopBridge();

  const categoryTree = useMemo(
    () => getCategoryTree(state.library),
    [state.library],
  );
  const selectedCategory = state.selectedCategoryId
    ? state.library.categories.find(
        (category) => category.id === state.selectedCategoryId,
      )
    : null;
  const selectedCategoryRootId = selectedCategory
    ? (getCategoryRootId(state.library, selectedCategory.id) ??
      selectedCategory.id)
    : null;
  const selectedRootCategory = selectedCategoryRootId
    ? (state.library.categories.find(
        (category) => category.id === selectedCategoryRootId,
      ) ?? null)
    : null;
  const selectedCategoryLineage = selectedCategory
    ? getCategoryLineage(state.library, selectedCategory.id)
    : [];
  const selectedCategoryPath = selectedCategoryLineage
    .map((category) => category.name)
    .join(" / ");
  const selectedCategoryScopeIds = useMemo(
    () =>
      selectedCategory
        ? new Set(getCategoryDescendantIds(state.library, selectedCategory.id))
        : new Set<string>(),
    [selectedCategory, state.library],
  );
  const categoryWorks = useMemo(
    () =>
      selectedCategory
        ? state.library.works.filter((work) =>
            selectedCategoryScopeIds.has(work.categoryId),
          )
        : [],
    [selectedCategory, selectedCategoryScopeIds, state.library.works],
  );
  const selectedRootScopeIds = useMemo(
    () =>
      selectedRootCategory
        ? new Set(
            getCategoryDescendantIds(state.library, selectedRootCategory.id),
          )
        : new Set<string>(),
    [selectedRootCategory, state.library],
  );
  const sharedCategoryWorks = useMemo(
    () =>
      selectedRootCategory
        ? state.library.works.filter((work) =>
            selectedRootScopeIds.has(work.categoryId),
          )
        : [],
    [selectedRootCategory, selectedRootScopeIds, state.library.works],
  );
  const categoryTagOptions = useMemo(
    () => collectTagOptions(categoryWorks),
    [categoryWorks],
  );
  const activeTagFilters = useMemo(() => {
    const optionValues = new Set(
      categoryTagOptions.map((option) => option.value),
    );
    return selectedTagFilters.filter((tag) => optionValues.has(tag));
  }, [categoryTagOptions, selectedTagFilters]);
  const visibleWorks = useMemo(
    () =>
      categoryWorks.filter(
        (work) =>
          matchesTagFilters(work.tags, activeTagFilters) &&
          matchesWorkSearch(work, searchQuery),
      ),
    [activeTagFilters, categoryWorks, searchQuery],
  );
  const recentWorks = useMemo(
    () =>
      [...categoryWorks]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 6),
    [categoryWorks],
  );
  const pendingWorks = useMemo(
    () =>
      categoryWorks
        .filter((work) => work.finalScore === null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 5),
    [categoryWorks],
  );
  const dashboardAverageScore = useMemo(() => {
    const scoredWorks = categoryWorks.filter(
      (work) => work.finalScore !== null,
    );

    if (scoredWorks.length === 0) {
      return null;
    }

    const total = scoredWorks.reduce(
      (sum, work) => sum + (work.finalScore ?? 0),
      0,
    );
    return Math.round((total / scoredWorks.length) * 10) / 10;
  }, [categoryWorks]);
  const dashboardScopeWorkCount = categoryWorks.length;
  const activeViewTitleMap: Record<WorkspaceView, string> = {
    dashboard: "仪表盘",
    work: "作品详情",
    rankings: "排行榜",
    sharing: "导出预览",
  };
  const activeViewSubtitleMap: Record<WorkspaceView, string> = {
    dashboard: "整理分类、录入作品和查看最近评测。",
    work: "查看单个作品的详情与评测内容。",
    rankings: "按最终评分或单个维度查看当前分类排行。",
    sharing: "预览并导出作品图、排行图和分级图。",
  };
  const activeViewTitle = activeViewTitleMap[activeView];
  const activeViewSubtitle = activeViewSubtitleMap[activeView];
  const dashboardView = activeView === "dashboard";
  const workDetailView = activeView === "work";
  const rankingsView = activeView === "rankings";
  const sharingView = activeView === "sharing";
  const categoryTierLists = selectedRootCategory
    ? sortTierListsByRecentUpdate(
        state.library.tierLists.filter(
          (tierList) => tierList.categoryId === selectedRootCategory.id,
        ),
      )
    : [];
  const rankingDimensionOptions = selectedRootCategory
    ? collectRankingDimensionOptions(
        selectedRootCategory.ratingDimensionTemplates,
      )
    : [];
  const selectedRankingPreviewDimensionId =
    rankingPreviewMode === "dimension"
      ? getRankingDimensionValue(
          rankingPreviewDimensionId,
          rankingDimensionOptions,
        ) || null
      : null;
  const rankingPreviewWorks = useMemo(
    () =>
      sortWorksForRanking(sharedCategoryWorks, {
        mode: rankingPreviewMode,
        dimensionId: selectedRankingPreviewDimensionId,
      }),
    [
      rankingPreviewMode,
      selectedRankingPreviewDimensionId,
      sharedCategoryWorks,
    ],
  );
  const selectedWork = state.selectedWorkId
    ? state.library.works.find((work) => work.id === state.selectedWorkId)
    : null;
  const selectedWorkCategoryPath = selectedWork
    ? getCategoryLineage(state.library, selectedWork.categoryId)
        .map((category) => category.name)
        .join(" / ")
    : "";
  const selectedTierList =
    state.selectedTierListId && selectedRootCategory
      ? state.library.tierLists.find(
          (tierList) =>
            tierList.id === state.selectedTierListId &&
            tierList.categoryId === selectedRootCategory.id,
        )
      : null;
  const coverImageUrls = useCoverImageUrls(repository, categoryWorks);
  const sharedCoverImageUrls = useCoverImageUrls(
    repository,
    sharedCategoryWorks,
  );
  const rootCategoryCount = state.library.categories.filter(
    (category) => category.parentCategoryId === null,
  ).length;
  const childCategoryCount =
    state.library.categories.length - rootCategoryCount;

  useEffect(() => {
    storeExportPreferences(exportPreferences);
  }, [exportPreferences]);

  useEffect(() => {
    if (!desktopBridge) {
      return;
    }

    let cancelled = false;

    void desktopBridge
      .getStorageDirectory()
      .then((directory) => {
        if (!cancelled) {
          setStorageDirectory(directory);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStorageDirectory(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [desktopBridge]);

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
      await controller.createCategory(newCategoryName, null);
      setNewCategoryName("");
    });
  }

  async function handleCreateChildCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRootCategory) {
      setActionError("先选择一个大分类。");
      return;
    }

    if (newChildCategoryName.trim().length === 0) {
      setActionError("子分类名称不能为空。");
      return;
    }

    await runAction(async () => {
      await controller.createCategory(
        newChildCategoryName,
        selectedRootCategory.id,
      );
      setNewChildCategoryName("");
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
      `删除分类「${selectedCategory.name}」？相关作品和分级也会删除。`,
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

  function handleOpenWorkDetail(workId: string) {
    controller.selectWork(workId);
    setActiveView("work");
  }

  async function handleSaveWork(input: WorkSaveInput) {
    await runAction(async () => controller.updateSelectedWork(input));
  }

  function toggleTagFilter(tag: string) {
    setSelectedTagFilters(
      activeTagFilters.includes(tag)
        ? activeTagFilters.filter((item) => item !== tag)
        : [...activeTagFilters, tag],
    );
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

    await runAction(async () => {
      await controller.deleteSelectedWork();
      setActiveView("dashboard");
    });
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

  async function handleExportRankingPreview() {
    if (!selectedRootCategory) {
      return;
    }

    const dimensionName =
      selectedRankingPreviewDimensionId && rankingDimensionOptions.length > 0
        ? getRankingDimensionName(
            selectedRankingPreviewDimensionId,
            rankingDimensionOptions,
          )
        : null;

    await openExportDialog("排行预览", async () =>
      createRankingPreviewShareImage({
        categoryName: selectedRootCategory.name,
        rankingName: "作品排行",
        mode: rankingPreviewMode,
        dimensionId: selectedRankingPreviewDimensionId,
        dimensionName,
        orderedWorks: rankingPreviewWorks,
      }),
    );
  }

  async function handleExportTierListShare(input: TierListSaveInput) {
    if (!selectedRootCategory || !selectedTierList) {
      return;
    }

    await openExportDialog("五级分级预览", async () =>
      createTierListPreviewShareImage({
        tierListId: selectedTierList.id,
        tierListName: input.name,
        categoryName: selectedRootCategory.name,
        levels: input.levels,
        works: sharedCategoryWorks,
        coverImages: sharedCoverImageUrls,
      }),
    );
  }

  function closeExportDialog() {
    setExportDialog(null);
  }

  function handleSelectCategory(categoryId: string) {
    controller.selectCategory(categoryId);

    if (activeView === "work") {
      setActiveView("dashboard");
    }
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

  async function handleChooseStorageDirectory() {
    if (!desktopBridge) {
      return;
    }

    const directory = await runAction(async () => {
      const selected = await desktopBridge.chooseStorageDirectory();

      if (selected) {
        await controller.refresh();
      }

      return selected;
    });

    if (directory) {
      setStorageDirectory(directory);
      setActionMessage(`已切换数据文件夹：${directory}`);
    }
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

  function renderCategoryNodes(nodes: CategoryTreeNode[]): ReactElement[] {
    return nodes.map((node) => {
      const rootScopeIds = new Set(
        getCategoryDescendantIds(state.library, node.category.id),
      );
      const workCount = state.library.works.filter((work) =>
        rootScopeIds.has(work.categoryId),
      ).length;
      const childCount = node.children.length;
      const selectedRoot = state.selectedCategoryId === node.category.id;
      const selectedChild = node.children.some(
        (child) => child.category.id === state.selectedCategoryId,
      );

      return (
        <div className="category-group" key={node.category.id}>
          <button
            className={
              selectedRoot || selectedChild
                ? "category-root-button selected"
                : "category-root-button"
            }
            type="button"
            onClick={() => handleSelectCategory(node.category.id)}
          >
            <div className="category-button-row">
              <FolderOpen aria-hidden="true" size={16} />
              <span>{node.category.name}</span>
            </div>
            <small>
              {workCount} 作品{childCount > 0 ? ` · ${childCount} 子分类` : ""}
            </small>
          </button>
          {node.children.length > 0 ? (
            <div className="category-child-list">
              {node.children.map((child) => {
                const childWorkCount = state.library.works.filter(
                  (work) => work.categoryId === child.category.id,
                ).length;
                const selected = state.selectedCategoryId === child.category.id;

                return (
                  <button
                    key={child.category.id}
                    className={
                      selected
                        ? "category-child-button selected"
                        : "category-child-button"
                    }
                    type="button"
                    onClick={() => handleSelectCategory(child.category.id)}
                  >
                    <div className="category-button-row">
                      <FolderPlus aria-hidden="true" size={15} />
                      <span>{child.category.name}</span>
                    </div>
                    <small>{childWorkCount} 作品 · 共用上级设置</small>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    });
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

        {desktopBridge ? (
          <section className="sidebar-card" aria-label="数据文件夹">
            <div className="sidebar-card-heading">
              <FolderOpen aria-hidden="true" size={16} />
              <h3>数据文件夹</h3>
            </div>
            <p className="storage-directory-path">
              {storageDirectory ?? "正在读取"}
            </p>
            <button
              className="text-button"
              type="button"
              onClick={() => void handleChooseStorageDirectory()}
            >
              <FolderOpen aria-hidden="true" size={16} />
              选择数据文件夹
            </button>
          </section>
        ) : null}

        <nav className="workspace-nav" aria-label="主视图">
          <button
            className={
              dashboardView
                ? "workspace-nav-button selected"
                : "workspace-nav-button"
            }
            type="button"
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard aria-hidden="true" size={16} />
            仪表盘
          </button>
          <button
            className={
              rankingsView
                ? "workspace-nav-button selected"
                : "workspace-nav-button"
            }
            type="button"
            onClick={() => setActiveView("rankings")}
          >
            <BarChart3 aria-hidden="true" size={16} />
            排行榜
          </button>
          <button
            className={
              sharingView
                ? "workspace-nav-button selected"
                : "workspace-nav-button"
            }
            type="button"
            onClick={() => setActiveView("sharing")}
          >
            <Share2 aria-hidden="true" size={16} />
            导出预览
          </button>
        </nav>

        <form
          className="create-form category-create-form"
          onSubmit={handleCreateCategory}
        >
          <label htmlFor="new-category">新大分类</label>
          <div className="inline-form-row">
            <input
              id="new-category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="动画 / 影视作品 / 音乐"
            />
            <button
              className="icon-button primary"
              type="submit"
              aria-label="创建大分类"
            >
              <FolderPlus aria-hidden="true" size={18} />
            </button>
          </div>
        </form>

        <form
          className="create-form category-create-form"
          onSubmit={handleCreateChildCategory}
        >
          <label htmlFor="new-child-category">新子分类</label>
          <div className="inline-form-row">
            <input
              id="new-child-category"
              value={newChildCategoryName}
              onChange={(event) => setNewChildCategoryName(event.target.value)}
              placeholder={
                selectedRootCategory ? "2026年1月新番" : "先选择一个大分类"
              }
              disabled={!selectedRootCategory}
            />
            <button
              className="icon-button primary"
              type="submit"
              aria-label="创建子分类"
              disabled={!selectedRootCategory}
            >
              <FolderPlus aria-hidden="true" size={18} />
            </button>
          </div>
          {selectedRootCategory ? (
            <p className="form-note">创建到「{selectedRootCategory.name}」。</p>
          ) : null}
        </form>

        <nav className="category-list" aria-label="分类列表">
          {renderCategoryNodes(categoryTree)}
        </nav>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{activeViewTitle}</p>
            <h2>
              {dashboardView
                ? (selectedCategory?.name ?? "创建第一个分类")
                : workDetailView
                  ? (selectedWork?.title ?? "作品详情")
                  : activeViewTitle}
            </h2>
            <p className="workspace-subtitle">{activeViewSubtitle}</p>
            {dashboardView && selectedCategory ? (
              <p className="workspace-path">{selectedCategoryPath}</p>
            ) : null}
            {workDetailView && selectedWorkCategoryPath ? (
              <p className="workspace-path">{selectedWorkCategoryPath}</p>
            ) : null}
            {dashboardView &&
            selectedRootCategory &&
            selectedCategory &&
            selectedRootCategory.id !== selectedCategory.id ? (
              <p className="workspace-note">
                评分维度和排行由「{selectedRootCategory.name}」共享。
              </p>
            ) : null}
            {(rankingsView || sharingView) && selectedRootCategory ? (
              <p className="workspace-path">
                当前大分类：{selectedRootCategory.name}
              </p>
            ) : null}
          </div>
          <div className="workspace-header-actions">
            {dashboardView ? (
              <div className="workspace-search">
                <Search aria-hidden="true" size={16} />
                <input
                  aria-label="搜索作品、标签或评价"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.currentTarget.value)
                  }
                  placeholder="搜索作品、标签或短评"
                />
              </div>
            ) : null}
            {workDetailView ? (
              <button
                className="text-button"
                type="button"
                onClick={() => setActiveView("dashboard")}
              >
                <ArrowLeft aria-hidden="true" size={16} />
                返回仪表盘
              </button>
            ) : null}
            <button
              className="text-button"
              type="button"
              onClick={() => void controller.refresh()}
            >
              <RefreshCw aria-hidden="true" size={16} />
              重新载入
            </button>
          </div>
        </header>

        {state.status === "loading" ? (
          <LoadingShell label="正在读取本地资料库" />
        ) : state.status === "error" ? (
          <FatalState message={state.errorMessage ?? "资料库读取失败。"} />
        ) : dashboardView ? (
          <div className="content-grid dashboard-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <Library aria-hidden="true" size={18} />
                  <h3>概览</h3>
                </div>
                <dl className="stats-grid">
                  <div>
                    <dt>大分类</dt>
                    <dd>{rootCategoryCount}</dd>
                  </div>
                  <div>
                    <dt>子分类</dt>
                    <dd>{childCategoryCount}</dd>
                  </div>
                  <div>
                    <dt>当前作品</dt>
                    <dd>{dashboardScopeWorkCount}</dd>
                  </div>
                  <div>
                    <dt>平均评分</dt>
                    <dd>{dashboardAverageScore ?? "-"}</dd>
                  </div>
                </dl>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <Star aria-hidden="true" size={18} />
                  <h3>最近评测</h3>
                </div>
                {recentWorks.length > 0 ? (
                  <div className="recent-work-grid" aria-label="最近评测作品">
                    {recentWorks.map((work) => {
                      const categoryPath = getCategoryLineage(
                        state.library,
                        work.categoryId,
                      )
                        .map((category) => category.name)
                        .join(" / ");
                      const coverImageUrl = coverImageUrls.get(work.id) ?? null;

                      return (
                        <button
                          className="recent-work-card"
                          key={work.id}
                          type="button"
                          onClick={() => handleOpenWorkDetail(work.id)}
                        >
                          <span className="recent-work-cover">
                            {coverImageUrl ? (
                              <img src={coverImageUrl} alt="" />
                            ) : (
                              <span>{work.coverImagePath ?? "未设置封面"}</span>
                            )}
                            <span className="recent-work-score">
                              {work.finalScore === null
                                ? "未评分"
                                : `${work.finalScore}`}
                            </span>
                          </span>
                          <span className="recent-work-copy">
                            <strong>{work.title}</strong>
                            <small>{categoryPath || "未分类"}</small>
                          </span>
                          <ChevronRight aria-hidden="true" size={16} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">这个范围还没有作品。</p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <BookOpen aria-hidden="true" size={18} />
                  <h3>待评分</h3>
                </div>
                {pendingWorks.length > 0 ? (
                  <div className="pending-work-list" aria-label="待评分作品">
                    {pendingWorks.map((work) => {
                      const categoryPath = getCategoryLineage(
                        state.library,
                        work.categoryId,
                      )
                        .map((category) => category.name)
                        .join(" / ");
                      const coverImageUrl = coverImageUrls.get(work.id) ?? null;

                      return (
                        <button
                          className="pending-work-card"
                          key={work.id}
                          type="button"
                          onClick={() => handleOpenWorkDetail(work.id)}
                        >
                          <span className="recent-work-cover">
                            {coverImageUrl ? (
                              <img src={coverImageUrl} alt="" />
                            ) : (
                              <span>{work.coverImagePath ?? "未设置封面"}</span>
                            )}
                            <span className="recent-work-score">待评分</span>
                          </span>
                          <span className="recent-work-copy">
                            <strong>{work.title}</strong>
                            <small>{categoryPath || "未分类"}</small>
                          </span>
                          <ChevronRight aria-hidden="true" size={16} />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">当前范围内的作品都已经有综合评分。</p>
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

                <div className="tag-filter-bar" aria-label="标签筛选">
                  <div className="tag-filter-heading">
                    <Filter aria-hidden="true" size={16} />
                    <h4>标签筛选</h4>
                    <small>{activeTagFilters.length} 已选</small>
                  </div>
                  {categoryTagOptions.length > 0 ? (
                    <div className="tag-chip-row">
                      {categoryTagOptions.map((tag) => {
                        const selected = activeTagFilters.includes(tag.value);

                        return (
                          <button
                            key={tag.value}
                            className={
                              selected ? "tag-chip selected" : "tag-chip"
                            }
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleTagFilter(tag.value)}
                          >
                            <Tag aria-hidden="true" size={14} />
                            <span>{tag.value}</span>
                            <small>{tag.count}</small>
                          </button>
                        );
                      })}
                      {activeTagFilters.length > 0 ? (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setSelectedTagFilters([])}
                        >
                          <X aria-hidden="true" size={16} />
                          清除筛选
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="inline-hint">
                      当前分类树还没有可筛选的标签。
                    </p>
                  )}
                </div>

                <div className="work-list" aria-label="作品列表">
                  {categoryWorks.length === 0 ? (
                    <p className="muted">这个分类还没有作品。</p>
                  ) : visibleWorks.length > 0 ? (
                    visibleWorks.map((work) => (
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
                          {work.tags.length > 0
                            ? ` · ${work.tags.join(" · ")}`
                            : ""}
                          {work.shortReview ? ` · ${work.shortReview}` : ""}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p className="muted">当前标签筛选没有匹配作品。</p>
                  )}
                </div>
              </section>
            </div>

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
                    {selectedRootCategory &&
                    selectedRootCategory.id !== selectedCategory.id ? (
                      <p className="inline-hint">
                        这个子分类共用「{selectedRootCategory.name}
                        」的评分维度与排行。
                      </p>
                    ) : null}
                    <CategoryDimensionEditor
                      key={`${selectedRootCategory?.id ?? selectedCategory.id}-${selectedRootCategory?.updatedAt ?? selectedCategory.updatedAt}`}
                      category={selectedRootCategory ?? selectedCategory}
                      onSave={handleSaveCategoryDimensions}
                    />
                  </>
                ) : (
                  <p className="muted">
                    先创建一个大分类，再添加作品、评分和分级。
                  </p>
                )}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <FileText aria-hidden="true" size={18} />
                  <h3>当前作品</h3>
                </div>

                {selectedWork ? (
                  <WorkEditor
                    key={`${selectedWork.id}-${selectedWork.updatedAt}`}
                    work={selectedWork}
                    categoryName={
                      selectedWorkCategoryPath ||
                      selectedCategoryPath ||
                      (selectedCategory?.name ?? "")
                    }
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
            </div>
          </div>
        ) : workDetailView ? (
          <div className="work-detail-layout">
            {selectedWork ? (
              <>
                <section className="panel work-detail-hero">
                  <div className="work-detail-cover">
                    {coverImageUrls.get(selectedWork.id) ? (
                      <img src={coverImageUrls.get(selectedWork.id)} alt="" />
                    ) : (
                      <span>{selectedWork.coverImagePath ?? "未设置封面"}</span>
                    )}
                  </div>
                  <div className="work-detail-copy">
                    <div className="work-detail-chips">
                      <span>
                        {selectedWorkCategoryPath ||
                          selectedCategoryPath ||
                          "未分类"}
                      </span>
                      {selectedWork.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <h3>{selectedWork.title}</h3>
                    <p>
                      {selectedWork.shortReview ||
                        "还没有短评，可以回到仪表盘补充。"}
                    </p>
                    <div className="work-detail-score-row">
                      <div>
                        <small>综合评分</small>
                        <strong>
                          {selectedWork.finalScore === null
                            ? "未评分"
                            : `${selectedWork.finalScore}`}
                        </strong>
                      </div>
                      <div>
                        <small>评分维度</small>
                        <strong>{selectedWork.ratingDimensions.length}</strong>
                      </div>
                    </div>
                    <div className="button-row">
                      <button
                        className="text-button primary"
                        type="button"
                        onClick={() => setActiveView("dashboard")}
                      >
                        <Pencil aria-hidden="true" size={16} />
                        编辑评测
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => void handleExportWorkShare("cover")}
                      >
                        <ImagePlus aria-hidden="true" size={16} />
                        导出封面图
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => void handleExportWorkShare("long")}
                      >
                        <FileText aria-hidden="true" size={16} />
                        导出长图
                      </button>
                    </div>
                  </div>
                </section>

                <div className="work-detail-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <BookOpen aria-hidden="true" size={18} />
                      <h3>长评</h3>
                    </div>
                    {selectedWork.longReview.trim() ? (
                      <article className="work-detail-article">
                        {selectedWork.longReview
                          .split(/\r?\n/)
                          .map((line, index) => (
                            <p key={`${index}-${line}`}>{line.trim() || " "}</p>
                          ))}
                      </article>
                    ) : (
                      <p className="muted">还没有长评。</p>
                    )}
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <Star aria-hidden="true" size={18} />
                      <h3>维度详情</h3>
                    </div>
                    {selectedWork.ratingDimensions.length > 0 ? (
                      <div className="score-bar-list">
                        {selectedWork.ratingDimensions.map((dimension) => (
                          <div className="score-bar-row" key={dimension.id}>
                            <div>
                              <span>{dimension.name}</span>
                              <strong>{dimension.score}</strong>
                            </div>
                            <div className="score-bar-track">
                              <span
                                style={{
                                  width: `${Math.max(0, Math.min(100, dimension.score * 10))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">这个作品还没有评分维度。</p>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="center-state">
                <BookOpen aria-hidden="true" size={28} />
                <p>先在仪表盘选择一个作品。</p>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setActiveView("dashboard")}
                >
                  返回仪表盘
                </button>
              </div>
            )}
          </div>
        ) : rankingsView ? (
          <div className="content-grid rankings-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <Trophy aria-hidden="true" size={18} />
                  <h3>排名预览</h3>
                </div>

                <RankingPreviewPanel
                  rootCategory={selectedRootCategory}
                  mode={rankingPreviewMode}
                  dimensionOptions={rankingDimensionOptions}
                  selectedDimensionId={selectedRankingPreviewDimensionId}
                  works={rankingPreviewWorks}
                  onModeChange={(mode) => {
                    setRankingPreviewMode(mode);
                    if (mode !== "dimension") {
                      setRankingPreviewDimensionId("");
                    }
                  }}
                  onDimensionChange={setRankingPreviewDimensionId}
                  onExport={handleExportRankingPreview}
                />
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
            </div>

            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <Layers aria-hidden="true" size={18} />
                  <h3>分级详情</h3>
                </div>

                {selectedTierList ? (
                  <TierListEditor
                    key={`${selectedTierList.id}-${selectedTierList.updatedAt}`}
                    tierList={selectedTierList}
                    works={sharedCategoryWorks}
                    coverImageUrls={sharedCoverImageUrls}
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
          </div>
        ) : sharingView ? (
          <div className="sharing-grid">
            <section className="panel export-target-card">
              <div className="panel-heading">
                <FileText aria-hidden="true" size={18} />
                <h3>作品导出</h3>
              </div>
              {selectedWork ? (
                <>
                  <div className="work-share-preview">
                    <div className="work-share-preview-cover">
                      {coverImageUrls.get(selectedWork.id) ? (
                        <img src={coverImageUrls.get(selectedWork.id)} alt="" />
                      ) : (
                        <span>
                          {selectedWork.coverImagePath ?? "未设置封面"}
                        </span>
                      )}
                    </div>
                    <div className="work-share-preview-copy">
                      <p className="eyebrow">当前作品</p>
                      <strong>{selectedWork.title}</strong>
                      <small>
                        {selectedWork.finalScore === null
                          ? "未评分"
                          : `${selectedWork.finalScore} 分`}
                      </small>
                      <p>
                        {selectedWorkCategoryPath ||
                          selectedCategoryPath ||
                          selectedCategory?.name}
                      </p>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="text-button primary"
                      type="button"
                      onClick={() => void handleExportWorkShare("cover")}
                    >
                      <ImagePlus aria-hidden="true" size={16} />
                      导出封面图
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void handleExportWorkShare("long")}
                    >
                      <FileText aria-hidden="true" size={16} />
                      导出长图
                    </button>
                  </div>
                </>
              ) : (
                <p className="muted">先在仪表盘选择一个作品。</p>
              )}
            </section>

            <section className="panel export-target-card">
              <div className="panel-heading">
                <Trophy aria-hidden="true" size={18} />
                <h3>排行导出</h3>
              </div>
              <p className="muted">
                {selectedRootCategory
                  ? `当前大分类：${selectedRootCategory.name}，${rankingPreviewWorks.length} 个作品。`
                  : "先选择一个大分类。"}
              </p>
              <button
                className="text-button primary"
                type="button"
                onClick={() => void handleExportRankingPreview()}
                disabled={rankingPreviewWorks.length === 0}
              >
                <ImagePlus aria-hidden="true" size={16} />
                导出排名图
              </button>
            </section>

            <section className="panel export-target-card">
              <div className="panel-heading">
                <Layers aria-hidden="true" size={18} />
                <h3>分级导出</h3>
              </div>
              <p className="muted">
                {selectedTierList
                  ? `当前分级：${selectedTierList.name}，${countTierListWorks(selectedTierList)} 个作品。`
                  : "先在排行榜里创建并选择一个分级。"}
              </p>
              <button
                className="text-button primary"
                type="button"
                onClick={() =>
                  selectedTierList
                    ? void handleExportTierListShare({
                        name: selectedTierList.name,
                        levels: selectedTierList.levels,
                      })
                    : undefined
                }
                disabled={!selectedTierList}
              >
                <ImagePlus aria-hidden="true" size={16} />
                导出分级图
              </button>
            </section>
          </div>
        ) : null}

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
        <h4>统一评分维度</h4>
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
        <p className="muted">这个大分类还没有评分维度。</p>
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
  tagsText: string;
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
    tagsText: work.tags.join(", "),
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
      title: workDraft.title,
      tags: parseTagText(workDraft.tagsText),
      shortReview: workDraft.shortReview,
      longReview: workDraft.longReview,
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

      <label htmlFor="work-tags">标签</label>
      <input
        id="work-tags"
        name="workTags"
        value={workDraft.tagsText}
        onChange={(event) =>
          updateWorkDraft("tagsText", event.currentTarget.value)
        }
        placeholder="新番, 2026年1月, 原创"
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
          {work.tags.length > 0 ? (
            <div className="tag-chip-row compact">
              {work.tags.map((tag) => (
                <span className="tag-pill" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
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

interface RankingPreviewPanelProps {
  rootCategory: Category | null;
  mode: ScoreRankingMode;
  dimensionOptions: RankingDimensionOption[];
  selectedDimensionId: string | null;
  works: Work[];
  onModeChange(mode: ScoreRankingMode): void;
  onDimensionChange(dimensionId: string): void;
  onExport(): Promise<void> | void;
}

function RankingPreviewPanel({
  rootCategory,
  mode,
  dimensionOptions,
  selectedDimensionId,
  works,
  onModeChange,
  onDimensionChange,
  onExport,
}: RankingPreviewPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const canExport =
    rootCategory !== null &&
    works.length > 0 &&
    (mode !== "dimension" || selectedDimensionId !== null);

  async function handleExport() {
    if (!canExport) {
      return;
    }

    setIsExporting(true);
    try {
      await onExport();
    } finally {
      setIsExporting(false);
    }
  }

  if (!rootCategory) {
    return <p className="muted">先创建一个大分类，再查看排名。</p>;
  }

  return (
    <div className="ranking-preview">
      <div className="ranking-preview-controls">
        <div>
          <label htmlFor="ranking-preview-mode">排名方式</label>
          <select
            id="ranking-preview-mode"
            value={mode}
            onChange={(event) =>
              onModeChange(event.currentTarget.value as ScoreRankingMode)
            }
          >
            <option value="finalScore">最终评分</option>
            <option value="dimension">单个评分维度</option>
          </select>
        </div>

        <div>
          <label htmlFor="ranking-preview-dimension">评分维度</label>
          <select
            id="ranking-preview-dimension"
            value={selectedDimensionId ?? ""}
            onChange={(event) => onDimensionChange(event.currentTarget.value)}
            disabled={mode !== "dimension" || dimensionOptions.length === 0}
          >
            {dimensionOptions.length > 0 ? (
              dimensionOptions.map((dimension) => (
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
        <button
          className="text-button"
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || !canExport}
        >
          <ImagePlus aria-hidden="true" size={16} />
          {isExporting ? "导出中" : "导出排名图"}
        </button>
      </div>

      {mode === "dimension" && dimensionOptions.length === 0 ? (
        <p className="inline-hint">先添加评分维度，再按单个维度排名。</p>
      ) : null}

      {works.length > 0 ? (
        <ol className="ranking-work-list" aria-label="排名作品">
          {works.map((work, index) => (
            <li className="ranking-work-row" key={work.id}>
              <span className="rank-number">{index + 1}</span>
              <div className="ranking-work-copy">
                <strong>{work.title}</strong>
                <small>
                  {formatRankingPreviewScore(work, mode, selectedDimensionId)}
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">这个大分类还没有作品。</p>
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
  onExport(input: TierListSaveInput): Promise<void>;
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
  const [levelDrafts, setLevelDrafts] = useState<TierLevel[]>(() =>
    tierList.levels.map((level) => ({
      ...level,
      workIds: [...level.workIds],
    })),
  );
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
                levels={levelDrafts}
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
        {levelDrafts.map((level) => {
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
                      levels={levelDrafts}
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

function formatRankingPreviewScore(
  work: Work,
  mode: ScoreRankingMode,
  dimensionId: string | null,
): string {
  if (mode === "dimension" && dimensionId) {
    const dimension = work.ratingDimensions.find(
      (item) => item.id === dimensionId,
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

interface TagOption {
  value: string;
  count: number;
}

function collectTagOptions(works: Work[]): TagOption[] {
  const tagByKey = new Map<string, TagOption>();

  for (const work of works) {
    for (const tag of work.tags) {
      const trimmedTag = tag.trim();

      if (trimmedTag.length === 0) {
        continue;
      }

      const key = normalizeTagKey(trimmedTag);
      const current = tagByKey.get(key);

      tagByKey.set(key, {
        value: current?.value ?? trimmedTag,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return [...tagByKey.values()].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }

    return left.value.localeCompare(right.value);
  });
}

function matchesTagFilters(tags: string[], filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const tagKeys = new Set(tags.map(normalizeTagKey));
  return filters.every((filter) => tagKeys.has(normalizeTagKey(filter)));
}

function matchesWorkSearch(work: Work, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return [work.title, work.shortReview, work.longReview, ...work.tags].some(
    (value) => value.toLocaleLowerCase().includes(normalizedQuery),
  );
}

function parseTagText(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(/[,\n，、;；]+/)) {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      continue;
    }

    const key = normalizeTagKey(tag);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
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
