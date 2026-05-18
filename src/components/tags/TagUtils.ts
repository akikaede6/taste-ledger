import type { Work } from "../../core/model";

export interface TagOption {
  value: string;
  count: number;
}

export function collectTagOptions(works: Work[]): TagOption[] {
  const tagByKey = new Map<string, TagOption>();

  for (const work of works) {
    for (const tag of work.tags) {
      const trimmedTag = tag.trim();

      if (trimmedTag.length === 0) {
        continue;
      }

      const key = normalizeTagKey(trimmedTag);
      const current = tagByKey.get(key);

      tagByKey.set(key, {
        value: current?.value ?? trimmedTag,
        count: (current?.count ?? 0) + 1,
      });
    }
  }

  return [...tagByKey.values()].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }

    return left.value.localeCompare(right.value);
  });
}

export function matchesTagFilters(tags: string[], filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const tagKeys = new Set(tags.map(normalizeTagKey));

  return filters.every((filter) => tagKeys.has(normalizeTagKey(filter)));
}

export function matchesWorkSearch(work: Work, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return [work.title, work.shortReview, work.longReview, ...work.tags].some(
    (value) => value.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function parseTagText(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of value.split(/[,\n，、;；]+/)) {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      continue;
    }

    const key = normalizeTagKey(tag);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

function normalizeTagKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}
