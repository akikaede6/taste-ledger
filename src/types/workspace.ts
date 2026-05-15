import type { RatingTemplateDraft, RatingDimensionDraft } from "../components/rating/RatingDrafts";

export type ActiveModal = "category" | "work" | null;

export interface CategoryModalState {
  mode: "root" | "child";
  parentCategoryId: string | null;
  name: string;
  dimensionDrafts: RatingTemplateDraft[];
}

export interface WorkModalState {
  mode: "create" | "edit";
  workId: string | null;
  categoryId: string | null;
  title: string;
  tagsText: string;
  shortReview: string;
  longReview: string;
  ratingDimensions: RatingDimensionDraft[];
  coverFileName: string | null;
  coverBytes: Uint8Array | null;
  coverPreviewUrl: string | null;
}