import { ChevronRight } from "lucide-react";
import type { CategoryTreeNode } from "../../core/category-tree";
import type { Library as TasteLibrary } from "../../core/model";

type CategoryChildNodeProps = {
  node: CategoryTreeNode;
  library: TasteLibrary;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
};

export function CategoryChildNode({
  node,
  library,
  selectedCategoryId,
  onSelectCategory,
}: CategoryChildNodeProps) {
  const workCount = library.works.filter(
    (work) => work.categoryId === node.category.id,
  ).length;

  const selected = selectedCategoryId === node.category.id;

  return (
    <button
      className={
        selected ? "category-child-button selected" : "category-child-button"
      }
      type="button"
      onClick={() => onSelectCategory(node.category.id)}
    >
      <span className="category-child-name">
        <ChevronRight aria-hidden="true" size={14} />
        {node.category.name}
      </span>

      <small>{workCount} 作品 · 共用上级设置</small>
    </button>
  );
}
