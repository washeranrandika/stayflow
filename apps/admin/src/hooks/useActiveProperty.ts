"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usersApi, propertiesApi } from "@/lib/api";
import { useSearchParams } from "next/navigation";

export interface PropertyOption {
  id: string;
  name: string;
  city?: string;
  address?: string;
}

export function useActiveProperty() {
  const searchParams = useSearchParams();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  const { data: userData } = useQuery({
    queryKey: ["currentUserProfile"],
    queryFn: () => usersApi.me(),
  });

  const { data: propsData, isLoading: isLoadingProperties } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const properties: PropertyOption[] = propsData?.data?.data || [];
  const user = userData?.data?.data;
  const userAssignedPropertyId = user?.assigned_property_id;
  const isRestrictedRole = user?.role === "RECEPTIONIST" || user?.role === "HOUSEKEEPER";

  // 1. Initialize from URL params, user assigned property, or localStorage
  useEffect(() => {
    // If the user's role is strictly locked to a single property (e.g. receptionist/housekeeper)
    if (isRestrictedRole && userAssignedPropertyId) {
      setSelectedPropertyId(userAssignedPropertyId);
      localStorage.setItem("sf_selected_property", userAssignedPropertyId);
      return;
    }

    // Priority 1: URL Query parameter
    const urlProp = searchParams?.get("property_id");
    if (urlProp) {
      setSelectedPropertyId(urlProp);
      localStorage.setItem("sf_selected_property", urlProp);
      return;
    }

    // Priority 2: Local storage
    const saved = localStorage.getItem("sf_selected_property");
    if (saved) {
      setSelectedPropertyId(saved);
      return;
    }

    // Priority 3: Default fallback
    if (userAssignedPropertyId) {
      setSelectedPropertyId(userAssignedPropertyId);
    } else {
      setSelectedPropertyId("all");
    }
  }, [searchParams, userAssignedPropertyId, isRestrictedRole]);

  // 2. Listen to custom 'property-changed' events dispatched across components
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setSelectedPropertyId(e.detail);
      }
    };
    window.addEventListener("property-changed", handler);
    return () => window.removeEventListener("property-changed", handler);
  }, []);

  // 3. Setter function that persists and dispatches
  const setProperty = useCallback((id: string) => {
    setSelectedPropertyId(id);
    localStorage.setItem("sf_selected_property", id);
    window.dispatchEvent(new CustomEvent("property-changed", { detail: id }));
  }, []);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const isAll = selectedPropertyId === "all";
  const propertyIdParam = isAll ? undefined : selectedPropertyId;

  return {
    selectedPropertyId,
    selectedProperty,
    isAll,
    propertyIdParam,
    properties,
    isLoadingProperties,
    setProperty,
  };
}
