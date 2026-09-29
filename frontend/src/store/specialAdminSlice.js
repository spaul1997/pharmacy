import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { specialAdminService } from "../services/specialAdminService.js";

const loaders = {
  dashboard: specialAdminService.getDashboard,
  companies: specialAdminService.getCompanies,
  payments: specialAdminService.getPayments,
};

const createResources = () => ({
  dashboard: {
    data: { summary: {}, recentCompanies: [] },
    loading: false,
    error: "",
    loaded: false,
  },
  companies: {
    data: { companies: [] },
    loading: false,
    error: "",
    loaded: false,
  },
  payments: {
    data: { payments: [] },
    loading: false,
    error: "",
    loaded: false,
  },
});

const tokenFromState = (state) => state.auth.session?.token;

export const loadSpecialAdminResource = createAsyncThunk(
  "specialAdmin/loadResource",
  async (resourceKey, { getState }) => ({
    resourceKey,
    data: await loaders[resourceKey](tokenFromState(getState())),
  }),
  {
    condition: (resourceKey, { getState }) => {
      const resource = getState().specialAdmin.resources[resourceKey];
      return Boolean(loaders[resourceKey]) && !resource?.loading;
    },
  }
);

export const addSpecialAdminCompany = createAsyncThunk(
  "specialAdmin/createCompany",
  async (values, { getState }) =>
    specialAdminService.createCompany(values, tokenFromState(getState()))
);

const specialAdminSlice = createSlice({
  name: "specialAdmin",
  initialState: { resources: createResources(), token: null },
  reducers: {
    specialAdminSessionChanged(state, action) {
      if (state.token === action.payload) return;
      state.token = action.payload;
      state.resources = createResources();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSpecialAdminResource.pending, (state, action) => {
        const resource = state.resources[action.meta.arg];
        if (!resource) return;
        resource.loading = true;
        resource.error = "";
      })
      .addCase(loadSpecialAdminResource.fulfilled, (state, action) => {
        const { resourceKey, data } = action.payload;
        state.resources[resourceKey] = {
          data,
          loading: false,
          error: "",
          loaded: true,
        };
      })
      .addCase(loadSpecialAdminResource.rejected, (state, action) => {
        if (action.meta.condition) return;
        const resource = state.resources[action.meta.arg];
        if (!resource) return;
        resource.loading = false;
        resource.loaded = true;
        resource.error = action.error.message || "Unable to load data.";
      })
      .addCase(addSpecialAdminCompany.fulfilled, (state, action) => {
        state.resources.dashboard.loaded = false;
        state.resources.companies.data.companies = [
          action.payload.company,
          ...(state.resources.companies.data.companies || []),
        ];
        state.resources.companies.loaded = true;
      });
  },
});

export const { specialAdminSessionChanged } = specialAdminSlice.actions;
export default specialAdminSlice.reducer;
