import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authService } from "../services/authService.js";

const SESSION_KEY = "ims-session";

function getStoredSession() {
  try {
    const storedSession =
      JSON.parse(localStorage.getItem(SESSION_KEY)) ||
      JSON.parse(sessionStorage.getItem(SESSION_KEY)) ||
      null;
    return storedSession ? { ...storedSession, verified: false } : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function persistSession(session, remember) {
  if (remember) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function updateStoredSession(session) {
  if (localStorage.getItem(SESSION_KEY)) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  if (sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export const signIn = createAsyncThunk(
  "auth/signIn",
  async ({ credentials, remember }) => {
    const response = await authService.login(credentials);
    if (!response.token || !response.user) {
      throw new Error("Login response was incomplete.");
    }

    const session = { ...response, verified: true };
    persistSession(session, remember);
    return session;
  }
);

export const verifySession = createAsyncThunk(
  "auth/verifySession",
  async (_, { getState }) => {
    const session = getState().auth.session;
    if (!session?.token) return null;

    try {
      const response = await authService.me(session.token);
      const verifiedSession = {
        ...session,
        user: { ...session.user, ...response.user },
        verified: true,
      };
      updateStoredSession(verifiedSession);
      return verifiedSession;
    } catch (error) {
      clearStoredSession();
      throw error;
    }
  },
  {
    condition: (_, { getState }) => getState().auth.session?.verified === false,
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    session: getStoredSession(),
    status: "idle",
    error: "",
  },
  reducers: {
    sessionReceived(state, action) {
      const { session, remember = false } = action.payload;
      const verifiedSession = { ...session, verified: true };
      state.session = verifiedSession;
      state.error = "";
      persistSession(verifiedSession, remember);
    },
    loggedOut(state) {
      state.session = null;
      state.status = "idle";
      state.error = "";
      clearStoredSession();
    },
    profileUpdated(state, action) {
      if (!state.session) return;
      state.session.user = { ...state.session.user, ...action.payload };
      updateStoredSession(state.session);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.session = action.payload;
        state.status = "succeeded";
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Unable to sign in.";
      })
      .addCase(verifySession.fulfilled, (state, action) => {
        if (action.payload) state.session = action.payload;
      })
      .addCase(verifySession.rejected, (state) => {
        state.session = null;
      });
  },
});

export const { loggedOut, profileUpdated, sessionReceived } = authSlice.actions;
export default authSlice.reducer;
