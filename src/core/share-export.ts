import type { Library, RatingDimensionScore } from "./model";

export type WorkShareVariant = "cover" | "long";

export interface WorkSharePayload {
  variant: WorkShareVariant;
  workId: string;
  title: string;
  categoryName: string;
  coverImagePath: string | null;
  finalScore: number | null;
  ratingDimensions: RatingDimensionScore[];
  shortReview: string | null;
  longReview: string | null;
}

export interface ShareImageFile {
  id: string;
  extension: "svg";
  bytes: Uint8Array;
}

const IMAGE_WIDTH = 1080;
const TEXT_LEFT = 112;

export function buildWorkSharePayload(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
): WorkSharePayload {
  const work = library.works.find((item) => item.id === workId);

  if (!work) {
    throw new Error("Work not found.");
  }

  const category = library.categories.find(
    (item) => item.id === work.categoryId,
  );

  if (!category) {
    throw new Error("Work category not found.");
  }

  return {
    variant,
    workId: work.id,
    title: work.title,
    categoryName: category.name,
    coverImagePath: work.coverImagePath,
    finalScore: work.finalScore,
    ratingDimensions: work.ratingDimensions,
    shortReview: trimToNull(work.shortReview),
    longReview: variant === "long" ? trimToNull(work.longReview) : null,
  };
}

export function createWorkShareImage(
  library: Library,
  workId: string,
  variant: WorkShareVariant,
): ShareImageFile {
  const payload = buildWorkSharePayload(library, workId, variant);

  return {
    id: `${payload.workId}-${payload.variant}-${Date.now()}`,
    extension: "svg",
    bytes: new TextEncoder().encode(renderWorkShareSvg(payload)),
  };
}

export function renderWorkShareSvg(payload: WorkSharePayload): string {
  const shortReviewLines = payload.shortReview
    ? wrapText(payload.shortReview, 28)
    : [];
  const longReviewLines =
    payload.variant === "long" && payload.longReview
      ? wrapParagraphs(payload.longReview, 32)
      : [];
  const dimensionRows = payload.ratingDimensions.map(
    (dimension) =>
      `${dimension.name}: ${dimension.score} x ${dimension.weight}`,
  );
  const height =
    980 +
    shortReviewLines.length * 34 +
    dimensionRows.length * 38 +
    longReviewLines.length * 34;

  const scoreLabel =
    payload.finalScore === null ? "未评分" : `${payload.finalScore} 分`;
  const coverLabel = payload.coverImagePath
    ? `封面已入库: ${payload.coverImagePath}`
    : "未设置封面";

  let cursor = 112;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${height}" viewBox="0 0 ${IMAGE_WIDTH} ${height}" role="img" aria-label="${escapeXml(
      payload.title,
    )}">`,
    `<rect width="${IMAGE_WIDTH}" height="${height}" fill="#f8fafc"/>`,
    `<rect x="48" y="48" width="984" height="${height - 96}" rx="36" fill="#ffffff" stroke="#dbe3ef" stroke-width="2"/>`,
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#64748b" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
      payload.categoryName,
    )}</text>`,
  ];

  cursor += 76;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#111827" font-family="system-ui, sans-serif" font-size="58" font-weight="800">${escapeXml(
      payload.title,
    )}</text>`,
  );

  cursor += 54;
  parts.push(
    `<text x="${TEXT_LEFT}" y="${cursor}" fill="#0f766e" font-family="system-ui, sans-serif" font-size="38" font-weight="800">${escapeXml(
      scoreLabel,
    )}</text>`,
  );

  cursor += 56;
  parts.push(
    `<rect x="${TEXT_LEFT}" y="${cursor}" width="856" height="360" rx="28" fill="#e2e8f0"/>`,
    `<text x="${TEXT_LEFT + 36}" y="${cursor + 190}" fill="#475569" font-family="system-ui, sans-serif" font-size="30" font-weight="700">${escapeXml(
      coverLabel,
    )}</text>`,
  );

  cursor += 430;

  if (dimensionRows.length > 0) {
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">评分维度</text>`,
    );
    cursor += 48;
    for (const row of dimensionRows) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          row,
        )}</text>`,
      );
      cursor += 38;
    }
  }

  if (shortReviewLines.length > 0) {
    cursor += 28;
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">短评</text>`,
    );
    cursor += 48;
    for (const line of shortReviewLines) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          line,
        )}</text>`,
      );
      cursor += 34;
    }
  }

  if (longReviewLines.length > 0) {
    cursor += 28;
    parts.push(
      `<text x="${TEXT_LEFT}" y="${cursor}" fill="#1f2937" font-family="system-ui, sans-serif" font-size="34" font-weight="800">长评</text>`,
    );
    cursor += 48;
    for (const line of longReviewLines) {
      parts.push(
        `<text x="${TEXT_LEFT}" y="${cursor}" fill="#334155" font-family="system-ui, sans-serif" font-size="28">${escapeXml(
          line,
        )}</text>`,
      );
      cursor += 34;
    }
  }

  parts.push("</svg>");

  return parts.join("");
}

function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function wrapParagraphs(value: string, maxLength: number): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => (line.trim() ? wrapText(line.trim(), maxLength) : [""]));
}

function wrapText(value: string, maxLength: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }

  return chunks;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
