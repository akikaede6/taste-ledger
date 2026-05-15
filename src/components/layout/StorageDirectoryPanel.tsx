type StorageDirectoryPanelProps = {
  storageDirectory: string | null;
  onChooseStorageDirectory: () => void | Promise<void>;
};

export function StorageDirectoryPanel({
  storageDirectory,
  onChooseStorageDirectory,
}: StorageDirectoryPanelProps) {
  return (
    <section className="storage-card">
      <span>数据文件夹</span>
      <strong>{storageDirectory ?? "正在读取"}</strong>

      <button type="button" onClick={() => void onChooseStorageDirectory()}>
        选择数据文件夹
      </button>
    </section>
  );
}
