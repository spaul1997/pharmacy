import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { scopedStateInitialized, setScopedState } from "../store/workspaceSlice.js";

function readState(storageKey, initialFactory, sanitizer) {
  if (!storageKey) return initialFactory();

  try {
    const stored = localStorage.getItem(storageKey);
    const parsed = stored ? JSON.parse(stored) : initialFactory();
    return sanitizer ? sanitizer(parsed, initialFactory) : parsed;
  } catch {
    localStorage.removeItem(storageKey);
    return initialFactory();
  }
}

export function sanitizeEntityCollections(value, initialFactory) {
  const fallback = initialFactory();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  return Object.fromEntries(
    Object.entries(fallback).map(([key, rows]) => [key, Array.isArray(value[key]) ? value[key] : rows])
  );
}

// Kept under the original name so feature providers remain stable, while the
// actual scoped source of truth is the Redux workspace slice.
export function useScopedState(storageScope, stateName, initialFactory, sanitizer) {
  const dispatch = useDispatch();
  const initialFactoryRef = useRef(initialFactory);
  const storageKey = storageScope
    ? `ims:${storageScope}:${stateName}`
    : `session:${stateName}`;
  const initialValue = useMemo(
    () => readState(storageScope ? storageKey : null, initialFactoryRef.current, sanitizer),
    [sanitizer, storageKey, storageScope]
  );
  const storedValue = useSelector((state) => state.workspace.values[storageKey]);
  const value = storedValue ?? initialValue;

  useEffect(() => {
    dispatch(scopedStateInitialized({ storageKey, value: initialValue }));
  }, [dispatch, initialValue, storageKey]);

  const setValue = useCallback(
    (update) => dispatch(setScopedState(storageKey, update, initialValue)),
    [dispatch, initialValue, storageKey]
  );

  return [value, setValue];
}
