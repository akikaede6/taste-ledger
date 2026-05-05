import type { Category, Library } from "./model";

export interface CategoryInput {
  name: string;
}

export function createCategory(
  library: Library,
  input: CategoryInput,
): Library {
  const next = cloneLibrary(library);
  const now = new Date().toISOString();
  const name = input.name.trim();

  if (name.length === 0) {
    throw new Error("Category name cannot be empty.");
  }

  next.categories.push({
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    ratingDimensionTemplates: [],
  });

  return next;
}

export function renameCategory(
  library: Library,
  categoryId: string,
  name: string,
): Library {
  const next = cloneLibrary(library);
  const category = findCategory(next, categoryId);
  const trimmedName = name.trim();

  if (!category) {
    throw new Error("Category not found.");
  }

  if (trimmedName.length === 0) {
    throw new Error("Category name cannot be empty.");
  }

  category.name = trimmedName;
  category.updatedAt = new Date().toISOString();

  return next;
}

export function deleteCategory(library: Library, categoryId: string): Library {
  const next = cloneLibrary(library);
  next.categories = next.categories.filter(
    (category) => category.id !== categoryId,
  );
  next.works = next.works.filter((work) => work.categoryId !== categoryId);
  next.rankings = next.rankings.filter(
    (ranking) => ranking.categoryId !== categoryId,
  );
  return next;
}

export function sortCategoriesByRecentUpdate(
  categories: Category[],
): Category[] {
  return [...categories].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function cloneLibrary(library: Library): Library {
  return structuredClone(library);
}

function findCategory(
  library: Library,
  categoryId: string,
): Category | undefined {
  return library.categories.find((category) => category.id === categoryId);
}
