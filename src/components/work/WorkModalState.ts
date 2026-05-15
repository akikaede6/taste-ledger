import { getCategoryRootId } from "../../core/category-tree";
import type {
  Library as TasteLibrary,
  RatingDimensionTemplate,
  Work,
} from "../../core/model";
import type { WorkModalState } from "../../types/workspace";
import {
  createDimensionDrafts,
  createDimensionDraftsFromTemplates,
} from "../rating/RatingDrafts";

export function createEmptyWorkModalState(): WorkModalState {
  return {
    mode: "create",
    workId: null,
    categoryId: null,
    title: "",
    tagsText: "",
    shortReview: "",
    longReview: "",
    ratingDimensions: [],
    coverFileName: null,
    coverBytes: null,
    coverPreviewUrl: null,
  };
}

export function createWorkModalState({
  categoryId,
  library,
}: {
  categoryId: string | null;
  library: TasteLibrary;
}): WorkModalState {
  return {
    ...createEmptyWorkModalState(),
    categoryId,
    ratingDimensions: createDimensionDraftsFromTemplates(
      getWorkModalTemplates(library, categoryId),
    ),
  };
}

export function createEditWorkModalState({
  coverPreviewUrl,
  library,
  work,
}: {
  coverPreviewUrl: string | null;
  library: TasteLibrary;
  work: Work;
}): WorkModalState {
  const ratingDimensions =
    work.ratingDimensions.length > 0
      ? createDimensionDrafts(work.ratingDimensions)
      : createDimensionDraftsFromTemplates(
          getWorkModalTemplates(library, work.categoryId),
        );

  return {
    mode: "edit",
    workId: work.id,
    categoryId: work.categoryId,
    title: work.title,
    tagsText: work.tags.join(", "),
    shortReview: work.shortReview,
    longReview: work.longReview,
    ratingDimensions,
    coverFileName: work.coverImagePath,
    coverBytes: null,
    coverPreviewUrl,
  };
}

export function syncWorkModalCategory(
  current: WorkModalState,
  library: TasteLibrary,
  categoryId: string | null,
): WorkModalState {
  const currentScoresById = new Map(
    current.ratingDimensions.map((dimension) => [dimension.id, dimension]),
  );

  return {
    ...current,
    categoryId,
    ratingDimensions: getWorkModalTemplates(library, categoryId).map(
      (template) => {
        const currentDimension = currentScoresById.get(template.id);

        return {
          id: template.id,
          name: template.name,
          score: currentDimension?.score ?? "0",
          weight: String(template.weight),
        };
      },
    ),
  };
}

export function getWorkModalTemplates(
  library: TasteLibrary,
  categoryId: string | null,
): RatingDimensionTemplate[] {
  if (!categoryId) {
    return [];
  }

  const rootCategoryId = getCategoryRootId(library, categoryId) ?? categoryId;

  return (
    library.categories.find((category) => category.id === rootCategoryId)
      ?.ratingDimensionTemplates ?? []
  );
}

export function resolveWorkModalRootId(
  library: TasteLibrary,
  categoryId: string | null,
): string | null {
  if (!categoryId) {
    return null;
  }

  return getCategoryRootId(library, categoryId) ?? categoryId;
}
