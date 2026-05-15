import { LayoutDashboard, Share2, Trophy } from "lucide-react";
import type { WorkspaceView } from "../../types/ui";

type ViewNavigationProps = {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
};

export function ViewNavigation({
  activeView,
  onSelectView,
}: ViewNavigationProps) {
  return (
    <nav className="view-nav" aria-label="主导航">
      <button
        className={
          activeView === "dashboard"
            ? "workspace-nav-button  selected"
            : "workspace-nav-button "
        }
        type="button"
        onClick={() => onSelectView("dashboard")}
      >
        <LayoutDashboard aria-hidden="true" size={16} />
        仪表盘
      </button>

      <button
        className={
          activeView === "rankings"
            ? "workspace-nav-button selected"
            : "workspace-nav-button"
        }
        type="button"
        onClick={() => onSelectView("rankings")}
      >
        <Trophy aria-hidden="true" size={16} />
        排行榜
      </button>

      <button
        className={
          activeView === "sharing"
            ? "workspace-nav-button selected"
            : "workspace-nav-button"
        }
        type="button"
        onClick={() => onSelectView("sharing")}
      >
        <Share2 aria-hidden="true" size={16} />
        导出预览
      </button>
    </nav>
  );
}
