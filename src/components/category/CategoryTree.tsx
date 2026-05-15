import type { CategoryTreeNode } from "../../core/category-tree";
import type { Library as TasteLibrary } from "../../core/model";
import { CategoryRootNode } from "./CategoryRootNode";

type CategoryTreeProps = {
  nodes: CategoryTreeNode[];
  library: TasteLibrary;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string) => void;
  onCreateChildCategory: (parentCategoryId: string) => void;
};

export function CategoryTree({
  nodes,
  library,
  selectedCategoryId,
  onSelectCategory,
  onCreateChildCategory,
}: CategoryTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <CategoryRootNode
          key={node.category.id}
          node={node}
          library={library}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onCreateChildCategory={onCreateChildCategory}
        />
      ))}
    </>
  );
}