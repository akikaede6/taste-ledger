import { Plus, X } from "lucide-react";
import type { CategoryTreeNode } from "../../core/category-tree";
import type { Library as TasteLibrary } from "../../core/model";
import type { WorkspaceView } from "../../types/ui";
import { CategoryTree } from "../category/CategoryTree";
import { StorageDirectoryPanel } from "./StorageDirectoryPanel";
import { ViewNavigation } from "./ViewNavigation";

type SidebarProps = {
  isCompactLayout: boolean;
  isMobileOpen: boolean;

  activeView: WorkspaceView;
  categoryTree: CategoryTreeNode[];
  library: TasteLibrary;
  selectedCategoryId: string | null;

  storageDirectory: string | null;
  showStorageDirectoryPanel: boolean;

  onSelectView: (view: WorkspaceView) => void;
  onCreateWork: () => void;
  onCreateRootCategory: () => void;
  onCreateChildCategory: (parentCategoryId: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onChooseStorageDirectory: () => void | Promise<void>;
  onCloseMobileSidebar: () => void;
};

export function Sidebar({
  isCompactLayout,
  isMobileOpen,
  activeView,
  categoryTree,
  library,
  selectedCategoryId,
  storageDirectory,
  showStorageDirectoryPanel,
  onSelectView,
  onCreateWork,
  onCreateRootCategory,
  onCreateChildCategory,
  onSelectCategory,
  onChooseStorageDirectory,
  onCloseMobileSidebar,
}: SidebarProps) {
  const className =
    isCompactLayout && isMobileOpen ? "sidebar mobile-open" : "sidebar";

  return (
    <aside className={className}>
      <div className="sidebar-brand">
        <span>Taste Ledger</span>
        <strong>味觉账本</strong>

        {isCompactLayout ? (
          <button
            className="icon-button"
            type="button"
            aria-label="关闭分类侧边栏"
            onClick={onCloseMobileSidebar}
          >
            <X aria-hidden="true" size={18} />
          </button>
        ) : null}
      </div>

      {showStorageDirectoryPanel ? (
        <StorageDirectoryPanel
          storageDirectory={storageDirectory}
          onChooseStorageDirectory={onChooseStorageDirectory}
        />
      ) : null}

      <ViewNavigation activeView={activeView} onSelectView={onSelectView} />

      <div className="sidebar-actions">
        <button className="sidebar-secondary-action" type="button" onClick={onCreateWork}>
          <Plus aria-hidden="true" size={16} />
          添加作品
        </button>

        <button className="sidebar-secondary-action" type="button" onClick={onCreateRootCategory}>
          <Plus aria-hidden="true" size={16} />
          创建新大类
        </button>
      </div>

      <section className="category-panel">
        <div className="section-heading">
          <span>媒体库分类</span>
        </div>

        <CategoryTree
          nodes={categoryTree}
          library={library}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onCreateChildCategory={onCreateChildCategory}
        />
      </section>
    </aside>
  );
}