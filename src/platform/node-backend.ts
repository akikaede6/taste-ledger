import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { JsonFileBackend } from "../core/repository";

export interface NodeFileBackendOptions {
  rootDir: string;
}

export function createNodeFileBackend(
  options: NodeFileBackendOptions,
): JsonFileBackend {
  const rootDir = resolve(options.rootDir);

  return {
    async ensureDirectory(path) {
      await mkdir(resolvePath(rootDir, path), { recursive: true });
    },

    async readText(path) {
      try {
        return await readFile(resolvePath(rootDir, path), "utf8");
      } catch (error: unknown) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          return null;
        }
        throw error;
      }
    },

    async writeTextAtomic(path, content) {
      await writeAtomicFile(
        resolvePath(rootDir, path),
        Buffer.from(content, "utf8"),
      );
    },

    async readBytes(path) {
      try {
        return new Uint8Array(await readFile(resolvePath(rootDir, path)));
      } catch (error: unknown) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          return null;
        }
        throw error;
      }
    },

    async writeBytesAtomic(path, content) {
      await writeAtomicFile(resolvePath(rootDir, path), content);
    },

    async deletePath(path) {
      await rm(resolvePath(rootDir, path), { force: true, recursive: true });
    },

    async exists(path) {
      try {
        await access(resolvePath(rootDir, path));
        return true;
      } catch {
        return false;
      }
    },
  };
}

async function writeAtomicFile(path: string, content: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });

  const tempPath = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(tempPath, content);

  try {
    await rename(tempPath, path);
  } catch {
    await rm(path, { force: true });
    await rename(tempPath, path);
  }
}

function resolvePath(rootDir: string, relativePath: string): string {
  const resolved = resolve(rootDir, relativePath);

  if (resolved !== rootDir && !resolved.startsWith(`${rootDir}${sep}`)) {
    throw new Error(`Path escapes data root: ${relativePath}`);
  }

  return resolved;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string,
): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
