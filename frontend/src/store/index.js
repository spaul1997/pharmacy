import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import authReducer from "./authSlice.js";
import masterReducer from "./masterSlice.js";
import workspaceReducer, { scopedStateSet } from "./workspaceSlice.js";
import specialAdminReducer from "./specialAdminSlice.js";

const persistence = createListenerMiddleware();

persistence.startListening({
  actionCreator: scopedStateSet,
  effect: (action) => {
    const { storageKey, value } = action.payload;
    if (storageKey.startsWith("ims:")) {
      localStorage.setItem(storageKey, JSON.stringify(value));
    }
  },
});

export const store = configureStore({
  reducer: {
    auth: authReducer,
    master: masterReducer,
    workspace: workspaceReducer,
    specialAdmin: specialAdminReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(persistence.middleware),
});
