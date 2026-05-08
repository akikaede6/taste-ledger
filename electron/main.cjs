const {
  app,
  BrowserWindow,
  clipboard,
  Menu,
  dialog,
  ipcMain,
  nativeImage,
} = require("electron");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const isDev = process.env.VITE_DEV_SERVER_URL;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

let currentDataRoot = null;

ipcMain.handle("taste-ledger-shell:choose-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle("taste-ledger-shell:get-storage-directory", async () => {
  return getDataRoot();
});

ipcMain.handle("taste-ledger-shell:choose-storage-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled) {
    return null;
  }

  const selectedRoot = result.filePaths[0]
    ? path.resolve(result.filePaths[0])
    : null;

  if (!selectedRoot) {
    return null;
  }

  currentDataRoot = resolveTasteLedgerRoot(selectedRoot);
  await fs.mkdir(currentDataRoot, { recursive: true });
  await writeStorageConfig(currentDataRoot);

  return currentDataRoot;
});

ipcMain.handle(
  "taste-ledger-shell:write-file",
  async (_event, { directory, fileName, bytes }) => {
    const targetPath = path.join(directory, sanitizeFileName(fileName));

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(targetPath, Buffer.from(bytes));

    return targetPath;
  },
);

ipcMain.handle("taste-ledger-shell:copy-image", async (_event, bytes) => {
  clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(bytes)));
});

ipcMain.handle(
  "taste-ledger-storage:ensure-directory",
  async (_event, relativePath) => {
    await fs.mkdir(resolveDataPath(relativePath), { recursive: true });
  },
);

ipcMain.handle(
  "taste-ledger-storage:read-text",
  async (_event, relativePath) => {
    try {
      return await fs.readFile(resolveDataPath(relativePath), "utf8");
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }

      throw error;
    }
  },
);

ipcMain.handle(
  "taste-ledger-storage:write-text-atomic",
  async (_event, relativePath, content) => {
    await writeAtomicText(resolveDataPath(relativePath), content);
  },
);

ipcMain.handle(
  "taste-ledger-storage:read-bytes",
  async (_event, relativePath) => {
    try {
      const bytes = await fs.readFile(resolveDataPath(relativePath));
      return Array.from(bytes);
    } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
        return null;
      }

      throw error;
    }
  },
);

ipcMain.handle(
  "taste-ledger-storage:write-bytes-atomic",
  async (_event, relativePath, content) => {
    await writeAtomicBytes(
      resolveDataPath(relativePath),
      new Uint8Array(content),
    );
  },
);

ipcMain.handle(
  "taste-ledger-storage:delete-path",
  async (_event, relativePath) => {
    const resolvedPath = resolveDataPath(relativePath);

    try {
      await fs.rm(resolvedPath, { force: true, recursive: true });
    } catch (error) {
      if (!isNodeErrorWithCode(error, "ENOENT")) {
        throw error;
      }
    }
  },
);

ipcMain.handle("taste-ledger-storage:exists", async (_event, relativePath) => {
  try {
    await fs.access(resolveDataPath(relativePath));
    return true;
  } catch {
    return false;
  }
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Taste Ledger",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(isDev);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await initializeDataRoot();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function resolveDataPath(relativePath) {
  const root = getDataRoot();
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes data root: ${relativePath}`);
  }

  return resolved;
}

async function initializeDataRoot() {
  currentDataRoot = await readStorageConfig();
  await fs.mkdir(currentDataRoot, { recursive: true });
}

function getDataRoot() {
  if (!currentDataRoot) {
    currentDataRoot = getDefaultDataRoot();
  }

  return currentDataRoot;
}

function getDefaultDataRoot() {
  return path.join(app.getPath("documents"), "Taste-ledger");
}

function getStorageConfigPath() {
  return path.join(app.getPath("userData"), "taste-ledger-storage.json");
}

async function readStorageConfig() {
  try {
    const raw = await fs.readFile(getStorageConfigPath(), "utf8");
    const parsed = JSON.parse(raw);

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.dataRoot === "string" &&
      parsed.dataRoot.trim().length > 0
    ) {
      return path.resolve(parsed.dataRoot);
    }
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      return getDefaultDataRoot();
    }
  }

  return getDefaultDataRoot();
}

async function writeStorageConfig(dataRoot) {
  const configPath = getStorageConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    `${JSON.stringify({ dataRoot }, null, 2)}\n`,
    "utf8",
  );
}

function resolveTasteLedgerRoot(baseDirectory) {
  const resolved = path.resolve(baseDirectory);

  if (path.basename(resolved) === "Taste-ledger") {
    return resolved;
  }

  return path.join(resolved, "Taste-ledger");
}

async function writeAtomicText(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(path.dirname(targetPath), `.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, content, "utf8");
  await renameWithOverwrite(tempPath, targetPath);
}

async function writeAtomicBytes(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(path.dirname(targetPath), `.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, Buffer.from(content));
  await renameWithOverwrite(tempPath, targetPath);
}

function isNodeErrorWithCode(error, code) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function sanitizeFileName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

async function renameWithOverwrite(from, to) {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      throw error;
    }

    try {
      await fs.rm(to, { force: true });
    } catch (removeError) {
      if (!isNodeErrorWithCode(removeError, "ENOENT")) {
        throw error;
      }
    }

    await fs.rename(from, to);
  }
}
