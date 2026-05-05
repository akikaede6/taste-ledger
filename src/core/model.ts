export const CURRENT_SCHEMA_VERSION = 1 as const;

export type SchemaVersion = typeof CURRENT_SCHEMA_VERSION;

export type EntityId = string;
export type IsoDateString = string;

export interface RatingDimensionTemplate {
  id: EntityId;
  name: string;
  weight: number;
}

export interface RatingDimensionScore {
  id: EntityId;
  name: string;
  score: number;
  weight: number;
}

export interface Category {
  id: EntityId;
  name: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  ratingDimensionTemplates: RatingDimensionTemplate[];
}

export interface Work {
  id: EntityId;
  categoryId: EntityId;
  title: string;
  coverImagePath: string | null;
  shortReview: string;
  longReview: string;
  ratingDimensions: RatingDimensionScore[];
  finalScore: number | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export type RankingMode = "finalScore" | "dimension" | "manual";

export interface Ranking {
  id: EntityId;
  categoryId: EntityId;
  name: string;
  mode: RankingMode;
  dimensionId: EntityId | null;
  workIds: EntityId[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ExportSettings {
  workCoverTemplate: "default";
  workLongTemplate: "default";
  rankingTemplate: "default";
}

export interface Library {
  schemaVersion: SchemaVersion;
  categories: Category[];
  works: Work[];
  rankings: Ranking[];
  exportSettings: ExportSettings;
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  issues: ValidationIssue[];
}

export class LibraryValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "LibraryValidationError";
    this.issues = issues;
  }
}

export function createEmptyLibrary(): Library {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    categories: [],
    works: [],
    rankings: [],
    exportSettings: {
      workCoverTemplate: "default",
      workLongTemplate: "default",
      rankingTemplate: "default",
    },
  };
}
