"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { propertiesApi } from "@/lib/api";
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

  const { data: propsData, isLoading: isLoadingProperties } = useQuery({
    queryKey: ["properties"],
    queryFn: () => propertiesApi.list(),
  });

  const properties: PropertyOption[] = propsData?.data?.data || [];

  // 1. Initialize from URL params or localStorage
  useEffect(() => {
    const urlProp = searchParams?.get("property_id");
    if (urlProp) {
      setSelectedPropertyId(urlProp);
      localStorage.setItem("sf_selected_property", urlProp);
      return;
    }

    const saved = localStorage.getItem("sf_selected_property");
    if (saved) {
      setSelectedPropertyId(saved);
    } else {
      setSelectedPropertyId("all");
    }
  }, [searchParams]);

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
