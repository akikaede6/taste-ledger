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
  countTierListWorks,
  getRankingDimensionName,
  getRankingDimensionValue,
} from "./components/rankings/RankingHelpers";
import { TierListEditor } from "./components/rankings/TierListEditor";
import { RankingPreviewPanel } from "./components/rankings/RankingPreviewPanel";
import { ExportDialog } from "./components/export/ExportDialog";
import { FatalState } from "./components/app/FatalState";
import { LoadingShell } from "./components/app/LoadingShell";
import {
  createChildCategoryModalState,
  createEmptyCategoryModalState,
  createRootCategoryModalState,
} from "./components/category/CategoryModalState";
import {
  collectTagOptions,
  matchesTagFilters,
  matchesWorkSearch,
  parseTagText,
} from "./components/tags/TagUtils";
import {
  canCopyImageToClipboard,
  canRasterizeSvgForExport,
  downloadFile,
  loadExportPreferences,
  sanitizeExportFileStem,
  storeExportPreferences,
} from "./components/export/ExportUtils";
import { WorkspaceHeader } from "./components/workspace/WorkspaceHeader";
import { DashboardView } from "./components/dashboard/DashboardView";
import { WorkDetailView } from "./components/work/WorkDetailView";
import { SharingView } from "./components/sharing/SharingView";
import { RankingsView } from "./components/rankings/RankingsView";
import {
  BookOpen,
  FileText,
  ImagePlus,
  Layers,
  ListPlus,
  Pencil,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { sortTierListsByRecentUpdate } from "./core/library-actions";
import {
  getCategoryDescendantIds,
  getCategoryLineage,
  getCategoryRootId,
  getCategoryTree,
} from "./core/category-tree";
import { useLibraryState } from "./core/library-store";
import type { RatingDimensionTemplate, TierLevelId, Work } from "./core/model";
import {
  collectRankingDimensionOptions,
  sortWorksForRanking,
} from "./core/ranking";
import {
  convertSvgTextToExportFile,
  copyImageToClipboard,
  createSvgDataUrl,
} from "./core/image-utils";
import type { LibraryRepository } from "./core/repository";
import { createLibraryRepository } from "./core/repository";
import type { ShareImageFile, WorkShareVariant } from "./core/share-export";
import {
  DEFAULT_SHARE_COVER_OPTIONS,
  createRankingPreviewShareImage,
  createTierListPreviewShareImage,
  type ShareCoverOptions,
} from "./core/share-export";
import { createRuntimeBackend } from "./platform/runtime-backend";
import { getDesktopBridge } from "./platform/runtime-bridge";

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
        <WorkspaceHeader
          title={activeViewTitle}
          subtitle={activeViewSubtitle}
          heading={
            dashboardView
              ? (selectedCategory?.name ?? "创建第一个分类")
              : workDetailView
                ? (selectedWork?.title ?? "作品详情")
                : activeViewTitle
          }
          isDashboardView={dashboardView}
          isWorkDetailView={workDetailView}
          isRankingsView={rankingsView}
          isSharingView={sharingView}
          selectedCategoryPath={selectedCategoryPath}
          selectedWorkCategoryPath={selectedWorkCategoryPath}
          selectedRootCategoryName={selectedRootCategory?.name ?? null}
          showSharedDimensionNotice={
            dashboardView &&
            selectedRootCategory != null &&
            selectedCategory != null &&
            selectedRootCategory.id !== selectedCategory.id
          }
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onBackToDashboard={() => handleSelectView("dashboard")}
          onRefresh={() => void controller.refresh()}
        />

        {state.status === "loading" ? (
          <LoadingShell label="正在读取本地资料库" />
        ) : state.status === "error" ? (
          <FatalState message={state.errorMessage ?? "资料库读取失败。"} />
        ) : dashboardView ? (
          <DashboardView
            library={state.library}
            selectedCategory={selectedCategory}
            selectedRootCategory={selectedRootCategory}
            categoryWorks={categoryWorks}
            visibleWorks={visibleWorks}
            recentWorks={recentWorks}
            pendingWorks={pendingWorks}
            categoryTagOptions={categoryTagOptions}
            activeTagFilters={activeTagFilters}
            rootCategoryCount={rootCategoryCount}
            childCategoryCount={childCategoryCount}
            dashboardScopeWorkCount={dashboardScopeWorkCount}
            dashboardAverageScore={dashboardAverageScore}
            coverImageUrls={coverImageUrls}
            onOpenWorkDetail={handleOpenWorkDetail}
            onCreateWork={openCreateWorkModal}
            onToggleTagFilter={toggleTagFilter}
            onClearTagFilters={() => setSelectedTagFilters([])}
            onRenameCategory={handleRenameCategory}
            onDeleteCategory={handleDeleteCategory}
            onSaveCategoryDimensions={handleSaveCategoryDimensions}
          />
        ) : workDetailView ? (
          <WorkDetailView
            work={selectedWork}
            coverImageUrl={selectedWorkCoverImageUrl}
            categoryPath={selectedWorkCategoryPath}
            fallbackCategoryPath={selectedCategoryPath}
            onEditWork={openEditWorkModal}
            onDeleteWork={handleDeleteWork}
            onExportCover={() => handleExportWorkShare("cover")}
            onExportLong={() => handleExportWorkShare("long")}
            onBackToDashboard={() => handleSelectView("dashboard")}
          />
        ) : rankingsView ? (
          <RankingsView
            library={state.library}
            selectedCategory={selectedCategory}
            selectedRootCategory={selectedRootCategory}
            selectedTierList={selectedTierList}
            selectedTierListId={state.selectedTierListId}
            categoryTierLists={categoryTierLists}
            sharedCategoryWorks={sharedCategoryWorks}
            rankingPreviewWorks={rankingPreviewWorks}
            sharedCoverImageUrls={sharedCoverImageUrls}
            rankingSurfaceMode={rankingSurfaceMode}
            rankingPreviewMode={rankingPreviewMode}
            rankingPreviewDimensionId={rankingPreviewDimensionId}
            selectedRankingPreviewDimensionId={
              selectedRankingPreviewDimensionId
            }
            rankingDimensionOptions={rankingDimensionOptions}
            newTierListName={newTierListName}
            onRankingSurfaceModeChange={setRankingSurfaceMode}
            onRankingPreviewModeChange={setRankingPreviewMode}
            onRankingPreviewDimensionChange={setRankingPreviewDimensionId}
            onNewTierListNameChange={setNewTierListName}
            onCreateTierList={handleCreateTierList}
            onSelectTierList={controller.selectTierList}
            onSaveTierList={handleSaveTierList}
            onDeleteTierList={handleDeleteTierList}
            onMoveTierListWork={handleMoveTierListWork}
            onRemoveTierListWork={handleRemoveTierListWork}
            onOpenWorkDetail={handleOpenWorkDetail}
            onExportRankingPreview={handleExportRankingPreview}
            onExportTierList={handleExportTierListShare}
          />
        ) : sharingView ? (
          <SharingView
            selectedWork={selectedWork}
            selectedWorkCoverImageUrl={selectedWorkCoverImageUrl}
            selectedWorkCategoryPath={selectedWorkCategoryPath}
            selectedCategoryPath={selectedCategoryPath}
            selectedCategoryName={selectedCategory?.name ?? null}
            selectedRootCategoryName={selectedRootCategory?.name ?? null}
            rankingPreviewWorkCount={rankingPreviewWorks.length}
            selectedTierList={selectedTierList}
            onExportWorkCover={() => handleExportWorkShare("cover")}
            onExportWorkLong={() => handleExportWorkShare("long")}
            onExportRankingPreview={handleExportRankingPreview}
            onExportTierList={() =>
              selectedTierList
                ? handleExportTierListShare({
                    name: selectedTierList.name,
                    levels: selectedTierList.levels,
                  })
                : undefined
            }
          />
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
          <ExportDialog
            state={exportDialog}
            exportDirectory={exportPreferences.directory}
            hasDesktopBridge={desktopBridge !== null}
            canCopy={
              exportDialog.canRasterize &&
              (desktopBridge !== null || canCopyImageToClipboard())
            }
            onChooseDirectory={handleChooseExportDirectory}
            onUpdateCoverOptions={updateExportDialogCoverOptions}
            onCopyImage={handleCopyExportImage}
            onSaveFile={handleSaveExportFile}
            onClose={closeExportDialog}
          />
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

interface TagOption {
  value: string;
  count: number;
}

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}
