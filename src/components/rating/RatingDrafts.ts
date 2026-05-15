import type {
  RatingDimensionScore,
  RatingDimensionTemplate,
} from "../../core/model";
import { calculateFinalScore } from "../../core/scoring";

export interface RatingTemplateDraft {
  id: string;
  name: string;
  weight: string;
}

export interface RatingTemplateDraftState {
  errorMessage: string | null;
  templates: RatingDimensionTemplate[];
}

export interface RatingDimensionDraft {
  id: string;
  name: string;
  score: string;
  weight: string;
}

export interface RatingDimensionDraftState {
  errorMessage: string | null;
  finalScore: number | null;
  ratingDimensions: RatingDimensionScore[];
}

export function createTemplateDrafts(
  templates: RatingDimensionTemplate[],
): RatingTemplateDraft[] {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    weight: String(template.weight),
  }));
}

export function createNewTemplateDraft(index: number): RatingTemplateDraft {
  return {
    id: `template-${crypto.randomUUID()}`,
    name: `维度 ${index + 1}`,
    weight: "1",
  };
}

export function readTemplateDrafts(
  drafts: RatingTemplateDraft[],
): RatingTemplateDraftState {
  const seenIds = new Set<string>();
  const templates: RatingDimensionTemplate[] = [];

  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    const id = draft.id.trim();
    const name = draft.name.trim();
    const weightText = draft.weight.trim();

    if (id.length === 0 || seenIds.has(id)) {
      return failTemplateDraft(`评分维度 ${number} 无法保存。`);
    }

    seenIds.add(id);

    if (name.length === 0) {
      return failTemplateDraft(`评分维度 ${number} 名称不能为空。`);
    }

    if (weightText.length === 0) {
      return failTemplateDraft(`评分维度 ${number} 权重不能为空。`);
    }

    const weight = Number(weightText);

    if (!Number.isFinite(weight) || weight <= 0) {
      return failTemplateDraft(`评分维度 ${number} 权重必须大于 0。`);
    }

    templates.push({
      id,
      name,
      weight,
    });
  }

  return {
    errorMessage: null,
    templates,
  };
}

export function createDimensionDraftsFromTemplates(
  templates: RatingDimensionTemplate[],
): RatingDimensionDraft[] {
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    score: "0",
    weight: String(template.weight),
  }));
}

export function createDimensionDrafts(
  ratingDimensions: RatingDimensionScore[],
): RatingDimensionDraft[] {
  return ratingDimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    score: String(dimension.score),
    weight: String(dimension.weight),
  }));
}

export function readDimensionDrafts(
  drafts: RatingDimensionDraft[],
): RatingDimensionDraftState {
  const seenIds = new Set<string>();
  const ratingDimensions: RatingDimensionScore[] = [];

  for (const [index, draft] of drafts.entries()) {
    const number = index + 1;
    const id = draft.id.trim();
    const name = draft.name.trim();
    const scoreText = draft.score.trim();
    const weightText = draft.weight.trim();

    if (id.length === 0 || seenIds.has(id)) {
      return failDimensionDraft(`评分维度 ${number} 无法保存。`);
    }

    seenIds.add(id);

    if (name.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 名称不能为空。`);
    }

    if (scoreText.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 评分不能为空。`);
    }

    const score = Number(scoreText);

    if (!Number.isFinite(score) || score < 0) {
      return failDimensionDraft(`评分维度 ${number} 评分必须是非负数字。`);
    }

    if (weightText.length === 0) {
      return failDimensionDraft(`评分维度 ${number} 权重不能为空。`);
    }

    const weight = Number(weightText);

    if (!Number.isFinite(weight) || weight <= 0) {
      return failDimensionDraft(`评分维度 ${number} 权重必须大于 0。`);
    }

    ratingDimensions.push({
      id,
      name,
      score,
      weight,
    });
  }

  return {
    errorMessage: null,
    finalScore: calculateFinalScore(ratingDimensions),
    ratingDimensions,
  };
}

function failTemplateDraft(message: string): RatingTemplateDraftState {
  return {
    errorMessage: message,
    templates: [],
  };
}

function failDimensionDraft(message: string): RatingDimensionDraftState {
  return {
    errorMessage: message,
    finalScore: null,
    ratingDimensions: [],
  };
}
