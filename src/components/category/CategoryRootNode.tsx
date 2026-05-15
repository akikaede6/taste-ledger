import { FolderOpen, Plus } from "lucide-react";
import {
  getCategoryDescendantIds,
  type CategoryTreeNode,
} from "../../core/category-tree";
import type { Library as TasteLibrary } from "../../core/model";
import { CategoryChildNode } from "./CategoryChildNode";

type CategoryRootNodeProps = {
  node: CategoryTreeNode;
  library: TasteLibrary;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onCreateChildCategory: (parentCategoryId: string) => void;
};

export function CategoryRootNode({
  node,
  library,
  selectedCategoryId,
  onSelectCategory,
  onCreateChildCategory,
}: CategoryRootNodeProps) {
  const rootScopeIds = new Set(
    getCategoryDescendantIds(library, node.category.id),
  );

  const workCount = library.works.filter((work) =>
    rootScopeIds.has(work.categoryId),
  ).length;

  const childCount = node.children.length;
  const selectedRoot = selectedCategoryId === node.category.id;
  const selectedChild = node.children.some(
    (child) => child.category.id === selectedCategoryId,
  );

  return (
    <div className="category-group">
      <div
        className={
          selectedRoot || selectedChild
            ? "category-root-row selected"
            : "category-root-row"
        }
      >
        <button
          className="category-root-button"
          type="button"
          onClick={() => onSelectCategory(node.category.id)}
        >
          <div className="category-button-row">
            <FolderOpen aria-hidden="true" size={16} />
            <span>{node.category.name}</span>
          </div>

          <small>
            {workCount} 作品
            {childCount > 0 ? ` · ${childCount} 子分类` : ""}
          </small>
        </button>

        <button
          className="category-add-child-button"
          type="button"
          aria-label={`在 ${node.category.name} 下创建子分类`}
          title="创建子分类"
          onClick={(event) => {
            event.stopPropagation();
            onCreateChildCategory(node.category.id);
          }}
        >
          <Plus aria-hidden="true" size={14} />
        </button>
      </div>

      {node.children.length > 0 ? (
        <div className="category-children">
          {node.children.map((child) => (
            <CategoryChildNode
              key={child.category.id}
              node={child}
              library={library}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
