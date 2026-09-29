import { createSlice } from "@reduxjs/toolkit";

const workspaceSlice = createSlice({
  name: "workspace",
  initialState: { values: {} },
  reducers: {
    scopedStateInitialized(state, action) {
      const { storageKey, value } = action.payload;
      if (!(storageKey in state.values)) state.values[storageKey] = value;
    },
    scopedStateSet(state, action) {
      const { storageKey, value } = action.payload;
      state.values[storageKey] = value;
    },
    scopeRemoved(state, action) {
      const prefix = `ims:${action.payload}:`;
      Object.keys(state.values).forEach((key) => {
        if (key.startsWith(prefix)) delete state.values[key];
      });
    },
  },
});

export const { scopedStateInitialized, scopedStateSet, scopeRemoved } = workspaceSlice.actions;

export const setScopedState = (storageKey, update, fallbackValue) =>
  (dispatch, getState) => {
    const current = getState().workspace.values[storageKey] ?? fallbackValue;
    const value = typeof update === "function" ? update(current) : update;
    dispatch(scopedStateSet({ storageKey, value }));
  };

export default workspaceSlice.reducer;
