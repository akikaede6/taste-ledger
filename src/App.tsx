import type { WorkspaceView } from "./types/ui";
import { MobileBottomNavigation } from "./components/layout/MobileBottomNavigation";
import { Sidebar } from "./components/layout/Sidebar";
import { useCoverImageUrls } from "./hooks/useCoverImageUrls";
import {
  createDimensionDrafts,
  createDimensionDraftsFromTemplates,
  createNewTemplateDraft,
  readDimensionDrafts,
  readTemplateDrafts,
  type RatingDimensionDraft,
  type RatingTemplateDraft,
} from "./components/rating/RatingDrafts";
import { CategoryDimensionEditor } from "./components/category/CategoryDimensionEditor";
import { CategoryModal } from "./components/modals/CategoryModal";
import type {
  ActiveModal,
  CategoryModalState,
  ExportDialogState,
  ExportPreferences,
  ExportShareBuilder,
  RankingSurfaceMode,
  ScoreRankingMode,
  TierListSaveInput,
  WorkModalState,
} from "./types/workspace";
import { WorkModal } from "./components/modals/WorkModal";
import {
  createEditWorkModalState,
  createEmptyWorkModalState,
  createWorkModalState,
  syncWorkModalCategory,
} from "./components/work/WorkModalState";
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
  Menu,
  Pencil,
  LayoutDashboard,
  Search,
  Share2,
  RefreshCw,
  Save,
  Plus,
  Star,
  Trash2,
  Trophy,
  Tag,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
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
  Library as TasteLibrary,
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
  DEFAULT_SHARE_COVER_OPTIONS,
  createRankingPreviewShareImage,
  createTierListPreviewShareImage,
  type ShareCoverOptions,
} from "./core/share-export";
import { createRuntimeBackend } from "./platform/runtime-backend";
import { getDesktopBridge } from "./platform/runtime-bridge";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [rankingPreviewMode, setRankingPreviewMode] =
    useState<ScoreRankingMode>("finalScore");
  const [rankingPreviewDimensionId, setRankingPreviewDimensionId] =
    useState("");
  const [rankingSurfaceMode, setRankingSurfaceMode] =
    useState<RankingSurfaceMode>("tier");
  const [activeView, setActiveView] = useState<WorkspaceView>("dashboard");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>(() =>
    createEmptyCategoryModalState(),
  );
  const [workModal, setWorkModal] = useState<WorkModalState>(() =>
    createEmptyWorkModalState(),
  );
  const [newTierListName, setNewTierListName] = useState("五级分级");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportDialog, setExportDialog] = useState<ExportDialogState | null>(
    null,
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => window.innerWidth <= 860,
  );
  const [exportPreferences, setExportPreferences] = useState<ExportPreferences>(
    () => loadExportPreferences(),
  );
  const [storageDirectory, setStorageDirectory] = useState<string | null>(null);
  const desktopBridge = getDesktopBridge();
  const exportShareBuilderRef = useRef<ExportShareBuilder | null>(null);
  const exportDialogRequestIdRef = useRef(0);

  useEffect(() => {
    function updateLayoutMode() {
      const nextIsCompactLayout = window.innerWidth <= 860;
      setIsCompactLayout(nextIsCompactLayout);

      if (!nextIsCompactLayout) {
        setIsMobileSidebarOpen(false);
      }
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => {
      window.removeEventListener("resize", updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (!isMobileSidebarOpen || !isCompactLayout) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen, isCompactLayout]);

  const categoryTree = useMemo(
    () => getCategoryTree(state.library),
    [state.library],
  );
  const rootCategories = useMemo(
    () =>
      state.library.categories.filter(
        (category) => category.parentCategoryId === null,
      ),
    [state.library.categories],
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
  const rankingPreviewWorks = sortWorksForRanking(sharedCategoryWorks, {
    mode: rankingPreviewMode,
    dimensionId: selectedRankingPreviewDimensionId,
  });
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
  const selectedWorkCoverImageUrl = selectedWork
    ? (coverImageUrls.get(selectedWork.id) ??
      sharedCoverImageUrls.get(selectedWork.id) ??
      null)
    : null;
  const rootCategoryCount = rootCategories.length;
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

  function openRootCategoryModal() {
    setIsMobileSidebarOpen(false);
    setCategoryModal(createRootCategoryModalState());
    setActiveModal("category");
  }

  function openChildCategoryModal(parentCategoryId: string) {
    setIsMobileSidebarOpen(false);
    setCategoryModal(createChildCategoryModalState(parentCategoryId));
    setActiveModal("category");
  }

  function closeActiveModal() {
    setActiveModal(null);
  }

  async function handleSaveCategoryModal(input: CategoryModalState) {
    const name = input.name.trim();

    if (name.length === 0) {
      setActionError("分类名称不能为空。");
      return;
    }

    let templates: RatingDimensionTemplate[] = [];

    if (input.mode === "root") {
      const templateState = readTemplateDrafts(input.dimensionDrafts);

      if (templateState.errorMessage) {
        setActionError(templateState.errorMessage);
        return;
      }

      templates = templateState.templates;
    } else if (!input.parentCategoryId) {
      setActionError("先选择一个大分类。");
      return;
    }

    const categoryId = await runAction(async () => {
      const createdCategoryId = await controller.createCategory(
        name,
        input.mode === "child" ? input.parentCategoryId : null,
      );
      controller.selectCategory(createdCategoryId);

      if (input.mode === "root") {
        await controller.updateSelectedCategoryRatingDimensions(templates);
      }

      return createdCategoryId;
    });

    if (categoryId) {
      setActiveModal(null);
      setActiveView("dashboard");
      setActionMessage(
        input.mode === "root" ? "已创建大分类。" : "已创建子分类。",
      );
    }
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

  function openCreateWorkModal() {
    setIsMobileSidebarOpen(false);
    const categoryId =
      selectedCategory?.id ?? selectedRootCategory?.id ?? rootCategories[0]?.id;
    setWorkModal(
      createWorkModalState({
        categoryId: categoryId ?? null,
        library: state.library,
      }),
    );
    setActiveModal("work");
  }

  function openEditWorkModal(work: Work) {
    setIsMobileSidebarOpen(false);
    controller.selectWork(work.id);
    setWorkModal(
      createEditWorkModalState({
        coverPreviewUrl:
          coverImageUrls.get(work.id) ??
          sharedCoverImageUrls.get(work.id) ??
          null,
        library: state.library,
        work,
      }),
    );
    setActiveModal("work");
  }

  function handleWorkModalCategoryChange(categoryId: string | null) {
    setWorkModal((current) =>
      syncWorkModalCategory(current, state.library, categoryId),
    );
  }

  async function handleSaveWorkModal(input: WorkModalState) {
    const title = input.title.trim();

    if (title.length === 0) {
      setActionError("作品名称不能为空。");
      return;
    }

    if (!input.categoryId) {
      setActionError("先选择一个分类。");
      return;
    }

    const categoryId = input.categoryId;
    const dimensionState = readDimensionDrafts(input.ratingDimensions);

    if (dimensionState.errorMessage) {
      setActionError(dimensionState.errorMessage);
      return;
    }

    const workId = await runAction(async () => {
      const saveInput = {
        categoryId,
        title,
        tags: parseTagText(input.tagsText),
        shortReview: input.shortReview,
        longReview: input.longReview,
        ratingDimensions: dimensionState.ratingDimensions,
      };

      if (input.mode === "edit") {
        if (!input.workId) {
          throw new Error("Work not selected.");
        }

        controller.selectWork(input.workId);
        await controller.updateSelectedWork(saveInput);

        if (input.coverFileName && input.coverBytes) {
          await controller.storeSelectedWorkCover(
            input.coverFileName,
            input.coverBytes,
          );
        }

        return input.workId;
      }

      controller.selectCategory(categoryId);
      const createdWorkId = await controller.createWork(title);
      await controller.updateSelectedWork(saveInput);

      if (input.coverFileName && input.coverBytes) {
        await controller.storeSelectedWorkCover(
          input.coverFileName,
          input.coverBytes,
        );
      }

      return createdWorkId;
    });

    if (workId) {
      controller.selectCategory(input.categoryId);
      controller.selectWork(workId);
      setActiveModal(null);
      setActiveView("work");
      setActionMessage(input.mode === "edit" ? "已保存作品。" : "已创建作品。");
    }
  }

  function handleOpenWorkDetail(workId: string) {
    setIsMobileSidebarOpen(false);
    controller.selectWork(workId);
    setActiveView("work");
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

  function buildExportDialogState(
    title: string,
    shareFile: ShareImageFile,
    supportsCoverMosaic: boolean,
    coverMosaic: boolean,
    mosaicLevel: number,
    isRefreshing = false,
  ): ExportDialogState {
    const svgText = new TextDecoder().decode(shareFile.bytes);

    return {
      title,
      svgText,
      previewUrl: createSvgDataUrl(svgText),
      fileNameBase: sanitizeExportFileStem(shareFile.id),
      canRasterize: canRasterizeSvgForExport(),
      supportsCoverMosaic,
      coverMosaic,
      mosaicLevel,
      isRefreshing,
    };
  }

  async function openExportDialog(
    title: string,
    supportsCoverMosaic: boolean,
    createShareFile: ExportShareBuilder,
  ) {
    exportShareBuilderRef.current = createShareFile;
    const requestId = ++exportDialogRequestIdRef.current;
    const shareFile = await runAction(() =>
      createShareFile(DEFAULT_SHARE_COVER_OPTIONS),
    );

    if (!shareFile || requestId !== exportDialogRequestIdRef.current) {
      return;
    }

    setExportDialog(
      buildExportDialogState(
        title,
        shareFile,
        supportsCoverMosaic,
        DEFAULT_SHARE_COVER_OPTIONS.coverMosaic,
        DEFAULT_SHARE_COVER_OPTIONS.mosaicLevel,
      ),
    );
  }

  async function updateExportDialogCoverOptions(
    coverOptions: ShareCoverOptions,
  ) {
    if (!exportDialog || !exportShareBuilderRef.current) {
      return;
    }

    const requestId = ++exportDialogRequestIdRef.current;
    setExportDialog((current) =>
      current
        ? {
            ...current,
            coverMosaic: coverOptions.coverMosaic,
            mosaicLevel: coverOptions.mosaicLevel,
            isRefreshing: true,
          }
        : current,
    );

    try {
      const shareFile = await runAction(() =>
        exportShareBuilderRef.current!(coverOptions),
      );

      if (!shareFile || requestId !== exportDialogRequestIdRef.current) {
        return;
      }

      setExportDialog((current) =>
        current
          ? buildExportDialogState(
              current.title,
              shareFile,
              current.supportsCoverMosaic,
              coverOptions.coverMosaic,
              coverOptions.mosaicLevel,
            )
          : current,
      );
    } finally {
      if (requestId === exportDialogRequestIdRef.current) {
        setExportDialog((current) =>
          current
            ? {
                ...current,
                isRefreshing: false,
              }
            : current,
        );
      }
    }
  }

  async function handleExportWorkShare(variant: WorkShareVariant) {
    const label = variant === "cover" ? "作品封面图预览" : "作品长图预览";
    await openExportDialog(label, true, (options) =>
      controller.prepareSelectedWorkShare(variant, options),
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

    await openExportDialog("排行预览", false, async () =>
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

    await openExportDialog("五级分级预览", true, (options) =>
      createTierListPreviewShareImage(
        {
          tierListId: selectedTierList.id,
          tierListName: input.name,
          categoryName: selectedRootCategory.name,
          levels: input.levels,
          works: sharedCategoryWorks,
          coverImages: sharedCoverImageUrls,
        },
        options,
      ),
    );
  }

  function closeExportDialog() {
    exportDialogRequestIdRef.current += 1;
    exportShareBuilderRef.current = null;
    setExportDialog(null);
  }

  function handleSelectCategory(categoryId: string) {
    setIsMobileSidebarOpen(false);
    controller.selectCategory(categoryId);

    if (activeView === "work") {
      setActiveView("dashboard");
    }
  }

  function handleSelectView(view: WorkspaceView) {
    setIsMobileSidebarOpen(false);
    setActiveView(view);
  }

  function toggleMobileSidebar() {
    setIsMobileSidebarOpen((current) => !current);
  }

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false);
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

  return (
    <main className="app-shell">
      {isCompactLayout && isMobileSidebarOpen ? (
        <button
          className="mobile-sidebar-overlay"
          type="button"
          aria-label="关闭分类栏"
          onClick={closeMobileSidebar}
        />
      ) : null}

      <Sidebar
        isCompactLayout={isCompactLayout}
        isMobileOpen={isMobileSidebarOpen}
        activeView={activeView}
        categoryTree={categoryTree}
        library={state.library}
        selectedCategoryId={state.selectedCategoryId}
        storageDirectory={storageDirectory}
        showStorageDirectoryPanel={desktopBridge !== null}
        onSelectView={handleSelectView}
        onCreateWork={openCreateWorkModal}
        onCreateRootCategory={openRootCategoryModal}
        onCreateChildCategory={openChildCategoryModal}
        onSelectCategory={handleSelectCategory}
        onChooseStorageDirectory={handleChooseStorageDirectory}
        onCloseMobileSidebar={closeMobileSidebar}
      />

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-header-title">
            {isCompactLayout ? (
              <button
                className="mobile-menu-trigger"
                type="button"
                aria-label="打开分类栏"
                onClick={toggleMobileSidebar}
              >
                <Menu aria-hidden="true" size={20} />
              </button>
            ) : null}
            <div className="workspace-header-copy">
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
                onClick={() => handleSelectView("dashboard")}
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
                <div className="panel-heading panel-heading-split">
                  <div>
                    <ListPlus aria-hidden="true" size={18} />
                    <h3>作品</h3>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    aria-label="添加当前分类作品"
                    onClick={openCreateWorkModal}
                    disabled={!selectedCategory}
                  >
                    <ListPlus aria-hidden="true" size={16} />
                    添加作品
                  </button>
                </div>

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
                        onClick={() => handleOpenWorkDetail(work.id)}
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
            </div>
          </div>
        ) : workDetailView ? (
          <div className="work-detail-layout">
            {selectedWork ? (
              <>
                <section className="panel work-detail-hero">
                  <div className="work-detail-cover">
                    {selectedWorkCoverImageUrl ? (
                      <img src={selectedWorkCoverImageUrl} alt="" />
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
                        "还没有短评，可以打开编辑补充。"}
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
                        onClick={() => openEditWorkModal(selectedWork)}
                      >
                        <Pencil aria-hidden="true" size={16} />
                        编辑评测
                      </button>
                      <button
                        className="text-button danger"
                        type="button"
                        onClick={() => void handleDeleteWork()}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                        删除作品
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
                  onClick={() => handleSelectView("dashboard")}
                >
                  返回仪表盘
                </button>
              </div>
            )}
          </div>
        ) : rankingsView ? (
          <div className="ranking-hall">
            <section className="ranking-hero-panel">
              <div>
                <p className="eyebrow">排行榜</p>
                <h3>荣誉殿堂</h3>
                <p>
                  {selectedRootCategory
                    ? `${selectedRootCategory.name} 下共有 ${sharedCategoryWorks.length} 个作品。`
                    : "先创建一个大分类，再生成分值排名或五级分级。"}
                </p>
              </div>
              <div className="segmented-control" aria-label="排行榜视图">
                <button
                  className={
                    rankingSurfaceMode === "tier" ? "selected" : undefined
                  }
                  type="button"
                  aria-pressed={rankingSurfaceMode === "tier"}
                  onClick={() => setRankingSurfaceMode("tier")}
                >
                  Tier List
                </button>
                <button
                  className={
                    rankingSurfaceMode === "score" ? "selected" : undefined
                  }
                  type="button"
                  aria-pressed={rankingSurfaceMode === "score"}
                  onClick={() => setRankingSurfaceMode("score")}
                >
                  分值排名
                </button>
              </div>
            </section>

            <section className="ranking-toolbar" aria-label="排行榜筛选">
              <div className="toolbar-field">
                <span>分类</span>
                <select
                  aria-label="排行榜分类"
                  value={selectedRootCategory?.id ?? ""}
                  onChange={(event) => handleSelectCategory(event.target.value)}
                  disabled={rootCategories.length === 0}
                >
                  {rootCategories.length > 0 ? (
                    rootCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  ) : (
                    <option value="">暂无分类</option>
                  )}
                </select>
              </div>
            </section>

            {rankingSurfaceMode === "tier" ? (
              <>
                <section className="tier-control-panel">
                  {selectedCategory ? (
                    <>
                      <form
                        className="tier-create-toolbar"
                        onSubmit={handleCreateTierList}
                      >
                        <label htmlFor="new-tier-list">新分级</label>
                        <input
                          id="new-tier-list"
                          value={newTierListName}
                          onChange={(event) =>
                            setNewTierListName(event.target.value)
                          }
                          placeholder="五级分级"
                        />
                        <button className="text-button primary" type="submit">
                          <ListPlus aria-hidden="true" size={16} />
                          创建分级
                        </button>
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

                <section className="panel tier-board-panel">
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
                    <div className="center-state">
                      <Layers aria-hidden="true" size={28} />
                      <p>创建一个五级分级后，可以把作品放进 S 到 D。</p>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <section className="panel score-ranking-panel">
                <RankingPreviewPanel
                  rootCategory={selectedRootCategory}
                  library={state.library}
                  mode={rankingPreviewMode}
                  dimensionOptions={rankingDimensionOptions}
                  selectedDimensionId={selectedRankingPreviewDimensionId}
                  works={rankingPreviewWorks}
                  coverImageUrls={sharedCoverImageUrls}
                  onOpenWork={handleOpenWorkDetail}
                  onExport={handleExportRankingPreview}
                  onModeChange={(mode) => {
                    setRankingPreviewMode(mode);
                    if (mode !== "dimension") {
                      setRankingPreviewDimensionId("");
                    }
                  }}
                  onDimensionChange={setRankingPreviewDimensionId}
                />
              </section>
            )}
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
                      {selectedWorkCoverImageUrl ? (
                        <img src={selectedWorkCoverImageUrl} alt="" />
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

        {activeModal === "category" ? (
          <CategoryModal
            state={categoryModal}
            library={state.library}
            onChange={setCategoryModal}
            onClose={closeActiveModal}
            onSave={(input) => void handleSaveCategoryModal(input)}
          />
        ) : null}

        {activeModal === "work" ? (
          <WorkModal
            state={workModal}
            library={state.library}
            rootCategories={rootCategories}
            onChange={setWorkModal}
            onCategoryChange={handleWorkModalCategoryChange}
            onClose={closeActiveModal}
            onSave={(input) => void handleSaveWorkModal(input)}
          />
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

                {exportDialog.supportsCoverMosaic ? (
                  <div className="export-option-panel">
                    <label className="export-checkbox-row">
                      <input
                        type="checkbox"
                        checked={exportDialog.coverMosaic}
                        onChange={(event) =>
                          void updateExportDialogCoverOptions({
                            coverMosaic: event.currentTarget.checked,
                            mosaicLevel: exportDialog.mosaicLevel,
                          })
                        }
                      />
                      <span>封面图马赛克</span>
                    </label>

                    <div className="export-option-slider">
                      <div className="export-option-slider-header">
                        <label htmlFor="export-mosaic-level">马赛克等级</label>
                        <strong>{exportDialog.mosaicLevel}</strong>
                      </div>
                      <input
                        id="export-mosaic-level"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={exportDialog.mosaicLevel}
                        disabled={!exportDialog.coverMosaic}
                        onChange={(event) =>
                          void updateExportDialogCoverOptions({
                            coverMosaic: true,
                            mosaicLevel: Number(event.currentTarget.value),
                          })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <p className="inline-hint">当前导出不包含封面图。</p>
                )}
              </div>

              <div className="button-row export-dialog-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void handleCopyExportImage()}
                  disabled={
                    exportDialog.isRefreshing ||
                    !exportDialog.canRasterize ||
                    (!desktopBridge && !canCopyImageToClipboard())
                  }
                >
                  <ClipboardCopy aria-hidden="true" size={16} />
                  {exportDialog.isRefreshing ? "更新中" : "复制图片"}
                </button>
                <button
                  className="text-button primary"
                  type="button"
                  onClick={() => void handleSaveExportFile()}
                  disabled={exportDialog.isRefreshing}
                >
                  <Download aria-hidden="true" size={16} />
                  {exportDialog.isRefreshing ? "更新中" : "导出文件"}
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

        {isCompactLayout ? (
          <MobileBottomNavigation
            activeView={activeView}
            onSelectView={handleSelectView}
            onOpenSidebar={toggleMobileSidebar}
          />
        ) : null}
      </section>
    </main>
  );
}

interface RankingPreviewPanelProps {
  rootCategory: Category | null;
  library: TasteLibrary;
  mode: ScoreRankingMode;
  dimensionOptions: RankingDimensionOption[];
  selectedDimensionId: string | null;
  works: Work[];
  coverImageUrls: Map<string, string>;
  onOpenWork(workId: string): void;
  onExport(): Promise<void> | void;
  onModeChange(mode: ScoreRankingMode): void;
  onDimensionChange(dimensionId: string): void;
}

function RankingPreviewPanel({
  rootCategory,
  library,
  mode,
  dimensionOptions,
  selectedDimensionId,
  works,
  coverImageUrls,
  onOpenWork,
  onExport,
  onModeChange,
  onDimensionChange,
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
      <div className="score-ranking-header">
        <div>
          <h3>数值排行榜</h3>
          <p>
            {mode === "dimension" && selectedDimensionId
              ? getRankingDimensionName(selectedDimensionId, dimensionOptions)
              : "综合评分"}
          </p>
        </div>
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

      <section
        className="ranking-toolbar ranking-toolbar-inline"
        aria-label="分值排名筛选"
      >
        <div className="toolbar-field">
          <span>排序维度</span>
          <select
            aria-label="排序维度类型"
            value={mode}
            onChange={(event) => {
              const nextMode = event.currentTarget.value as ScoreRankingMode;
              onModeChange(nextMode);
            }}
          >
            <option value="finalScore">综合评分</option>
            <option value="dimension">单个评分维度</option>
          </select>
        </div>

        <div className="toolbar-field">
          <span>评分维度</span>
          <select
            aria-label="评分维度"
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
      </section>

      {mode === "dimension" && dimensionOptions.length === 0 ? (
        <p className="inline-hint">先添加评分维度，再按单个维度排名。</p>
      ) : null}

      {works.length > 0 ? (
        <ol className="ranking-work-list" aria-label="排名作品">
          {works.map((work, index) => {
            const coverImageUrl = coverImageUrls.get(work.id) ?? null;
            const categoryPath = getCategoryLineage(library, work.categoryId)
              .map((category) => category.name)
              .join(" / ");

            return (
              <li className="ranking-work-row" key={work.id}>
                <span className="rank-number">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                <span className="ranking-work-cover">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="" />
                  ) : (
                    <ImagePlus aria-hidden="true" size={18} />
                  )}
                </span>
                <div className="ranking-work-copy">
                  <strong>{work.title}</strong>
                  <small>{categoryPath || rootCategory.name}</small>
                </div>
                <strong className="ranking-work-score">
                  {formatRankingPreviewScore(work, mode, selectedDimensionId)}
                </strong>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`打开 ${work.title}`}
                  onClick={() => onOpenWork(work.id)}
                >
                  <ChevronRight aria-hidden="true" size={16} />
                </button>
              </li>
            );
          })}
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

interface TierWorkCardProps {
  work: Work;
  coverImageUrl: string | null;
  isDragging: boolean;
  onDragStart(workId: string, event: DragEvent<HTMLElement>): void;
  onDragEnd(): void;
}

function TierWorkCard({
  work,
  coverImageUrl,
  isDragging,
  onDragStart,
  onDragEnd,
}: TierWorkCardProps) {
  return (
    <article
      className={isDragging ? "tier-work-card dragging" : "tier-work-card"}
      draggable
      aria-label={`拖动 ${work.title}`}
      aria-grabbed={isDragging}
      onDragStart={(event) => onDragStart(work.id, event)}
      onDragEnd={onDragEnd}
    >
      <div className="tier-work-cover">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" />
        ) : (
          <span>{work.coverImagePath ?? "未设置封面"}</span>
        )}
      </div>
      <div className="tier-work-copy">
        <strong>{work.title}</strong>
      </div>
    </article>
  );
}

function createEmptyCategoryModalState(): CategoryModalState {
  return createRootCategoryModalState();
}

function createRootCategoryModalState(): CategoryModalState {
  return {
    mode: "root",
    parentCategoryId: null,
    name: "",
    dimensionDrafts: [
      {
        id: `template-${crypto.randomUUID()}`,
        name: "剧情",
        weight: "1",
      },
      {
        id: `template-${crypto.randomUUID()}`,
        name: "画面",
        weight: "1",
      },
    ],
  };
}

function createChildCategoryModalState(
  parentCategoryId: string,
): CategoryModalState {
  return {
    mode: "child",
    parentCategoryId,
    name: "",
    dimensionDrafts: [],
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
