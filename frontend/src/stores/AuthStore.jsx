import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loggedOut,
  profileUpdated,
  sessionReceived,
  signIn,
  verifySession,
} from "../store/authSlice.js";

// Compatibility boundary for existing components. Authentication state and
// actions live in Redux; this component only starts stored-session validation.
export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const session = useSelector((state) => state.auth.session);

  useEffect(() => {
    if (session?.token && session.verified === false) {
      dispatch(verifySession());
    }
  }, [dispatch, session?.token, session?.verified]);

  return children;
}

export function useAuth() {
  const dispatch = useDispatch();
  const session = useSelector((state) => state.auth.session);

  return {
    session,
    signIn(credentials, remember) {
      return dispatch(signIn({ credentials, remember })).unwrap();
    },
    login(nextSession, remember) {
      dispatch(sessionReceived({ session: nextSession, remember }));
      return { ...nextSession, verified: true };
    },
    logout() {
      dispatch(loggedOut());
    },
    updateProfile(patch) {
      dispatch(profileUpdated(patch));
    },
  };
}
