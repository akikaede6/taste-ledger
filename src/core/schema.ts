import {
  CURRENT_SCHEMA_VERSION,
  type Category,
  type EntityId,
  type ExportSettings,
  type IsoDateString,
  type Library,
  LibraryValidationError,
  type Ranking,
  type RankingMode,
  type RatingDimensionScore,
  type RatingDimensionTemplate,
  type ValidationIssue,
  type ValidationResult,
  type Work,
} from "./model";

type JsonRecord = Record<string, unknown>;

const RANKING_MODES = new Set<RankingMode>([
  "finalScore",
  "dimension",
  "manual",
]);

export function validateLibrary(input: unknown): ValidationResult<Library> {
  const issues: ValidationIssue[] = [];
  const record = asRecord(input, "$", issues);

  if (!record) {
    return finish(null, issues);
  }

  const schemaVersion = readSchemaVersion(record, issues);
  const categories = readArray(record, "categories", issues).map(
    (item, index) => readCategory(item, `$.categories[${index}]`, issues),
  );
  const works = readArray(record, "works", issues).map((item, index) =>
    readWork(item, `$.works[${index}]`, issues),
  );
  const rankings = readArray(record, "rankings", issues).map((item, index) =>
    readRanking(item, `$.rankings[${index}]`, issues),
  );
  const exportSettings = readExportSettings(
    record.exportSettings,
    "$.exportSettings",
    issues,
  );

  const parsed: Library | null =
    schemaVersion === CURRENT_SCHEMA_VERSION &&
    categories.every(isDefined) &&
    works.every(isDefined) &&
    rankings.every(isDefined) &&
    exportSettings
      ? {
          schemaVersion,
          categories,
          works,
          rankings,
          exportSettings,
        }
      : null;

  if (parsed) {
    validateRelations(parsed, issues);
  }

  return finish(
    issues.some((issue) => issue.severity === "error") ? null : parsed,
    issues,
  );
}

export function assertValidLibrary(input: unknown): Library {
  const result = validateLibrary(input);

  if (!result.ok || !result.value) {
    throw new LibraryValidationError(result.issues);
  }

  return result.value;
}

function finish(
  value: Library | null,
  issues: ValidationIssue[],
): ValidationResult<Library> {
  return {
    ok: value !== null && !issues.some((issue) => issue.severity === "error"),
    value,
    issues,
  };
}

function readSchemaVersion(record: JsonRecord, issues: ValidationIssue[]) {
  if (record.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    issues.push({
      path: "$.schemaVersion",
      message: `Expected schema version ${CURRENT_SCHEMA_VERSION}.`,
      severity: "error",
    });
  }

  return record.schemaVersion === CURRENT_SCHEMA_VERSION
    ? CURRENT_SCHEMA_VERSION
    : null;
}

function readCategory(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): Category | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const ratingDimensionTemplates = readArray(
    record,
    "ratingDimensionTemplates",
    issues,
  )
    .map((item, index) =>
      readRatingDimensionTemplate(
        item,
        `${path}.ratingDimensionTemplates[${index}]`,
        issues,
      ),
    )
    .filter(isDefined);

  const category: Category = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    name: readRequiredString(record, "name", `${path}.name`, issues),
    createdAt: readDateString(record, "createdAt", `${path}.createdAt`, issues),
    updatedAt: readDateString(record, "updatedAt", `${path}.updatedAt`, issues),
    ratingDimensionTemplates,
  };

  if (category.name.trim().length === 0) {
    issues.push({
      path: `${path}.name`,
      message: "Category name cannot be empty.",
      severity: "error",
    });
  }

  return category;
}

function readWork(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): Work | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const ratingDimensions = readArray(record, "ratingDimensions", issues)
    .map((item, index) =>
      readRatingDimensionScore(
        item,
        `${path}.ratingDimensions[${index}]`,
        issues,
      ),
    )
    .filter(isDefined);

  const coverImagePath = readNullableString(
    record,
    "coverImagePath",
    `${path}.coverImagePath`,
    issues,
  );
  const work: Work = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    categoryId: readRequiredString(
      record,
      "categoryId",
      `${path}.categoryId`,
      issues,
    ),
    title: readRequiredString(record, "title", `${path}.title`, issues),
    coverImagePath,
    shortReview: readString(
      record,
      "shortReview",
      `${path}.shortReview`,
      issues,
    ),
    longReview: readString(record, "longReview", `${path}.longReview`, issues),
    ratingDimensions,
    finalScore: readNullableNumber(
      record,
      "finalScore",
      `${path}.finalScore`,
      issues,
    ),
    createdAt: readDateString(record, "createdAt", `${path}.createdAt`, issues),
    updatedAt: readDateString(record, "updatedAt", `${path}.updatedAt`, issues),
  };

  if (work.title.trim().length === 0) {
    issues.push({
      path: `${path}.title`,
      message: "Work title cannot be empty.",
      severity: "error",
    });
  }

  if (coverImagePath && !isPortableImagePath(coverImagePath)) {
    issues.push({
      path: `${path}.coverImagePath`,
      message: "Cover image path must be a relative path under images/.",
      severity: "error",
    });
  }

  return work;
}

