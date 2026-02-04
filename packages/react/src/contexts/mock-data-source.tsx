"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { DataSource } from "@json-render/core";
import { useData } from "./data";
import { DataSourceContext, type DataSourceContextValue } from "./data-source";

export interface MockDataSourceProviderProps {
  sources: DataSource[];
  children: ReactNode;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    window.setTimeout(resolve, ms);
  });
}

function getItemId(item: unknown): string | undefined {
  if (!item || typeof item !== "object") {
    return undefined;
  }
  const id = (item as Record<string, unknown>).id;
  if (id === null || id === undefined) {
    return undefined;
  }
  return String(id);
}

function createMockRecord(data?: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      id: `mock-${Date.now()}`,
      ...(data as Record<string, unknown>),
    };
  }
  return {
    id: `mock-${Date.now()}`,
    name: "New Item",
    createdAt: new Date().toISOString(),
  };
}

export function MockDataSourceProvider({
  sources,
  children,
}: MockDataSourceProviderProps) {
  const { get, set, update } = useData();
  const mockStoreRef = useRef<Record<string, unknown[]>>({});

  const getSource = useCallback(
    (sourceId: string): DataSource | undefined =>
      sources.find((source) => source.id === sourceId),
    [sources],
  );

  const getMockList = useCallback((source: DataSource): unknown[] => {
    const existing = mockStoreRef.current[source.id];
    if (existing) {
      return existing;
    }

    const seeded =
      source.mockData?.list?.map((item) =>
        typeof item === "object" && item !== null
          ? { ...(item as Record<string, unknown>) }
          : item,
      ) ?? [];

    mockStoreRef.current[source.id] = seeded;
    return seeded;
  }, []);

  const fetchSource = useCallback(
    async (sourceId: string): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) {
        return;
      }

      const list = getMockList(source);
      const path = source.path;

      set(`${path}/loading`, true);
      set(`${path}/error`, null);

      await delay(source.mockData?.delay ?? 0);

      const total = list.length;
      const page = (get(`${path}/pagination/page`) as number | undefined) ?? 1;
      const pageSize =
        (get(`${path}/pagination/pageSize`) as number | undefined) ?? 10;
      const start = Math.max(0, (page - 1) * pageSize);
      const end = start + pageSize;
      const paginated = list.slice(start, end);

      update({
        [`${path}/data`]: paginated,
        [`${path}/pagination/total`]: total,
        [`${path}/lastUpdated`]: Date.now(),
        [`${path}/loading`]: false,
      });
    },
    [get, getMockList, getSource, set, update],
  );

  const createRecord = useCallback(
    async (sourceId: string, dataArg?: unknown): Promise<unknown> => {
      const source = getSource(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }

      const list = getMockList(source);
      const next = [...list, createMockRecord(dataArg)];
      mockStoreRef.current[source.id] = next;

      if (source.refetchOn?.includes("create")) {
        await fetchSource(sourceId);
      } else {
        set(`${source.path}/data`, next);
        set(`${source.path}/pagination/total`, next.length);
      }

      return next[next.length - 1] ?? null;
    },
    [fetchSource, getMockList, getSource, set],
  );

  const updateRecord = useCallback(
    async (
      sourceId: string,
      id: string,
      dataArg?: unknown,
    ): Promise<unknown> => {
      const source = getSource(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }

      const list = getMockList(source);
      const next = list.map((item) => {
        if (getItemId(item) !== id) {
          return item;
        }
        if (item && typeof item === "object") {
          return {
            ...(item as Record<string, unknown>),
            ...(typeof dataArg === "object" && dataArg !== null
              ? (dataArg as Record<string, unknown>)
              : {}),
          };
        }
        return item;
      });

      mockStoreRef.current[source.id] = next;

      if (source.refetchOn?.includes("update")) {
        await fetchSource(sourceId);
      } else {
        set(`${source.path}/data`, next);
      }

      return next.find((item) => getItemId(item) === id) ?? null;
    },
    [fetchSource, getMockList, getSource, set],
  );

  const deleteRecord = useCallback(
    async (sourceId: string, id: string): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) {
        throw new Error(`Source not found: ${sourceId}`);
      }

      const list = getMockList(source);
      const next = list.filter((item) => getItemId(item) !== id);
      mockStoreRef.current[source.id] = next;

      if (source.refetchOn?.includes("delete")) {
        await fetchSource(sourceId);
      } else {
        update({
          [`${source.path}/data`]: next,
          [`${source.path}/pagination/total`]: next.length,
        });
      }
    },
    [fetchSource, getMockList, getSource, update],
  );

  const refetchSource = useCallback(
    async (sourceId: string): Promise<void> => {
      await fetchSource(sourceId);
    },
    [fetchSource],
  );

  const setPage = useCallback(
    async (sourceId: string, page: number): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) return;
      set(`${source.path}/pagination/page`, page);
      await fetchSource(sourceId);
    },
    [fetchSource, getSource, set],
  );

  const setSort = useCallback(
    async (
      sourceId: string,
      field: string,
      order: "asc" | "desc",
    ): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) return;
      update({
        [`${source.path}/sort/field`]: field,
        [`${source.path}/sort/order`]: order,
      });
      await fetchSource(sourceId);
    },
    [fetchSource, getSource, update],
  );

  const setFilters = useCallback(
    async (
      sourceId: string,
      filters: Record<string, unknown>,
    ): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) return;
      set(`${source.path}/filters`, filters);
      await fetchSource(sourceId);
    },
    [fetchSource, getSource, set],
  );

  const value = useMemo<DataSourceContextValue>(
    () => ({
      sources,
      getSource,
      fetchSource,
      createRecord,
      updateRecord,
      deleteRecord,
      refetchSource,
      setPage,
      setSort,
      setFilters,
    }),
    [
      sources,
      getSource,
      fetchSource,
      createRecord,
      updateRecord,
      deleteRecord,
      refetchSource,
      setPage,
      setSort,
      setFilters,
    ],
  );

  useEffect(() => {
    for (const source of sources) {
      if (source.autoFetch?.onMount) {
        void fetchSource(source.id);
      }
    }
  }, [sources, fetchSource]);

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}
