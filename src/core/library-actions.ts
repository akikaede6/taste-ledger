import type { Category, Library, Work } from "./model";
import { recalculateWorkScore } from "./scoring";

export interface CategoryInput {
  name: string;
}

export interface WorkInput {
  categoryId: string;
  title: string;
  coverImagePath?: string | null;
  shortReview?: string;
  longReview?: string;
}

export interface WorkUpdateInput {
  title?: string;
  coverImagePath?: string | null;
  shortReview?: string;
  longReview?: string;
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

export function createWork(
  library: Library,
  input: WorkInput,
): { library: Library; work: Work } {
  const next = cloneLibrary(library);
  const category = findCategory(next, input.categoryId);
  const now = new Date().toISOString();
  const title = input.title.trim();

  if (!category) {
    throw new Error("Category not found.");
  }

  if (title.length === 0) {
    throw new Error("Work title cannot be empty.");
  }

  const work = recalculateWorkScore({
    id: crypto.randomUUID(),
    categoryId: category.id,
    title,
    coverImagePath: input.coverImagePath ?? null,
    shortReview: input.shortReview ?? "",
    longReview: input.longReview ?? "",
    ratingDimensions: category.ratingDimensionTemplates.map((dimension) => ({
      id: dimension.id,
      name: dimension.name,
      score: 0,
      weight: dimension.weight,
    })),
    finalScore: null,
    createdAt: now,
    updatedAt: now,
  });

  next.works.push(work);
  category.updatedAt = now;

  return {
    library: next,
    work,
  };
}

export function updateWork(
  library: Library,
  workId: string,
  input: WorkUpdateInput,
): Library {
  const next = cloneLibrary(library);
  const work = findWork(next, workId);
  const now = new Date().toISOString();

  if (!work) {
    throw new Error("Work not found.");
  }

  if (input.title !== undefined) {
    const title = input.title.trim();

    if (title.length === 0) {
      throw new Error("Work title cannot be empty.");
    }

    work.title = title;
  }

  if (input.coverImagePath !== undefined) {
    work.coverImagePath = input.coverImagePath;
  }

  if (input.shortReview !== undefined) {
    work.shortReview = input.shortReview;
  }

  if (input.longReview !== undefined) {
    work.longReview = input.longReview;
  }

  const updatedWork = recalculateWorkScore({
    ...work,
    updatedAt: now,
  });
  Object.assign(work, updatedWork);
  touchCategory(next, work.categoryId, now);

  return next;
}

export function deleteWork(library: Library, workId: string): Library {
  const next = cloneLibrary(library);
  const work = findWork(next, workId);
  const now = new Date().toISOString();

  if (!work) {
    throw new Error("Work not found.");
  }

  next.works = next.works.filter((item) => item.id !== workId);
  next.rankings = next.rankings.map((ranking) =>
    ranking.workIds.includes(workId)
      ? {
          ...ranking,
          workIds: ranking.workIds.filter((item) => item !== workId),
          updatedAt: now,
        }
      : ranking,
  );
  touchCategory(next, work.categoryId, now);

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

function findWork(library: Library, workId: string): Work | undefined {
  return library.works.find((work) => work.id === workId);
}

function touchCategory(library: Library, categoryId: string, now: string) {
  const category = findCategory(library, categoryId);
  if (category) {
    category.updatedAt = now;
  }
}
