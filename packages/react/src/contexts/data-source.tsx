"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { getByPath, type DataSource } from "@json-render/core";
import { useData } from "./data";

export interface DataSourceContextValue {
  sources: DataSource[];
  getSource: (sourceId: string) => DataSource | undefined;
  fetchSource: (
    sourceId: string,
    params?: Record<string, unknown>,
  ) => Promise<void>;
  createRecord: (
    sourceId: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  updateRecord: (
    sourceId: string,
    id: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ) => Promise<unknown>;
  deleteRecord: (
    sourceId: string,
    id: string,
    params?: Record<string, unknown>,
  ) => Promise<void>;
  refetchSource: (sourceId: string) => Promise<void>;
  setPage: (sourceId: string, page: number) => Promise<void>;
  setSort: (
    sourceId: string,
    field: string,
    order: "asc" | "desc",
  ) => Promise<void>;
  setFilters: (
    sourceId: string,
    filters: Record<string, unknown>,
  ) => Promise<void>;
}

export const DataSourceContext = createContext<DataSourceContextValue | null>(
  null,
);

export interface DataSourceProviderProps {
  sources: DataSource[];
  children: ReactNode;
}

function normalizeTemplatePath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
}

function buildUrlTemplate(
  urlTemplate: string,
  readPath: (path: string) => unknown,
  params?: Record<string, unknown>,
): string {
  let url = urlTemplate;

  url = url.replace(/:(\w+)/g, (_, rawKey: string) => {
    const replacement = params?.[rawKey];
    return encodeURIComponent(String(replacement ?? ""));
  });

  url = url.replace(/\$\{([^}]+)\}/g, (_, rawPath: string) => {
    const value = readPath(normalizeTemplatePath(rawPath));
    return encodeURIComponent(String(value ?? ""));
  });

  return url;
}

