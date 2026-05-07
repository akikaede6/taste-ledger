import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_TIER_LEVELS,
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
  type TierLevel,
  type TierLevelId,
  type TierList,
  type ValidationIssue,
  type ValidationResult,
  type Work,
} from "./model";
import {
  getCategoryAncestorIds,
  getCategoryDescendantIds,
  getCategoryRootId,
} from "./category-tree";
import { recalculateWorkScore } from "./scoring";

type JsonRecord = Record<string, unknown>;

const RANKING_MODES = new Set<RankingMode>([
  "finalScore",
  "dimension",
  "manual",
]);
const TIER_LEVEL_IDS = new Set<TierLevelId>(
  DEFAULT_TIER_LEVELS.map((level) => level.id),
);

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
  const tierLists = readOptionalArray(record, "tierLists", issues).map(
    (item, index) => readTierList(item, `$.tierLists[${index}]`, issues),
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
    tierLists.every(isDefined) &&
    exportSettings
      ? normalizeLibraryRatingDimensions({
          schemaVersion,
          categories,
          works,
          rankings,
          tierLists,
          exportSettings,
        })
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
    parentCategoryId: readOptionalNullableString(
      record,
      "parentCategoryId",
      `${path}.parentCategoryId`,
      issues,
    ),
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
  const tags = readOptionalStringArray(record, "tags", `${path}.tags`, issues);
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
    tags,
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

function readTierList(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): TierList | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const levels = readArray(record, "levels", issues)
    .map((item, index) =>
      readTierLevel(item, `${path}.levels[${index}]`, issues),
    )
    .filter(isDefined);

  const tierList: TierList = {
    id: readRequiredString(record, "id", `${path}.id`, issues),
    categoryId: readRequiredString(
      record,
      "categoryId",
      `${path}.categoryId`,
      issues,
    ),
    name: readRequiredString(record, "name", `${path}.name`, issues),
    levels,
    createdAt: readDateString(record, "createdAt", `${path}.createdAt`, issues),
    updatedAt: readDateString(record, "updatedAt", `${path}.updatedAt`, issues),
  };

  if (tierList.name.trim().length === 0) {
    issues.push({
      path: `${path}.name`,
      message: "Tier list name cannot be empty.",
      severity: "error",
    });
  }

  return tierList;
}

