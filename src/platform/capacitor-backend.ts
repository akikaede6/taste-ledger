import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { JsonFileBackend } from "../core/repository";
import { joinDataPath } from "../core/repository";

const DATA_ROOT = "ranking-data";

export function createCapacitorFilesystemBackend(): JsonFileBackend {
  let initialization: Promise<void> | null = null;

  async function ensureInitialized() {
    if (!initialization) {
      initialization = initializeBackend();
    }

    try {
      await initialization;
    } catch (error) {
      initialization = null;
      throw error;
    }
  }

  return {
    async ensureDirectory(path) {
      await ensureInitialized();
      const relativePath = resolveDataPath(path);

      await mkdirAllowExisting(relativePath);
    },

    async readText(path) {
      await ensureInitialized();

      try {
        const result = await Filesystem.readFile({
          path: resolveDataPath(path),
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });

        return typeof result.data === "string" ? result.data : null;
      } catch (error) {
        if (isMissingFileError(error)) {
          return null;
        }

        throw error;
      }
    },

    async writeTextAtomic(path, content) {
      await ensureInitialized();
      await writeAtomicText(resolveDataPath(path), content);
    },

    async readBytes(path) {
      await ensureInitialized();

      try {
        const result = await Filesystem.readFile({
          path: resolveDataPath(path),
          directory: Directory.Documents,
        });

        return typeof result.data === "string"
          ? base64ToBytes(result.data)
          : new Uint8Array(await result.data.arrayBuffer());
      } catch (error) {
        if (isMissingFileError(error)) {
          return null;
        }

        throw error;
      }
    },

    async writeBytesAtomic(path, content) {
      await ensureInitialized();
      await writeAtomicBytes(resolveDataPath(path), content);
    },

    async deletePath(path) {
      await ensureInitialized();
      const resolvedPath = resolveDataPath(path);

      try {
        await Filesystem.deleteFile({
          path: resolvedPath,
          directory: Directory.Documents,
        });
        return;
      } catch (deleteError) {
        if (isMissingFileError(deleteError)) {
          return;
        }

        try {
          await Filesystem.rmdir({
            path: resolvedPath,
            directory: Directory.Documents,
            recursive: true,
          });
        } catch (removeError) {
          if (!isMissingFileError(removeError)) {
            throw deleteError;
          }
        }
      }
    },

    async exists(path) {
      await ensureInitialized();

      try {
        await Filesystem.stat({
          path: resolveDataPath(path),
          directory: Directory.Documents,
        });
        return true;
      } catch (error) {
        if (isMissingFileError(error)) {
          return false;
        }

        throw error;
      }
    },
  };
}

async function initializeBackend() {
  if (Capacitor.getPlatform() === "android") {
    await ensureAndroidStoragePermission();
  }

  await mkdirAllowExisting(DATA_ROOT);
}

async function ensureAndroidStoragePermission() {
  const current = await Filesystem.checkPermissions();

  if (current.publicStorage === "granted") {
    return;
  }

  const requested = await Filesystem.requestPermissions();

  if (requested.publicStorage !== "granted") {
    throw new Error("Android storage permission denied.");
  }
}

async function writeAtomicText(path: string, content: string) {
  const tempPath = createTempSiblingPath(path);

  await Filesystem.writeFile({
    path: tempPath,
    directory: Directory.Documents,
    data: content,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  await renameWithOverwrite(tempPath, path);
}

async function writeAtomicBytes(path: string, content: Uint8Array) {
  const tempPath = createTempSiblingPath(path);

  await Filesystem.writeFile({
    path: tempPath,
    directory: Directory.Documents,
    data: bytesToBase64(content),
    recursive: true,
  });

  await renameWithOverwrite(tempPath, path);
}

function resolveDataPath(path: string): string {
  return joinDataPath(DATA_ROOT, path);
}

function createTempSiblingPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  const directory = slashIndex >= 0 ? path.slice(0, slashIndex) : "";
  const tempFile = `.${crypto.randomUUID()}.tmp`;

  return directory ? joinDataPath(directory, tempFile) : tempFile;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "OS-PLUG-FILE-0008"
  );
}

function isDirectoryAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "OS-PLUG-FILE-0010"
  );
}

async function mkdirAllowExisting(path: string) {
  try {
    await Filesystem.mkdir({
      path,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (error) {
    if (!isDirectoryAlreadyExistsError(error)) {
      throw error;
    }
  }
}

async function renameWithOverwrite(from: string, to: string) {
  try {
    await Filesystem.rename({
      from,
      to,
      directory: Directory.Documents,
    });
  } catch (error) {
    if (isMissingFileError(error)) {
      throw error;
    }

    try {
      await Filesystem.deleteFile({
        path: to,
        directory: Directory.Documents,
      });
    } catch (deleteError) {
      if (!isMissingFileError(deleteError)) {
        throw error;
      }
    }

    await Filesystem.rename({
      from,
      to,
      directory: Directory.Documents,
    });
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
