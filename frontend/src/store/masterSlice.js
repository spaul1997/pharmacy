import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { masterEntities } from "../data/masterManagement.js";
import {
  createMasterRow,
  getMasterApiEntityKeys,
  listMasterRows,
  updateMasterRow,
} from "../services/masterService.js";
import { listStateDistricts } from "../services/locationService.js";

const entityKeys = getMasterApiEntityKeys();

const emptyRows = () =>
  Object.fromEntries(Object.keys(masterEntities).map((entityKey) => [entityKey, []]));

const emptyFlags = (value) =>
  Object.fromEntries(entityKeys.map((entityKey) => [entityKey, value]));

const selectToken = (getState) => getState().auth.session?.token;

export const loadMasterData = createAsyncThunk(
  "master/loadAll",
  async ({ scope }, { getState }) => {
    const token = selectToken(getState);
    if (!token) throw new Error("Authentication required.");

    const results = await Promise.allSettled(
      entityKeys.map(async (entityKey) => ({
        entityKey,
        rows: await listMasterRows(entityKey, token),
      }))
    );

    return {
      scope,
      results: results.map((result, index) =>
        result.status === "fulfilled"
          ? { ...result.value, error: "" }
          : {
              entityKey: entityKeys[index],
              rows: [],
              error: result.reason?.message || "Unable to load master data.",
            }
      ),
    };
  },
  {
    condition: ({ scope }, { getState }) => {
      const master = getState().master;
      return master.scope === scope && !Object.values(master.loading).some(Boolean);
    },
  }
);

export const loadMasterLocationOptions = createAsyncThunk(
  "master/loadLocationOptions",
  async () => listStateDistricts(),
  {
    condition: (_, { getState }) => {
      const status = getState().master.locationOptionsStatus;
      return status !== "loading" && status !== "succeeded";
    },
  }
);

export const addMasterRow = createAsyncThunk(
  "master/addRow",
  async ({ entityKey, record }, { getState }) => ({
    entityKey,
    row: await createMasterRow(entityKey, record, selectToken(getState)),
  })
);

export const saveMasterRow = createAsyncThunk(
  "master/updateRow",
  async ({ entityKey, id, patch }, { getState }) => ({
    entityKey,
    id,
    row: await updateMasterRow(entityKey, id, patch, selectToken(getState)),
  })
);

const masterSlice = createSlice({
  name: "master",
  initialState: {
    scope: null,
    rows: emptyRows(),
    loading: emptyFlags(false),
    error: emptyFlags(""),
    locationOptions: {},
    locationOptionsStatus: "idle",
  },
  reducers: {
    masterScopeChanged(state, action) {
      if (state.scope === action.payload) return;
      state.scope = action.payload;
      state.rows = emptyRows();
      state.loading = emptyFlags(false);
      state.error = emptyFlags("");
      state.locationOptions = {};
      state.locationOptionsStatus = "idle";
    },
    masterDataCleared(state) {
      state.scope = null;
      state.rows = emptyRows();
      state.loading = emptyFlags(false);
      state.error = emptyFlags("");
      state.locationOptions = {};
      state.locationOptionsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMasterData.pending, (state) => {
        state.loading = emptyFlags(true);
        state.error = emptyFlags("");
      })
      .addCase(loadMasterData.fulfilled, (state, action) => {
        if (action.payload.scope !== state.scope) return;
        action.payload.results.forEach(({ entityKey, rows, error }) => {
          state.rows[entityKey] = rows;
          state.loading[entityKey] = false;
          state.error[entityKey] = error;
        });
      })
      .addCase(loadMasterData.rejected, (state, action) => {
        if (action.meta.condition || action.meta.arg.scope !== state.scope) return;
        entityKeys.forEach((entityKey) => {
          state.loading[entityKey] = false;
          state.error[entityKey] = action.error.message || "Unable to load master data.";
        });
      })
      .addCase(addMasterRow.fulfilled, (state, action) => {
        const { entityKey, row } = action.payload;
        state.rows[entityKey] = [row, ...(state.rows[entityKey] || [])];
      })
      .addCase(saveMasterRow.fulfilled, (state, action) => {
        const { entityKey, id, row } = action.payload;
        state.rows[entityKey] = (state.rows[entityKey] || []).map((item) =>
          item.code === id || item.id === id ? row : item
        );
      })
      .addCase(loadMasterLocationOptions.pending, (state) => {
        state.locationOptionsStatus = "loading";
      })
      .addCase(loadMasterLocationOptions.fulfilled, (state, action) => {
        state.locationOptions = action.payload;
        state.locationOptionsStatus = "succeeded";
      })
      .addCase(loadMasterLocationOptions.rejected, (state) => {
        state.locationOptions = {};
        state.locationOptionsStatus = "failed";
      });
  },
});

export const { masterDataCleared, masterScopeChanged } = masterSlice.actions;
export default masterSlice.reducer;
