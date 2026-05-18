import type { CategoryModalState } from "../../types/workspace";

export function createEmptyCategoryModalState(): CategoryModalState {
  return createRootCategoryModalState();
}

export function createRootCategoryModalState(): CategoryModalState {
  return {
    mode: "root",
    parentCategoryId: null,
    name: "",
    dimensionDrafts: [
      {
        id: `template-${crypto.randomUUID()}`,
        name: "剧情",
        weight: "1",
      },
      {
        id: `template-${crypto.randomUUID()}`,
        name: "画面",
        weight: "1",
      },
    ],
  };
}

export function createChildCategoryModalState(
  parentCategoryId: string,
): CategoryModalState {
  return {
    mode: "child",
    parentCategoryId,
    name: "",
    dimensionDrafts: [],
  };
}
