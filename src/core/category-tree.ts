import type { Category, Library } from "./model";

export interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}

export function getCategoryById(
  library: Library,
  categoryId: string,
): Category | undefined {
  return library.categories.find((category) => category.id === categoryId);
}

export function getCategoryRootId(
  library: Library,
  categoryId: string,
): string | null {
  const category = getCategoryById(library, categoryId);

  if (!category) {
    return null;
  }

  let current: Category = category;
  const seen = new Set<string>([current.id]);

  while (current.parentCategoryId) {
    const parent = getCategoryById(library, current.parentCategoryId);

    if (!parent || seen.has(parent.id)) {
      return current.id;
    }

    seen.add(parent.id);
    current = parent;
  }

  return current.id;
}

export function getCategoryAncestorIds(
  library: Library,
  categoryId: string,
): string[] {
  const ancestors: string[] = [];
  let current = getCategoryById(library, categoryId);
  const seen = new Set<string>(current ? [current.id] : []);

  while (current?.parentCategoryId) {
    ancestors.push(current.parentCategoryId);

    if (seen.has(current.parentCategoryId)) {
      break;
    }

    seen.add(current.parentCategoryId);
    current = getCategoryById(library, current.parentCategoryId);
  }

  return ancestors;
}

export function getCategoryDescendantIds(
  library: Library,
  categoryId: string,
): string[] {
  const descendants: string[] = [];
  const stack = [categoryId];
  const seen = new Set<string>();
  const childrenByParent = buildChildrenMap(library);

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (!currentId || seen.has(currentId)) {
      continue;
    }

    seen.add(currentId);
    descendants.push(currentId);

    const children = childrenByParent.get(currentId) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index].id);
    }
  }

  return descendants;
}

export function getCategoryTree(library: Library): CategoryTreeNode[] {
  const childrenByParent = buildChildrenMap(library);

  function build(
    parentCategoryId: string | null,
    lineage: Set<string>,
  ): CategoryTreeNode[] {
    return (childrenByParent.get(parentCategoryId) ?? []).map((category) => ({
      category,
      children: lineage.has(category.id)
        ? []
        : build(category.id, new Set([...lineage, category.id])),
    }));
  }

  return build(null, new Set());
}

export function getCategoryDepth(library: Library, categoryId: string): number {
  let depth = 0;
  let current = getCategoryById(library, categoryId);
  const seen = new Set<string>(current ? [current.id] : []);

  while (current?.parentCategoryId) {
    if (seen.has(current.parentCategoryId)) {
      break;
    }

    seen.add(current.parentCategoryId);
    depth += 1;
    current = getCategoryById(library, current.parentCategoryId);
  }

  return depth;
}

export function getCategoryLineage(
  library: Library,
  categoryId: string,
): Category[] {
  const lineage: Category[] = [];
  let current = getCategoryById(library, categoryId);
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    lineage.unshift(current);
    current = current.parentCategoryId
      ? getCategoryById(library, current.parentCategoryId)
      : undefined;
  }

  return lineage;
}

function buildChildrenMap(library: Library): Map<string | null, Category[]> {
  const childrenByParent = new Map<string | null, Category[]>();

  for (const category of library.categories) {
    const parentKey = category.parentCategoryId;
    const current = childrenByParent.get(parentKey) ?? [];
    current.push(category);
    childrenByParent.set(parentKey, current);
  }

  for (const categories of childrenByParent.values()) {
    categories.sort((left, right) => {
      const updated = right.updatedAt.localeCompare(left.updatedAt);
      return updated !== 0 ? updated : left.name.localeCompare(right.name);
    });
  }

  return childrenByParent;
}
