const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rankingDesktop", {
  platform: "electron",
});

contextBridge.exposeInMainWorld("rankingNative", {
  storage: {
    ensureDirectory(path) {
      return ipcRenderer.invoke("ranking-storage:ensure-directory", path);
    },

    readText(path) {
      return ipcRenderer.invoke("ranking-storage:read-text", path);
    },

    writeTextAtomic(path, content) {
      return ipcRenderer.invoke(
        "ranking-storage:write-text-atomic",
        path,
        content,
      );
    },

    async readBytes(path) {
      const bytes = await ipcRenderer.invoke(
        "ranking-storage:read-bytes",
        path,
      );
      return bytes === null ? null : new Uint8Array(bytes);
    },

    writeBytesAtomic(path, content) {
      return ipcRenderer.invoke(
        "ranking-storage:write-bytes-atomic",
        path,
        Array.from(content),
      );
    },

    deletePath(path) {
      return ipcRenderer.invoke("ranking-storage:delete-path", path);
    },

    exists(path) {
      return ipcRenderer.invoke("ranking-storage:exists", path);
    },
  },
});
