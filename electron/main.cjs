const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const isDev = process.env.VITE_DEV_SERVER_URL;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

const dataRoot = () =>
  path.join(app.getPath("documents"), "Ranking", "ranking-data");

ipcMain.handle(
  "ranking-storage:ensure-directory",
  async (_event, relativePath) => {
    await fs.mkdir(resolveDataPath(relativePath), { recursive: true });
  },
);

ipcMain.handle("ranking-storage:read-text", async (_event, relativePath) => {
  try {
    return await fs.readFile(resolveDataPath(relativePath), "utf8");
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
});

ipcMain.handle(
  "ranking-storage:write-text-atomic",
  async (_event, relativePath, content) => {
    await writeAtomicText(resolveDataPath(relativePath), content);
  },
);

ipcMain.handle("ranking-storage:read-bytes", async (_event, relativePath) => {
  try {
    const bytes = await fs.readFile(resolveDataPath(relativePath));
    return Array.from(bytes);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
});

ipcMain.handle(
  "ranking-storage:write-bytes-atomic",
  async (_event, relativePath, content) => {
    await writeAtomicBytes(
      resolveDataPath(relativePath),
      new Uint8Array(content),
    );
  },
);

ipcMain.handle("ranking-storage:delete-path", async (_event, relativePath) => {
  const resolvedPath = resolveDataPath(relativePath);

  try {
    await fs.rm(resolvedPath, { force: true, recursive: true });
  } catch (error) {
    if (!isNodeErrorWithCode(error, "ENOENT")) {
      throw error;
    }
  }
});

ipcMain.handle("ranking-storage:exists", async (_event, relativePath) => {
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
    title: "Ranking",
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

app.whenReady().then(() => {
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
  const root = dataRoot();
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes data root: ${relativePath}`);
  }

  return resolved;
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
