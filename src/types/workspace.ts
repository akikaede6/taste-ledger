import type {
  RatingTemplateDraft,
  RatingDimensionDraft,
} from "../components/rating/RatingDrafts";
import type { TierLevel } from "../core/model";
import type { ShareCoverOptions, ShareImageFile } from "../core/share-export";

export interface TierListSaveInput {
  name: string;
  levels: TierLevel[];
}

export interface ExportDialogState {
  title: string;
  svgText: string;
  previewUrl: string;
  fileNameBase: string;
  canRasterize: boolean;
  supportsCoverMosaic: boolean;
  coverMosaic: boolean;
  mosaicLevel: number;
  isRefreshing: boolean;
}

export interface ExportPreferences {
  directory: string | null;
}

export interface ExportShareBuilder {
  (options: ShareCoverOptions): Promise<ShareImageFile>;
}

export type ScoreRankingMode = "finalScore" | "dimension";
export type ActiveModal = "category" | "work" | null;
export type RankingSurfaceMode = "tier" | "score";
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
