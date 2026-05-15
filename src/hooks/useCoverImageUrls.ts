import { useEffect, useState } from "react";
import { createDisplayImageDataUrl } from "../core/image-utils";
import type { Work } from "../core/model";
import type { LibraryRepository } from "../core/repository";

export function useCoverImageUrls(
  repository: LibraryRepository,
  works: Work[],
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    const worksWithCovers = works.filter((work) => work.coverImagePath);

    if (worksWithCovers.length === 0) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setUrls(new Map());
        }
      });

      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      worksWithCovers.map(async (work) => {
        if (!work.coverImagePath) {
          return null;
        }

        const bytes = await repository.readImage(work.coverImagePath);

        if (!bytes) {
          return null;
        }

        return [
          work.id,
          await createDisplayImageDataUrl(work.coverImagePath, bytes),
        ] as const;
      }),
    ).then((entries) => {
      if (!cancelled) {
        setUrls(new Map(entries.filter((entry) => entry !== null)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repository, works]);

  return urls;
}
