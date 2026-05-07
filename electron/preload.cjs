const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tasteLedgerDesktop", {
  platform: "electron",
  chooseDirectory() {
    return ipcRenderer.invoke("taste-ledger-shell:choose-directory");
  },
  chooseStorageDirectory() {
    return ipcRenderer.invoke("taste-ledger-shell:choose-storage-directory");
  },
  getStorageDirectory() {
    return ipcRenderer.invoke("taste-ledger-shell:get-storage-directory");
  },
  writeFile(options) {
    return ipcRenderer.invoke("taste-ledger-shell:write-file", {
      ...options,
      bytes: Array.from(options.bytes),
    });
  },
  copyImage(bytes) {
    return ipcRenderer.invoke(
      "taste-ledger-shell:copy-image",
      Array.from(bytes),
    );
  },
});

contextBridge.exposeInMainWorld("tasteLedgerNative", {
  storage: {
    ensureDirectory(path) {
      return ipcRenderer.invoke("taste-ledger-storage:ensure-directory", path);
    },

    readText(path) {
      return ipcRenderer.invoke("taste-ledger-storage:read-text", path);
    },

    writeTextAtomic(path, content) {
      return ipcRenderer.invoke(
        "taste-ledger-storage:write-text-atomic",
        path,
        content,
      );
    },

    async readBytes(path) {
      const bytes = await ipcRenderer.invoke(
        "taste-ledger-storage:read-bytes",
        path,
      );
      return bytes === null ? null : new Uint8Array(bytes);
    },

    writeBytesAtomic(path, content) {
      return ipcRenderer.invoke(
        "taste-ledger-storage:write-bytes-atomic",
        path,
        Array.from(content),
      );
    },

    deletePath(path) {
      return ipcRenderer.invoke("taste-ledger-storage:delete-path", path);
    },

    exists(path) {
      return ipcRenderer.invoke("taste-ledger-storage:exists", path);
    },
  },
});
