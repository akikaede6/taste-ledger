import {
  createEmptyLibrary,
  type Category,
  CURRENT_SCHEMA_VERSION,
  type ExportSettings,
  type Library,
  type Ranking,
  type TierList,
  type ValidationIssue,
  type Work,
} from "./model";
import { assertValidLibrary } from "./schema";

export interface JsonFileBackend {
  ensureDirectory(path: string): Promise<void>;
  readText(path: string): Promise<string | null>;
  writeTextAtomic(path: string, content: string): Promise<void>;
  readBytes(path: string): Promise<Uint8Array | null>;
  writeBytesAtomic(path: string, content: Uint8Array): Promise<void>;
  deletePath(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface LoadLibraryResult {
  status: "missing" | "loaded";
  library: Library;
  issues: ValidationIssue[];
}

export interface StoredImage {
  id: string;
  extension: string;
  bytes: Uint8Array;
}

export interface StoredExport {
  kind: "works" | "rankings" | "tiers";
  id: string;
  extension: string;
  bytes: Uint8Array;
}

export interface LibraryRepository {
  load(): Promise<LoadLibraryResult>;
  save(library: Library): Promise<void>;
  ensureStructure(): Promise<void>;
  readImage(relativePath: string): Promise<Uint8Array | null>;
  storeImage(image: StoredImage): Promise<string>;
  storeExport(exportFile: StoredExport): Promise<string>;
  removeImage(relativePath: string): Promise<void>;
}

export interface LibraryRepositoryOptions {
  manifestPath?: string;
  categoriesDir?: string;
  imagesDir?: string;
  exportsDir?: string;
}

const DEFAULT_MANIFEST_PATH = "library-manifest.json";
const DEFAULT_CATEGORIES_DIR = "categories";
const DEFAULT_IMAGES_DIR = "images";
const DEFAULT_EXPORTS_DIR = "exports";

export function createLibraryRepository(
  backend: JsonFileBackend,
  options: LibraryRepositoryOptions = {},
): LibraryRepository {
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH;
  const categoriesDir = options.categoriesDir ?? DEFAULT_CATEGORIES_DIR;
  const imagesDir = options.imagesDir ?? DEFAULT_IMAGES_DIR;
  const exportsDir = options.exportsDir ?? DEFAULT_EXPORTS_DIR;

  return {
    async load() {
      const rawManifest = await backend.readText(manifestPath);

      if (rawManifest === null) {
        return {
          status: "missing",
          library: createEmptyLibrary(),
          issues: [],
        };
      }

      const manifest = readLibraryManifest(rawManifest, manifestPath);
      const categories: Category[] = [];
      const works: Work[] = [];
      const rankings: Ranking[] = [];
      const tierLists: TierList[] = [];

      for (const rootCategoryId of manifest.rootCategoryIds) {
        const shardPath = getCategoryShardPath(categoriesDir, rootCategoryId);
        const rawShard = await backend.readText(shardPath);

        if (rawShard === null) {
          throw new LibraryRepositoryError("Missing category shard file.", {
            path: shardPath,
          });
        }

        const shard = readCategoryShard(rawShard, shardPath);
        categories.push(shard.category, ...shard.childCategories);
        works.push(...shard.works);
        rankings.push(...shard.rankings);
        tierLists.push(...shard.tierLists);
      }

      const library = assertValidLibrary({
        schemaVersion: manifest.schemaVersion,
        categories,
        works,
        rankings,
        tierLists,
        exportSettings: manifest.exportSettings,
      });

      return {
        status: "loaded",
        library,
        issues: [],
      };
    },

    async save(library) {
      const validated = assertValidLibrary(library);
      const rootCategories = validated.categories.filter(
        (category) => category.parentCategoryId === null,
      );
      const rootCategoryIds = rootCategories.map((category) => category.id);
      const previousManifest = await readLibraryManifestIfExists(
        backend,
        manifestPath,
      );
      const previousRootCategoryIds = new Set(
        previousManifest?.rootCategoryIds ?? [],
      );

      await backend.ensureDirectory(categoriesDir);
      await backend.ensureDirectory(imagesDir);
      await backend.ensureDirectory(exportsDir);

      for (const rootCategory of rootCategories) {
        const shardPath = getCategoryShardPath(categoriesDir, rootCategory.id);
        const shard = buildCategoryShard(validated, rootCategory.id);
        await backend.writeTextAtomic(
          shardPath,
          `${JSON.stringify(shard, null, 2)}\n`,
        );
        previousRootCategoryIds.delete(rootCategory.id);
      }

      for (const removedRootCategoryId of previousRootCategoryIds) {
        await backend.deletePath(
          getCategoryShardPath(categoriesDir, removedRootCategoryId),
        );
      }

      await backend.writeTextAtomic(
        manifestPath,
        `${JSON.stringify(
          {
            schemaVersion: validated.schemaVersion,
            exportSettings: validated.exportSettings,
            rootCategoryIds,
          },
          null,
          2,
        )}\n`,
      );
    },

    async ensureStructure() {
      await backend.ensureDirectory(categoriesDir);
      await backend.ensureDirectory(imagesDir);
      await backend.ensureDirectory(exportsDir);
    },

    async readImage(relativePath: string) {
      if (!relativePath.startsWith(`${imagesDir}/`)) {
        return null;
      }

      return backend.readBytes(relativePath);
    },

    async storeImage(image) {
      const relativePath = joinDataPath(
        imagesDir,
        `${sanitizePathSegment(image.id)}.${sanitizeExtension(image.extension)}`,
      );

      await backend.ensureDirectory(imagesDir);
      await backend.writeBytesAtomic(relativePath, image.bytes);

      return relativePath;
    },

    async storeExport(exportFile) {
      const relativePath = joinDataPath(
        exportsDir,
        sanitizePathSegment(exportFile.kind),
        `${sanitizePathSegment(exportFile.id)}.${sanitizeExtension(exportFile.extension)}`,
      );

      await backend.ensureDirectory(
        joinDataPath(exportsDir, sanitizePathSegment(exportFile.kind)),
      );
      await backend.writeBytesAtomic(relativePath, exportFile.bytes);

      return relativePath;
    },

    async removeImage(relativePath: string) {
      if (!relativePath.startsWith(`${imagesDir}/`)) {
        return;
      }

      if (await backend.exists(relativePath)) {
        await backend.deletePath(relativePath);
      }
    },
  };
}

export class LibraryRepositoryError extends Error {
  readonly path: string;

  constructor(message: string, options: { cause?: unknown; path: string }) {
    super(message, { cause: options.cause });
    this.name = "LibraryRepositoryError";
    this.path = options.path;
  }
}

export function joinDataPath(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.split("/"))
    .filter((segment) => segment.length > 0)
    .join("/");
}

export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function sanitizeExtension(extension: string): string {
  const value = extension.replace(/^\./, "").toLowerCase();
  return value.length > 0 ? value : "png";
}

interface LibraryManifest {
  schemaVersion: number;
  exportSettings: ExportSettings;
  rootCategoryIds: string[];
}

interface CategoryShard {
  category: Category;
  childCategories: Category[];
  works: Work[];
  rankings: Ranking[];
  tierLists: TierList[];
}

function readLibraryManifest(raw: string, path: string): LibraryManifest {
  const record = readJsonRecord(raw, path);
  const schemaVersion = readRequiredNumberField(
    record,
    "schemaVersion",
    `${path}.schemaVersion`,
  );

  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new LibraryRepositoryError("Unsupported manifest version.", {
      path: `${path}.schemaVersion`,
    });
  }

