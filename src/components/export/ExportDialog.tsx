import { ClipboardCopy, Download, RefreshCw, X } from "lucide-react";
import type { ExportDialogState } from "../../types/workspace";
import type { ShareCoverOptions } from "../../core/share-export";

type ExportDialogProps = {
  state: ExportDialogState;
  exportDirectory: string | null;
  hasDesktopBridge: boolean;
  canCopy: boolean;
  onChooseDirectory: () => void | Promise<void>;
  onUpdateCoverOptions: (options: ShareCoverOptions) => void | Promise<void>;
  onCopyImage: () => void | Promise<void>;
  onSaveFile: () => void | Promise<void>;
  onClose: () => void;
};

export function ExportDialog({
  state,
  exportDirectory,
  hasDesktopBridge,
  canCopy,
  onChooseDirectory,
  onUpdateCoverOptions,
  onCopyImage,
  onSaveFile,
  onClose,
}: ExportDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-card export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span>导出预览</span>
            <h3 id="export-dialog-title">{state.title}</h3>
          </div>

          <button
            className="icon-button"
            type="button"
            aria-label="关闭导出预览"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="export-preview-frame">
          <img src={state.previewUrl} alt={`${state.title} 预览`} />
        </div>

        <p className="helper-text">
          预览文件：{state.fileNameBase}.{state.canRasterize ? "png" : "svg"}
        </p>

        {hasDesktopBridge ? (
          <section className="storage-card">
            <span>导出文件夹</span>
            <strong>{exportDirectory ?? "未选择"}</strong>

            <button type="button" onClick={() => void onChooseDirectory()}>
              选择文件夹
            </button>
          </section>
        ) : (
          <p className="helper-text">浏览器环境会直接下载文件。</p>
        )}

        {state.supportsCoverMosaic ? (
          <section className="export-options">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.coverMosaic}
                disabled={state.isRefreshing}
                onChange={(event) =>
                  void onUpdateCoverOptions({
                    coverMosaic: event.currentTarget.checked,
                    mosaicLevel: state.mosaicLevel,
                  })
                }
              />
              封面图马赛克
            </label>

            <label className="range-field">
              <span>马赛克等级 {state.mosaicLevel}</span>
              <input
                type="range"
                min={2}
                max={24}
                step={1}
                value={state.mosaicLevel}
                disabled={state.isRefreshing}
                onChange={(event) =>
                  void onUpdateCoverOptions({
                    coverMosaic: true,
                    mosaicLevel: Number(event.currentTarget.value),
                  })
                }
              />
            </label>
          </section>
        ) : (
          <p className="helper-text">当前导出不包含封面图。</p>
        )}

        <div className="modal-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={state.isRefreshing || !canCopy}
            onClick={() => void onCopyImage()}
          >
            {state.isRefreshing ? (
              <RefreshCw aria-hidden="true" size={16} />
            ) : (
              <ClipboardCopy aria-hidden="true" size={16} />
            )}
            {state.isRefreshing ? "更新中" : "复制图片"}
          </button>

          <button
            className="primary-button"
            type="button"
            disabled={state.isRefreshing}
            onClick={() => void onSaveFile()}
          >
            {state.isRefreshing ? (
              <RefreshCw aria-hidden="true" size={16} />
            ) : (
              <Download aria-hidden="true" size={16} />
            )}
            {state.isRefreshing ? "更新中" : "导出文件"}
          </button>

          <button className="text-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