function readTierLevel(
  input: unknown,
  path: string,
  issues: ValidationIssue[],
): TierLevel | null {
  const record = asRecord(input, path, issues);

  if (!record) {
    return null;
  }

  const id = readTierLevelId(record, `${path}.id`, issues);

  return {
    id,
    name: readRequiredString(record, "name", `${path}.name`, issues),
    workIds: readStringArray(record, "workIds", `${path}.workIds`, issues),
  };
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
  const categoryById = new Map(
    library.categories.map((category) => [category.id, category] as const),
  );

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
  validateUniqueIds(
    library.tierLists.map((tierList) => tierList.id),
    "$.tierLists",
    issues,
  );

  library.categories.forEach((category, categoryIndex) => {
    validateUniqueIds(
      category.ratingDimensionTemplates.map((dimension) => dimension.id),
      `$.categories[${categoryIndex}].ratingDimensionTemplates`,
      issues,
    );

    if (
      category.parentCategoryId !== null &&
      category.parentCategoryId !== undefined &&
      !categoryIds.has(category.parentCategoryId)
    ) {
      issues.push({
        path: `$.categories[${categoryIndex}].parentCategoryId`,
        message: "Category references a missing parent category.",
        severity: "error",
      });
    }

    if (
      category.parentCategoryId !== null &&
      getCategoryAncestorIds(library, category.id).includes(category.id)
    ) {
      issues.push({
        path: `$.categories[${categoryIndex}].parentCategoryId`,
        message: "Category parent chain cannot contain cycles.",
        severity: "error",
      });
    }

    if (
      category.parentCategoryId !== null &&
      category.ratingDimensionTemplates.length > 0
    ) {
      issues.push({
        path: `$.categories[${categoryIndex}].ratingDimensionTemplates`,
        message: "Only root categories may define shared rating dimensions.",
        severity: "error",
      });
    }
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

    const rootCategoryId = getCategoryRootId(library, work.categoryId);
    const category = rootCategoryId ? categoryById.get(rootCategoryId) : null;

    if (category) {
      const categoryDimensionIds = category.ratingDimensionTemplates.map(
        (dimension) => dimension.id,
      );
      const workDimensionIds = work.ratingDimensions.map(
        (dimension) => dimension.id,
      );

      if (!sameStringList(categoryDimensionIds, workDimensionIds)) {
        issues.push({
          path: `$.works[${workIndex}].ratingDimensions`,
          message: "Work rating dimensions must match its category.",
          severity: "error",
        });
      }
    }
  });

  library.rankings.forEach((ranking, rankingIndex) => {
    if (!categoryIds.has(ranking.categoryId)) {
      issues.push({
        path: `$.rankings[${rankingIndex}].categoryId`,
        message: "Ranking references a missing category.",
        severity: "error",
      });
    }

    const rankingCategory = categoryById.get(ranking.categoryId);

    if (rankingCategory && rankingCategory.parentCategoryId !== null) {
      issues.push({
        path: `$.rankings[${rankingIndex}].categoryId`,
        message: "Rankings may only be attached to root categories.",
        severity: "error",
      });
    }

    validateUniqueIds(
      ranking.workIds,
      `$.rankings[${rankingIndex}].workIds`,
      issues,
    );

    if (ranking.mode === "dimension" && ranking.dimensionId) {
      const category = categoryById.get(ranking.categoryId);

      if (
        category &&
        !category.ratingDimensionTemplates.some(
          (dimension) => dimension.id === ranking.dimensionId,
        )
      ) {
        issues.push({
          path: `$.rankings[${rankingIndex}].dimensionId`,
          message: "Ranking dimension must belong to its category.",
          severity: "error",
        });
      }
    }

    ranking.workIds.forEach((workId, workIndex) => {
      const work = workById.get(workId);

      if (!work) {
        issues.push({
          path: `$.rankings[${rankingIndex}].workIds[${workIndex}]`,
          message: "Ranking references a missing work.",
          severity: "error",
        });
      } else if (
        !isCategoryInScope(library, ranking.categoryId, work.categoryId)
      ) {
        issues.push({
          path: `$.rankings[${rankingIndex}].workIds[${workIndex}]`,
          message: "Ranking cannot include works outside its category tree.",
          severity: "error",
        });
      }
    });
  });

  library.tierLists.forEach((tierList, tierListIndex) => {
    if (!categoryIds.has(tierList.categoryId)) {
      issues.push({
        path: `$.tierLists[${tierListIndex}].categoryId`,
        message: "Tier list references a missing category.",
        severity: "error",
      });
    }

    const tierListCategory = categoryById.get(tierList.categoryId);

    if (tierListCategory && tierListCategory.parentCategoryId !== null) {
      issues.push({
        path: `$.tierLists[${tierListIndex}].categoryId`,
        message: "Tier lists may only be attached to root categories.",
        severity: "error",
      });
    }

    const expectedLevelIds = DEFAULT_TIER_LEVELS.map((level) => level.id);
    const levelIds = tierList.levels.map((level) => level.id);

    if (!sameStringList(levelIds, expectedLevelIds)) {
      issues.push({
        path: `$.tierLists[${tierListIndex}].levels`,
        message: "Tier list must include the five default levels.",
        severity: "error",
      });
    }

    const seenTierWorkIds = new Set<string>();

    tierList.levels.forEach((level, levelIndex) => {
      validateUniqueIds(
        level.workIds,
        `$.tierLists[${tierListIndex}].levels[${levelIndex}].workIds`,
        issues,
      );

      level.workIds.forEach((workId, workIndex) => {
        if (seenTierWorkIds.has(workId)) {
          issues.push({
            path: `$.tierLists[${tierListIndex}].levels[${levelIndex}].workIds[${workIndex}]`,
            message: "Tier list cannot include a work more than once.",
            severity: "error",
          });
        }

        seenTierWorkIds.add(workId);

        const work = workById.get(workId);

        if (!work) {
          issues.push({
            path: `$.tierLists[${tierListIndex}].levels[${levelIndex}].workIds[${workIndex}]`,
            message: "Tier list references a missing work.",
            severity: "error",
          });
        } else if (
          !isCategoryInScope(library, tierList.categoryId, work.categoryId)
        ) {
          issues.push({
            path: `$.tierLists[${tierListIndex}].levels[${levelIndex}].workIds[${workIndex}]`,
            message:
              "Tier list cannot include works outside its category tree.",
            severity: "error",
          });
        }
      });
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

function readOptionalArray(
  record: JsonRecord,
  key: string,
  issues: ValidationIssue[],
): unknown[] {
  if (!(key in record)) {
    return [];
  }

  return readArray(record, key, issues);
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
    if (typeof item === "string") {
      return [item];
    }

    issues.push({
      path: `${path}[${index}]`,
      message: "Expected a string.",
      severity: "error",
    });
    return [];
  });
}

function readOptionalStringArray(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string[] {
  if (!(key in record)) {
    return [];
  }

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
    if (typeof item === "string") {
      return [item];
    }

    issues.push({
      path: `${path}[${index}]`,
      message: "Expected a string.",
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

function readTierLevelId(
  record: JsonRecord,
  path: string,
  issues: ValidationIssue[],
): TierLevelId {
  if (
    typeof record.id === "string" &&
    TIER_LEVEL_IDS.has(record.id as TierLevelId)
  ) {
    return record.id as TierLevelId;
  }

  issues.push({
    path,
    message: "Expected tier-1, tier-2, tier-3, tier-4, or tier-5.",
    severity: "error",
  });
  return "tier-1";
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

function readOptionalNullableString(
  record: JsonRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string | null {
  if (!(key in record)) {
    return null;
  }

  return readNullableString(record, key, path, issues);
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

function normalizeLibraryRatingDimensions(library: Library): Library {
  const next = structuredClone(library);

  next.categories = next.categories.map((category) => {
    if (category.parentCategoryId !== null) {
      return category;
    }

    if (category.ratingDimensionTemplates.length > 0) {
      return category;
    }

    const templates: RatingDimensionTemplate[] = [];
    const seenIds = new Set<string>();
    const categoryScopeIds = new Set(
      getCategoryDescendantIds(next, category.id),
    );

    next.works
      .filter((work) => categoryScopeIds.has(work.categoryId))
      .forEach((work) => {
        work.ratingDimensions.forEach((dimension) => {
          if (!seenIds.has(dimension.id)) {
            seenIds.add(dimension.id);
            templates.push({
              id: dimension.id,
              name: dimension.name,
              weight: dimension.weight,
            });
          }
        });
      });

    return {
      ...category,
      ratingDimensionTemplates: templates,
    };
  });

  const categoryById = new Map(
    next.categories.map((category) => [category.id, category] as const),
  );

  next.works = next.works.map((work) => {
    const rootCategoryId = getCategoryRootId(next, work.categoryId);
    const category = rootCategoryId
      ? categoryById.get(rootCategoryId)
      : undefined;

    if (!category) {
      return work;
    }

    const scoreById = new Map(
      work.ratingDimensions.map(
        (dimension) => [dimension.id, dimension.score] as const,
      ),
    );

    return recalculateWorkScore({
      ...work,
      ratingDimensions: category.ratingDimensionTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        score: scoreById.get(template.id) ?? 0,
        weight: template.weight,
      })),
    });
  });

  next.tierLists = next.tierLists.map((tierList) => ({
    ...tierList,
    levels: DEFAULT_TIER_LEVELS.map((definition) => {
      const level = tierList.levels.find((item) => item.id === definition.id);
      return {
        id: definition.id,
        name: level?.name || definition.name,
        workIds: level?.workIds ?? [],
      };
    }),
  }));

  return next;
}

function isCategoryInScope(
  library: Library,
  scopeCategoryId: string,
  categoryId: string,
): boolean {
  return (
    scopeCategoryId === categoryId ||
    getCategoryAncestorIds(library, categoryId).includes(scopeCategoryId)
  );
}

function sameStringList(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}
