import { useCallback, useRef } from "react";

/**
 * A minimal undo/redo stack that does NOT record a history entry on every
 * keystroke or drag-frame. Callers push a snapshot with `commit(before)`
 * exactly once per logical action (e.g. once per completed drag, once per
 * discrete toggle) — see MagneticLinesEditor for the capture/commit pattern
 * used with sliders and endpoint dragging.
 */
export function useHistory<T>(limit = 100) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);

  const commit = useCallback(
    (beforeSnapshot: T) => {
      past.current.push(beforeSnapshot);
      if (past.current.length > limit) past.current.shift();
      future.current = [];
    },
    [limit]
  );

  const undo = useCallback((current: T): T | null => {
    const prev = past.current.pop();
    if (prev === undefined) return null;
    future.current.push(current);
    return prev;
  }, []);

  const redo = useCallback((current: T): T | null => {
    const next = future.current.pop();
    if (next === undefined) return null;
    past.current.push(current);
    return next;
  }, []);

  const canUndo = () => past.current.length > 0;
  const canRedo = () => future.current.length > 0;

  return { commit, undo, redo, canUndo, canRedo };
}