  const exportSettingsRecord = readRequiredRecordField(
    record,
    "exportSettings",
    `${path}.exportSettings`,
  );
  const rootCategoryIds = readRequiredStringArrayField(
    record,
    "rootCategoryIds",
    `${path}.rootCategoryIds`,
  );

  return {
    schemaVersion,
    exportSettings: {
      workCoverTemplate: readDefaultTemplateName(
        exportSettingsRecord,
        "workCoverTemplate",
        `${path}.exportSettings.workCoverTemplate`,
      ),
      workLongTemplate: readDefaultTemplateName(
        exportSettingsRecord,
        "workLongTemplate",
        `${path}.exportSettings.workLongTemplate`,
      ),
      rankingTemplate: readDefaultTemplateName(
        exportSettingsRecord,
        "rankingTemplate",
        `${path}.exportSettings.rankingTemplate`,
      ),
    },
    rootCategoryIds,
  };
}

async function readLibraryManifestIfExists(
  backend: JsonFileBackend,
  path: string,
): Promise<LibraryManifest | null> {
  const raw = await backend.readText(path);
  return raw === null ? null : readLibraryManifest(raw, path);
}

function readCategoryShard(raw: string, path: string): CategoryShard {
  const record = readJsonRecord(raw, path);
  const category = readRequiredRecordField(
    record,
    "category",
    `${path}.category`,
  );
  const childCategories = readRequiredRecordArrayField(
    record,
    "childCategories",
    `${path}.childCategories`,
  ) as Category[];
  const works = readRequiredRecordArrayField(
    record,
    "works",
    `${path}.works`,
  ) as Work[];
  const rankings = readRequiredRecordArrayField(
    record,
    "rankings",
    `${path}.rankings`,
  ) as Ranking[];
  const tierLists = readRequiredRecordArrayField(
    record,
    "tierLists",
    `${path}.tierLists`,
  ) as TierList[];

  return {
    category: category as unknown as Category,
    childCategories,
    works,
    rankings,
    tierLists,
  };
}

