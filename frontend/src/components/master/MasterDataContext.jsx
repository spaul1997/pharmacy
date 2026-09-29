import React, { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addMasterRow,
  loadMasterData,
  loadMasterLocationOptions,
  masterDataCleared,
  masterScopeChanged,
  saveMasterRow,
} from "../../store/masterSlice.js";

// Existing screens keep a small hook API while Redux remains the single source
// of truth. No React context or page-level request logic is used here.
export function MasterDataProvider({ children, storageScope, token }) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token || !storageScope) {
      dispatch(masterDataCleared());
      return;
    }

    dispatch(masterScopeChanged(storageScope));
    dispatch(loadMasterData({ scope: storageScope }));
    dispatch(loadMasterLocationOptions());
  }, [dispatch, storageScope, token]);

  return children;
}

export function useMasterData() {
  const dispatch = useDispatch();
  const { rows, loading, error, locationOptions } = useSelector((state) => state.master);

  const getRows = useCallback((entityKey) => rows[entityKey] || [], [rows]);
  const addRow = useCallback(
    (entityKey, record) => dispatch(addMasterRow({ entityKey, record })).unwrap().then((result) => result.row),
    [dispatch]
  );
  const updateRow = useCallback(
    (entityKey, id, patch) =>
      dispatch(saveMasterRow({ entityKey, id, patch })).unwrap().then((result) => result.row),
    [dispatch]
  );

  return useMemo(
    () => ({ getRows, addRow, updateRow, loading, error, locationOptions }),
    [addRow, error, getRows, loading, locationOptions, updateRow]
  );
}
