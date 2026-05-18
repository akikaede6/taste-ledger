import { BarChart3, ListPlus, Trophy } from "lucide-react";
import type { FormEvent } from "react";
import type {
  Category,
  Library as TasteLibrary,
  TierLevelId,
  TierList,
  Work,
} from "../../core/model";
import type { RankingDimensionOption } from "../../core/ranking";
import type {
  RankingSurfaceMode,
  ScoreRankingMode,
  TierListSaveInput,
} from "../../types/workspace";
import { countTierListWorks } from "./RankingHelpers";
import { RankingPreviewPanel } from "./RankingPreviewPanel";
import { TierListEditor } from "./TierListEditor";

type RankingsViewProps = {
  library: TasteLibrary;

  selectedCategory: Category | null | undefined;
  selectedRootCategory: Category | null;
  selectedTierList: TierList | null | undefined;
  selectedTierListId: string | null;

  categoryTierLists: TierList[];
  sharedCategoryWorks: Work[];
  rankingPreviewWorks: Work[];
  sharedCoverImageUrls: Map<string, string>;

  rankingSurfaceMode: RankingSurfaceMode;
  rankingPreviewMode: ScoreRankingMode;
  rankingPreviewDimensionId: string;
  selectedRankingPreviewDimensionId: string | null;
  rankingDimensionOptions: RankingDimensionOption[];

  newTierListName: string;

  onRankingSurfaceModeChange: (mode: RankingSurfaceMode) => void;
  onRankingPreviewModeChange: (mode: ScoreRankingMode) => void;
  onRankingPreviewDimensionChange: (dimensionId: string) => void;

  onNewTierListNameChange: (name: string) => void;
  onCreateTierList: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSelectTierList: (tierListId: string) => void;

  onSaveTierList: (input: TierListSaveInput) => Promise<void>;
  onDeleteTierList: () => Promise<void>;
  onMoveTierListWork: (
    workId: string,
    levelId: TierLevelId,
  ) => Promise<void>;
  onRemoveTierListWork: (workId: string) => Promise<void>;
  
  onOpenWorkDetail: (workId: string) => void;
  onExportRankingPreview: () => Promise<void>;
  onExportTierList: (input: TierListSaveInput) => Promise<void>;
};

export function RankingsView({
  library,
  selectedCategory,
  selectedRootCategory,
  selectedTierList,
  selectedTierListId,
  categoryTierLists,
  sharedCategoryWorks,
  rankingPreviewWorks,
  sharedCoverImageUrls,
  rankingSurfaceMode,
  rankingPreviewMode,
  rankingPreviewDimensionId,
  selectedRankingPreviewDimensionId,
  rankingDimensionOptions,
  newTierListName,
  onRankingSurfaceModeChange,
  onRankingPreviewModeChange,
  onRankingPreviewDimensionChange,
  onNewTierListNameChange,
  onCreateTierList,
  onSelectTierList,
  onSaveTierList,
  onDeleteTierList,
  onMoveTierListWork,
  onRemoveTierListWork,
  onOpenWorkDetail,
  onExportRankingPreview,
  onExportTierList,
}: RankingsViewProps) {
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <span>排行榜</span>

          <div className="segmented-control">
            <button
              className={rankingSurfaceMode === "tier" ? "selected" : ""}
              type="button"
              onClick={() => onRankingSurfaceModeChange("tier")}
            >
              <Trophy aria-hidden="true" size={16} />
              五级分级
            </button>

            <button
              className={rankingSurfaceMode === "score" ? "selected" : ""}
              type="button"
              onClick={() => onRankingSurfaceModeChange("score")}
            >
              <BarChart3 aria-hidden="true" size={16} />
              评分排行
            </button>
          </div>
        </div>

        {rankingSurfaceMode === "tier" ? (
          <>
            {selectedCategory ? (
              <>
                <form className="inline-form" onSubmit={onCreateTierList}>
                  <label htmlFor="tierListName">新分级</label>

                  <input
                    id="tierListName"
                    value={newTierListName}
                    onChange={(event) =>
                      onNewTierListNameChange(event.currentTarget.value)
                    }
                    placeholder="五级分级"
                  />

                  <button className="secondary-button" type="submit">
                    <ListPlus aria-hidden="true" size={16} />
                    创建分级
                  </button>
                </form>

                {categoryTierLists.length > 0 ? (
                  <div className="tier-list-selector">
                    {categoryTierLists.map((tierList) => {
                      const selected = tierList.id === selectedTierListId;
                      const assignedCount = countTierListWorks(tierList);

                      return (
                        <button
                          key={tierList.id}
                          className={
                            selected
                              ? "tier-list-selector-item selected"
                              : "tier-list-selector-item"
                          }
                          type="button"
                          onClick={() => onSelectTierList(tierList.id)}
                        >
                          <span>{tierList.name}</span>
                          <small>{assignedCount} 作品</small>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-state">这个分类还没有五级分级。</p>
                )}
              </>
            ) : (
              <p className="empty-state">先创建一个分类，再创建分级。</p>
            )}
          </>
        ) : (
          <RankingPreviewPanel
            rootCategory={selectedRootCategory}
            library={library}
            mode={rankingPreviewMode}
            dimensionOptions={rankingDimensionOptions}
            selectedDimensionId={selectedRankingPreviewDimensionId}
            works={rankingPreviewWorks}
            coverImageUrls={sharedCoverImageUrls}
            onOpenWork={onOpenWorkDetail}
            onExport={onExportRankingPreview}
            onModeChange={onRankingPreviewModeChange}
            onDimensionChange={onRankingPreviewDimensionChange}
          />
        )}
      </section>

      {rankingSurfaceMode === "tier" ? (
        selectedTierList ? (
          <TierListEditor
            tierList={selectedTierList}
            works={sharedCategoryWorks}
            coverImageUrls={sharedCoverImageUrls}
            onSave={onSaveTierList}
            onDelete={onDeleteTierList}
            onMoveWork={onMoveTierListWork}
            onRemoveWork={onRemoveTierListWork}
            onExport={onExportTierList}
          />
        ) : (
          <section className="panel">
            <p className="empty-state">选择一个分级后开始拖拽作品。</p>
          </section>
        )
      ) : null}
    </>
  );
}
