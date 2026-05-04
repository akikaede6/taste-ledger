const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("rankingDesktop", {
  platform: "electron",
});
