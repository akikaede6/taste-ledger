import { ArrowLeft, RefreshCw, Search } from "lucide-react";

type WorkspaceHeaderProps = {
  title: string;
  subtitle: string;
  heading: string;

  isDashboardView: boolean;
  isWorkDetailView: boolean;
  isRankingsView: boolean;
  isSharingView: boolean;

  selectedCategoryPath: string;
  selectedWorkCategoryPath: string;
  selectedRootCategoryName: string | null;
  showSharedDimensionNotice: boolean;

  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onBackToDashboard: () => void;
  onRefresh: () => void | Promise<void>;
};

export function WorkspaceHeader({
  title,
  subtitle,
  heading,
  isDashboardView,
  isWorkDetailView,
  isRankingsView,
  isSharingView,
  selectedCategoryPath,
  selectedWorkCategoryPath,
  selectedRootCategoryName,
  showSharedDimensionNotice,
  searchQuery,
  onSearchQueryChange,
  onBackToDashboard,
  onRefresh,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div>
        <span>{title}</span>
        <h2>{heading}</h2>
        <p>{subtitle}</p>

        {isDashboardView && selectedCategoryPath ? (
          <p className="helper-text">{selectedCategoryPath}</p>
        ) : null}

        {isWorkDetailView && selectedWorkCategoryPath ? (
          <p className="helper-text">{selectedWorkCategoryPath}</p>
        ) : null}

        {showSharedDimensionNotice && selectedRootCategoryName ? (
          <p className="helper-text">
            评分维度和排行由「{selectedRootCategoryName}」共享。
          </p>
        ) : null}

        {(isRankingsView || isSharingView) && selectedRootCategoryName ? (
          <p className="helper-text">当前大分类：{selectedRootCategoryName}</p>
        ) : null}
      </div>

      <div className="workspace-header-actions">
        {isDashboardView ? (
          <label className="search-field">
            <Search aria-hidden="true" size={16} />
            <input
              value={searchQuery}
              onChange={(event) =>
                onSearchQueryChange(event.currentTarget.value)
              }
              placeholder="搜索作品、标签或短评"
            />
          </label>
        ) : null}

        {isWorkDetailView ? (
          <button
            className="secondary-button"
            type="button"
            onClick={onBackToDashboard}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            返回仪表盘
          </button>
        ) : null}

        <button
          className="secondary-button"
          type="button"
          onClick={() => void onRefresh()}
        >
          <RefreshCw aria-hidden="true" size={16} />
          重新载入
        </button>
      </div>
    </header>
  );
}