function buildCategoryShard(
  library: Library,
  rootCategoryId: string,
): CategoryShard {
  const rootCategory = library.categories.find(
    (category) => category.id === rootCategoryId,
  );

  if (!rootCategory) {
    throw new Error("Root category not found.");
  }

  const childCategories = library.categories.filter(
    (category) => category.parentCategoryId === rootCategory.id,
  );
  const categoryIds = new Set([
    rootCategory.id,
    ...childCategories.map((category) => category.id),
  ]);

  return {
    category: rootCategory,
    childCategories,
    works: library.works.filter((work) => categoryIds.has(work.categoryId)),
    rankings: library.rankings.filter(
      (ranking) => ranking.categoryId === rootCategory.id,
    ),
    tierLists: library.tierLists.filter(
      (tierList) => tierList.categoryId === rootCategory.id,
    ),
  };
}

function getCategoryShardPath(
  categoriesDir: string,
  categoryId: string,
): string {
  return joinDataPath(categoriesDir, `${sanitizePathSegment(categoryId)}.json`);
}

function readJsonRecord(raw: string, path: string): Record<string, unknown> {
  let parsedUnknown: unknown;

  try {
    parsedUnknown = JSON.parse(raw);
  } catch (error) {
    throw new LibraryRepositoryError("Invalid JSON file.", {
      cause: error,
      path,
    });
  }

  if (
    typeof parsedUnknown === "object" &&
    parsedUnknown !== null &&
    !Array.isArray(parsedUnknown)
  ) {
    return parsedUnknown as Record<string, unknown>;
  }

  throw new LibraryRepositoryError("Expected an object.", { path });
}

function readRequiredRecordField(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  const value = record[key];

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new LibraryRepositoryError("Expected an object.", { path });
}

function readRequiredRecordArrayField(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown[] {
  const value = record[key];

  if (Array.isArray(value)) {
    return value;
  }

  throw new LibraryRepositoryError("Expected an array.", { path });
}

function readRequiredStringArrayField(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const value = readRequiredRecordArrayField(record, key, path);

  if (value.every((item) => typeof item === "string")) {
    return value as string[];
  }

  throw new LibraryRepositoryError("Expected an array of strings.", { path });
}

function readRequiredNumberField(
  record: Record<string, unknown>,
  key: string,
  path: string,
): number {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new LibraryRepositoryError("Expected a number.", { path });
}

function readDefaultTemplateName(
  record: Record<string, unknown>,
  key: string,
  path: string,
): "default" {
  if (record[key] === "default") {
    return "default";
  }

  throw new LibraryRepositoryError("Expected default.", { path });
}
