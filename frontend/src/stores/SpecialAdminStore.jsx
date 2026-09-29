import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addSpecialAdminCompany,
  loadSpecialAdminResource,
  specialAdminSessionChanged,
} from "../store/specialAdminSlice.js";

export function SpecialAdminDataProvider({ children, token }) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(specialAdminSessionChanged(token || null));
  }, [dispatch, token]);

  return children;
}

export function useSpecialAdminResource(resourceKey) {
  const dispatch = useDispatch();
  const resource = useSelector(
    (state) => state.specialAdmin.resources[resourceKey]
  ) || { data: {}, loading: false, error: "", loaded: false };

  useEffect(() => {
    if (!resource.loaded && !resource.loading) {
      dispatch(loadSpecialAdminResource(resourceKey));
    }
  }, [dispatch, resource.loaded, resource.loading, resourceKey]);

  return {
    ...resource,
    refresh: () => dispatch(loadSpecialAdminResource(resourceKey)).unwrap(),
  };
}

export function useSpecialAdminActions() {
  const dispatch = useDispatch();

  return {
    createCompany: (values) => dispatch(addSpecialAdminCompany(values)).unwrap(),
  };
}
