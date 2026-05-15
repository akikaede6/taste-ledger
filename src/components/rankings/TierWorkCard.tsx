import type { DragEvent } from "react";
import type { Work } from "../../core/model";

interface TierWorkCardProps {
  work: Work;
  coverImageUrl: string | null;
  isDragging: boolean;
  onDragStart(workId: string, event: DragEvent<HTMLElement>): void;
  onDragEnd(): void;
}

export function TierWorkCard({
  work,
  coverImageUrl,
  isDragging,
  onDragStart,
  onDragEnd,
}: TierWorkCardProps) {
  return (
    <article
      className={isDragging ? "tier-work-card dragging" : "tier-work-card"}
      draggable
      aria-label={`拖动 ${work.title}`}
      aria-grabbed={isDragging}
      onDragStart={(event) => onDragStart(work.id, event)}
      onDragEnd={onDragEnd}
    >
      <div className="tier-work-cover">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" />
        ) : (
          <span>{work.coverImagePath ?? "未设置封面"}</span>
        )}
      </div>
      <div className="tier-work-copy">
        <strong>{work.title}</strong>
      </div>
    </article>
  );
}
