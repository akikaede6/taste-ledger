import { useEffect, useMemo, useState } from "react";
import { createLibraryController, type LibraryState } from "./library-state";
import type { LibraryRepository } from "./repository";

export function useLibraryState(repository: LibraryRepository) {
  const controller = useMemo(
    () => createLibraryController(repository),
    [repository],
  );
  const [state, setState] = useState<LibraryState>(controller.getState());

  useEffect(() => {
    let mounted = true;
    const subscription = controller.subscribe(() => {
      if (mounted) {
        setState(controller.getState());
      }
    });

    void controller.load();

    return () => {
      mounted = false;
      subscription();
    };
  }, [controller]);

  return {
    state,
    controller,
  };
}