function readRanking(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): Ranking | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const mode = readRankingMode(record, `${path}.mode`, issues);
  const ranking: Ranking = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    categoryId: readRequiredString(
      record,
      "categoryId",
      `${path}.categoryId`,
      issues,
    ),
    name: readRequiredString(record, "name", `${path}.name`, issues),
    mode,
    dimensionId: readNullableString(
      record,
      "dimensionId",
      `${path}.dimensionId`,
      issues,
    ),
    workIds: readStringArray(record, "workIds", `${path}.workIds`, issues),
    createdAt: readDateString(record, "createdAt", `${path}.createdAt`, issues),
    updatedAt: readDateString(record, "updatedAt", `${path}.updatedAt`, issues),
  };

  if (ranking.name.trim().length === 0) {
    issues.push({
      path: `${path}.name`,
      message: "Ranking name cannot be empty.",
      severity: "error",
    });
  }

  if (ranking.mode === "dimension" && !ranking.dimensionId) {
    issues.push({
      path: `${path}.dimensionId`,
      message: "Dimension rankings require a dimension id.",
      severity: "error",
    });
  }

  if (ranking.mode === "manual" && ranking.workIds.length === 0) {
    issues.push({
      path: `${path}.workIds`,
      message: "Manual rankings require at least one work id.",
      severity: "error",
    });
  }

  return ranking;
}

function readRatingDimensionTemplate(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): RatingDimensionTemplate | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const dimension: RatingDimensionTemplate = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    name: readRequiredString(record, "name", `${path}.name`, issues),
    weight: readPositiveNumber(record, "weight", `${path}.weight`, issues),
  };

  if (dimension.name.trim().length === 0) {
    issues.push({
      path: `${path}.name`,
      message: "Rating dimension name cannot be empty.",
      severity: "error",
    });
  }

  return dimension;
}

function readRatingDimensionScore(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): RatingDimensionScore | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const dimension: RatingDimensionScore = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    name: readRequiredString(record, "name", `${path}.name`, issues),
    score: readNonNegativeNumber(record, "score", `${path}.score`, issues),
    weight: readPositiveNumber(record, "weight", `${path}.weight`, issues),
  };

  if (dimension.name.trim().length === 0) {
    issues.push({
      path: `${path}.name`,
      message: "Rating dimension name cannot be empty.",
      severity: "error",
    });
  }

  return dimension;
}

function readExportSettings(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): ExportSettings | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const settings: ExportSettings = {
    workCoverTemplate: readTemplateName(
      record,
      "workCoverTemplate",
      `${path}.workCoverTemplate`,
      issues,
    ),
    workLongTemplate: readTemplateName(
      record,
      "workLongTemplate",
      `${path}.workLongTemplate`,
      issues,
    ),
    rankingTemplate: readTemplateName(
      record,
      "rankingTemplate",
      `${path}.rankingTemplate`,
      issues,
    ),
  };

  return settings.workCoverTemplate &&
    settings.workLongTemplate &&
    settings.rankingTemplate
    ? settings
    : null;
}