function applyTransform(result: unknown, transform?: string): unknown {
  if (!transform) {
    return result;
  }
  try {
    const fn = new Function("value", `return (${transform})(value);`) as (
      value: unknown,
    ) => unknown;
    return fn(result);
  } catch {
    return result;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function DataSourceProvider({
  sources,
  children,
}: DataSourceProviderProps) {
  const { get, set, update } = useData();
  const lastFetchParamsRef = useRef<Record<string, Record<string, unknown>>>(
    {},
  );

  const getSource = useCallback(
    (sourceId: string): DataSource | undefined =>
      sources.find((source) => source.id === sourceId),
    [sources],
  );

  const buildListUrl = useCallback(
    (
      source: DataSource,
      requestParams?: Record<string, unknown>,
      previousParams?: Record<string, unknown>,
    ): string => {
      const listApi = source.api.list;
      if (!listApi) {
        return "";
      }

      const mergedParams = {
        ...(previousParams ?? {}),
        ...(requestParams ?? {}),
      };

      let url = buildUrlTemplate(listApi.url, get, mergedParams);
      const query = new URLSearchParams();

      if (listApi.pagination) {
        const page =
          (mergedParams.page as number | undefined) ??
          (get(`${source.path}/pagination/page`) as number | undefined) ??
          1;
        const pageSize =
          (mergedParams.pageSize as number | undefined) ??
          (get(`${source.path}/pagination/pageSize`) as number | undefined) ??
          10;

        if (listApi.pagination.pageParam) {
          query.set(listApi.pagination.pageParam, String(page));
        }
        if (listApi.pagination.pageSizeParam) {
          query.set(listApi.pagination.pageSizeParam, String(pageSize));
        }
      }

      if (listApi.sort) {
        const sortField =
          (mergedParams.sortField as string | undefined) ??
          (get(`${source.path}/sort/field`) as string | undefined);
        const sortOrder =
          (mergedParams.sortOrder as "asc" | "desc" | undefined) ??
          (get(`${source.path}/sort/order`) as "asc" | "desc" | undefined);

        if (sortField) {
          query.set(listApi.sort.fieldParam, sortField);
        }
        if (sortOrder) {
          query.set(listApi.sort.orderParam, sortOrder);
        }
      }

      if (listApi.filters) {
        const filters =
          (mergedParams.filters as Record<string, unknown> | undefined) ??
          (get(`${source.path}/filters`) as
            | Record<string, unknown>
            | undefined);

        if (filters) {
          for (const [field, queryName] of Object.entries(
            listApi.filters.params,
          )) {
            const value = filters[field];
            if (value !== undefined && value !== null && value !== "") {
              query.set(queryName, String(value));
            }
          }
        }
      }

      if (query.size > 0) {
        const separator = url.includes("?") ? "&" : "?";
        url += `${separator}${query.toString()}`;
      }

      return url;
    },
    [get],
  );

  const fetchSource = useCallback(
    async (
      sourceId: string,
      params?: Record<string, unknown>,
    ): Promise<void> => {
      const source = getSource(sourceId);
      if (!source?.api.list) {
        return;
      }

      const path = source.path;
      const prevParams = lastFetchParamsRef.current[sourceId];
      const mergedParams = {
        ...(prevParams ?? {}),
        ...(params ?? {}),
      };
      lastFetchParamsRef.current[sourceId] = mergedParams;

      set(`${path}/loading`, true);
      set(`${path}/error`, null);

      try {
        const listApi = source.api.list;
        const response = await fetch(buildListUrl(source, params, prevParams), {
          method: listApi.method,
          headers: {
            "Content-Type": "application/json",
            ...(listApi.headers ?? {}),
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const rawResult = await parseResponse(response);
        const result = applyTransform(rawResult, listApi.transform);

        if (listApi.pagination) {
          const items = listApi.pagination.itemsPath
            ? getByPath(result, listApi.pagination.itemsPath)
            : result;
          const total = listApi.pagination.totalPath
            ? getByPath(result, listApi.pagination.totalPath)
            : Array.isArray(items)
              ? items.length
              : 0;

          update({
            [`${path}/data`]: items ?? [],
            [`${path}/pagination/total`]: Number(total ?? 0),
            [`${path}/lastUpdated`]: Date.now(),
          });
        } else {
          update({
            [`${path}/data`]: result,
            [`${path}/lastUpdated`]: Date.now(),
          });
        }
      } catch (error) {
        set(`${path}/error`, (error as Error).message);
      } finally {
        set(`${path}/loading`, false);
      }
    },
    [buildListUrl, getSource, set, update],
  );

  const createRecord = useCallback(
    async (
      sourceId: string,
      dataArg?: unknown,
      params?: Record<string, unknown>,
    ): Promise<unknown> => {
      const source = getSource(sourceId);
      if (!source?.api.create) {
        throw new Error(`Create API not configured for source: ${sourceId}`);
      }

      const api = source.api.create;
      const body = dataArg ?? (api.bodyPath ? get(api.bodyPath) : undefined);

      const response = await fetch(buildUrlTemplate(api.url, get, params), {
        method: api.method,
        headers: {
          "Content-Type": "application/json",
          ...(api.headers ?? {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await parseResponse(response);

      if (source.refetchOn?.includes("create")) {
        await fetchSource(sourceId);
      }

      return result;
    },
    [fetchSource, get, getSource],
  );

  const updateRecord = useCallback(
    async (
      sourceId: string,
      id: string,
      dataArg?: unknown,
      params?: Record<string, unknown>,
    ): Promise<unknown> => {
      const source = getSource(sourceId);
      if (!source?.api.update) {
        throw new Error(`Update API not configured for source: ${sourceId}`);
      }

      const api = source.api.update;
      const body = dataArg ?? (api.bodyPath ? get(api.bodyPath) : undefined);

      const response = await fetch(
        buildUrlTemplate(api.url, get, { ...(params ?? {}), id }),
        {
          method: api.method,
          headers: {
            "Content-Type": "application/json",
            ...(api.headers ?? {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await parseResponse(response);

      if (source.refetchOn?.includes("update")) {
        await fetchSource(sourceId);
      }

      return result;
    },
    [fetchSource, get, getSource],
  );

  const deleteRecord = useCallback(
    async (
      sourceId: string,
      id: string,
      params?: Record<string, unknown>,
    ): Promise<void> => {
      const source = getSource(sourceId);
      if (!source?.api.delete) {
        throw new Error(`Delete API not configured for source: ${sourceId}`);
      }

      const api = source.api.delete;
      const response = await fetch(
        buildUrlTemplate(api.url, get, { ...(params ?? {}), id }),
        {
          method: api.method,
          headers: api.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (source.refetchOn?.includes("delete")) {
        await fetchSource(sourceId);
      }
    },
    [fetchSource, get, getSource],
  );

  const refetchSource = useCallback(
    async (sourceId: string): Promise<void> => {
      await fetchSource(sourceId, lastFetchParamsRef.current[sourceId]);
    },
    [fetchSource],
  );

  const setPage = useCallback(
    async (sourceId: string, page: number): Promise<void> => {
      const source = getSource(sourceId);
      if (!source) return;
      set(`${source.path}/pagination/page`, page);
      await fetchSource(sourceId, { page });
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
      await fetchSource(sourceId, { sortField: field, sortOrder: order });
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
      await fetchSource(sourceId, { filters });
    },
    [fetchSource, getSource, set],
  );

  useEffect(() => {
    for (const source of sources) {
      if (source.autoFetch?.onMount) {
        void fetchSource(source.id);
      }
    }
  }, [sources, fetchSource]);

  useEffect(() => {
    const cleanup: Array<() => void> = [];

    for (const source of sources) {
      const interval = source.autoFetch?.pollingInterval;
      if (interval && interval > 0) {
        const timer = window.setInterval(() => {
          void fetchSource(source.id);
        }, interval);
        cleanup.push(() => window.clearInterval(timer));
      }
    }

    return () => {
      for (const fn of cleanup) {
        fn();
      }
    };
  }, [sources, fetchSource]);

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

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSourceContextValue {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error("useDataSource must be used within a DataSourceProvider");
  }
  return context;
}

export function useOptionalDataSource(): DataSourceContextValue | null {
  return useContext(DataSourceContext);
}
