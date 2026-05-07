export interface DesktopBridge {
  platform: "electron";
  chooseDirectory(): Promise<string | null>;
  chooseStorageDirectory(): Promise<string | null>;
  getStorageDirectory(): Promise<string>;
  writeFile(options: {
    directory: string;
    fileName: string;
    bytes: Uint8Array;
  }): Promise<string>;
  copyImage(bytes: Uint8Array): Promise<void>;
}

declare global {
  interface Window {
    tasteLedgerDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.tasteLedgerDesktop ?? null;
}