function validateRelations(library: Library, issues: ValidationIssue[]) {
  const categoryIds = new Set(
    library.categories.map((category) => category.id),
  );
  const workById = new Map(library.works.map((work) => [work.id, work]));

  validateUniqueIds(
    library.categories.map((category) => category.id),
    "$.categories",
    issues,
  );
  validateUniqueIds(
    library.works.map((work) => work.id),
    "$.works",
    issues,
  );
  validateUniqueIds(
    library.rankings.map((ranking) => ranking.id),
    "$.rankings",
    issues,
  );

  library.categories.forEach((category, categoryIndex) => {
    validateUniqueIds(
      category.ratingDimensionTemplates.map((dimension) => dimension.id),
      `$.categories[${categoryIndex}].ratingDimensionTemplates`,
      issues,
    );
  });

  library.works.forEach((work, workIndex) => {
    if (!categoryIds.has(work.categoryId)) {
      issues.push({
        path: `$.works[${workIndex}].categoryId`,
        message: "Work references a missing category.",
        severity: "error",
      });
    }

    validateUniqueIds(
      work.ratingDimensions.map((dimension) => dimension.id),
      `$.works[${workIndex}].ratingDimensions`,
      issues,
    );
  });

  library.rankings.forEach((ranking, rankingIndex) => {
    if (!categoryIds.has(ranking.categoryId)) {
      issues.push({
        path: `$.rankings[${rankingIndex}].categoryId`,
        message: "Ranking references a missing category.",
        severity: "error",
      });
    }

    validateUniqueIds(
      ranking.workIds,
      `$.rankings[${rankingIndex}].workIds`,
      issues,
    );

    ranking.workIds.forEach((workId, workIndex) => {
      const work = workById.get(workId);

      if (!work) {
        issues.push({
          path: `$.rankings[${rankingIndex}].workIds[${workIndex}]`,
          message: "Ranking references a missing work.",
          severity: "error",
        });
      } else if (work.categoryId !== ranking.categoryId) {
        issues.push({
          path: `$.rankings[${rankingIndex}].workIds[${workIndex}]`,
          message: "Ranking cannot include works from another category.",
          severity: "error",
        });
      }
    });
  });
}

function validateUniqueIds(
  ids: EntityId[],
  path: string,
  issues: ValidationIssue[],
) {
  const seen = new Set<EntityId>();

  ids.forEach((id, index) => {
    if (seen.has(id)) {
      issues.push({
        path: `${path}[${index}].id`,
        message: "Duplicate id.",
        severity: "error",
      });
    }

    seen.add(id);
  });
}

function asRecord(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): JsonRecord | null {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as JsonRecord;
  }

  issues.push({
    path,
    message: "Expected an object.",
    severity: "error",
  });
  return null;
}

function readArray(
  record: JsonRecord,
  key: string,
  issues: ValidationIssue[],
): unknown[] {
  const value = record[key];

  if (Array.isArray(value)) {
    return value;
  }

  issues.push({
    path: `$.${key}`,
    message: "Expected an array.",
    severity: "error",
  });
  return [];
}

function readStringArray(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    issues.push({
      path,
      message: "Expected an array of strings.",
      severity: "error",
    });
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item === "string" && item.trim().length > 0) {
      return [item];
    }

    issues.push({
      path: `${path}[${index}]`,
      message: "Expected a non-empty string.",
      severity: "error",
    });
    return [];
  });
}

function readRankingMode(
  record: JsonRecord,
  path: string,
  issues: ValidationIssue[],
): RankingMode {
  if (
    typeof record.mode === "string" &&
    RANKING_MODES.has(record.mode as RankingMode)
  ) {
    return record.mode as RankingMode;
  }

  issues.push({
    path,
    message: "Expected finalScore, dimension, or manual.",
    severity: "error",
  });
  return "finalScore";
}

function readRequiredString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string {
  const value = record[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  issues.push({
    path,
    message: "Expected a non-empty string.",
    severity: "error",
  });
  return "";
}

function readString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string {
  const value = record[key];

  if (typeof value === "string") {
    return value;
  }

  issues.push({
    path,
    message: "Expected a string.",
    severity: "error",
  });
  return "";
}

function readNullableString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  issues.push({
    path,
    message: "Expected a string or null.",
    severity: "error",
  });
  return null;
}

function readDateString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): IsoDateString {
  const value = readRequiredString(record, key, path, issues);

  if (value && Number.isNaN(Date.parse(value))) {
    issues.push({
      path,
      message: "Expected an ISO date string.",
      severity: "error",
    });
  }

  return value;
}

function readNullableNumber(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): number | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  issues.push({
    path,
    message: "Expected a finite number or null.",
    severity: "error",
  });
  return null;
}

function readPositiveNumber(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): number {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  issues.push({
    path,
    message: "Expected a positive number.",
    severity: "error",
  });
  return 0;
}

function readNonNegativeNumber(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): number {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  issues.push({
    path,
    message: "Expected a non-negative finite number.",
    severity: "error",
  });
  return 0;
}

function readTemplateName(
  record: JsonRecord,
  key: keyof ExportSettings,
  path: string,
  issues: ValidationIssue[],
): "default" {
  if (record[key] === "default") {
    return "default";
  }

  issues.push({
    path,
    message: "Expected default.",
    severity: "error",
  });
  return "default";
}

function isPortableImagePath(path: string): boolean {
  return (
    path.startsWith("images/") &&
    !path.includes("..") &&
    !path.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(path)
  );
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
