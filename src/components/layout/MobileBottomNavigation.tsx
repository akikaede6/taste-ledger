import { Layers, LayoutDashboard, Share2, Trophy } from "lucide-react";
import type { WorkspaceView } from "../../types/ui";

type MobileBottomNavigationProps = {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  onOpenSidebar: () => void;
};

export function MobileBottomNavigation({
  activeView,
  onSelectView,
  onOpenSidebar,
}: MobileBottomNavigationProps) {
  return (
    <nav className="mobile-tab-bar" aria-label="移动端导航">
      <button
        className={activeView === "dashboard" ? "selected" : ""}
        type="button"
        onClick={() => onSelectView("dashboard")}
      >
        <LayoutDashboard aria-hidden="true" size={16} />
        仪表盘
      </button>

      <button
        className={activeView === "rankings" ? "selected" : ""}
        type="button"
        onClick={() => onSelectView("rankings")}
      >
        <Trophy aria-hidden="true" size={16} />
        排行榜
      </button>

      <button
        className={activeView === "sharing" ? "selected" : ""}
        type="button"
        onClick={() => onSelectView("sharing")}
      >
        <Share2 aria-hidden="true" size={16} />
        导出
      </button>

      <button type="button" onClick={onOpenSidebar}>
        <Layers aria-hidden="true" size={16} />
        分类
      </button>
    </nav>
  );
}
