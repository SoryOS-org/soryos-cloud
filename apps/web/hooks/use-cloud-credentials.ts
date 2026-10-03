"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProviderStatus, ProviderDefinition } from "@/lib/credentials/manager";

export function useCloudCredentials() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [definitions, setDefinitions] = useState<Record<string, ProviderDefinition>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error("Impossible de charger les identifiants cloud");
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
      if (data.definitions) setDefinitions(data.definitions);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur chargement credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      try {
        const res = await fetch("/api/credentials");
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.providers) setProviders(data.providers);
        if (data.definitions) setDefinitions(data.definitions);
      } catch {
        // ignore initial fetch error
      }
    };
    void init();
    return () => {
      isMounted = false;
    };
  }, []);

  const saveCredentials = async (providerId: string, fields: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", providerId, fields }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erreur d'enregistrement");
      }
      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status : p))
        );
      }
      return data.status as ProviderStatus;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur d'enregistrement";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (providerId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", providerId }),
      });
      const data = await res.json();
      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status : p))
        );
      }
      return data as { success: boolean; message: string; status: ProviderStatus };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de test";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const removeCredentials = async (providerId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", providerId }),
      });
      const data = await res.json();
      if (data.status) {
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? data.status : p))
        );
      }
      return data.status as ProviderStatus;
    } finally {
      setLoading(false);
    }
  };

  return {
    providers,
    definitions,
    loading,
    error,
    refresh: fetchProviders,
    saveCredentials,
    testConnection,
    removeCredentials,
  };
}
