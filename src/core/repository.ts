import {
  createEmptyLibrary,
  type Library,
  type ValidationIssue,
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
  libraryPath?: string;
  imagesDir?: string;
  exportsDir?: string;
}

const DEFAULT_LIBRARY_PATH = "library.json";
const DEFAULT_IMAGES_DIR = "images";
const DEFAULT_EXPORTS_DIR = "exports";

export function createLibraryRepository(
  backend: JsonFileBackend,
  options: LibraryRepositoryOptions = {},
): LibraryRepository {
  const libraryPath = options.libraryPath ?? DEFAULT_LIBRARY_PATH;
  const imagesDir = options.imagesDir ?? DEFAULT_IMAGES_DIR;
  const exportsDir = options.exportsDir ?? DEFAULT_EXPORTS_DIR;

  return {
    async load() {
      const raw = await backend.readText(libraryPath);

      if (raw === null) {
        return {
          status: "missing",
          library: createEmptyLibrary(),
          issues: [],
        };
      }

      let parsedUnknown: unknown;

      try {
        parsedUnknown = JSON.parse(raw);
      } catch (error) {
        throw new LibraryRepositoryError("Invalid JSON in library file.", {
          cause: error,
          path: libraryPath,
        });
      }

      const library = assertValidLibrary(parsedUnknown);

      return {
        status: "loaded",
        library,
        issues: [],
      };
    },

    async save(library) {
      const validated = assertValidLibrary(library);
      const content = `${JSON.stringify(validated, null, 2)}\n`;

      await backend.ensureDirectory(imagesDir);
      await backend.ensureDirectory(exportsDir);
      await backend.writeTextAtomic(libraryPath, content);
    },

    async ensureStructure() {
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
