import {
  evaluateVisibility,
  type Action,
  type ActionHandler,
  type ActionRuntimeContext,
  type DataModel,
  type VisibilityCondition,
} from "@json-render/core";
import type { DataSourceContextValue } from "./data-source";

export interface MetaActionHandlersContext {
  getDataModel: () => DataModel;
  set: (path: string, value: unknown) => void;
  update: (updates: Record<string, unknown>) => void;
  execute: (action: Action, runtime?: ActionRuntimeContext) => Promise<void>;
  dataSource?: DataSourceContextValue | null;
  onToast?: (payload: { message: string; type: string }) => void;
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

function buildRuntimeDataModel(
  dataModel: DataModel,
  runtime?: ActionRuntimeContext,
): DataModel {
  if (!runtime) return dataModel;
  return {
    ...dataModel,
    ...runtime,
  };
}

function emitToast(
  message: string,
  type: string,
  onToast?: (payload: { message: string; type: string }) => void,
): void {
  onToast?.({ message, type });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("json-render:toast", {
        detail: {
          message,
          type,
        },
      }),
    );
  }

  if (typeof console !== "undefined") {
    const method =
      type === "error" ? "error" : type === "warning" ? "warn" : "log";
    console[method](`[json-render:${type}] ${message}`);
  }
}

export function createMetaActionHandlers(
  ctx: MetaActionHandlersContext,
): Record<string, ActionHandler> {
  const getDataSource = (): DataSourceContextValue | null => {
    if (!ctx.dataSource) {
      console.warn("Data source action called without DataSourceProvider");
      return null;
    }
    return ctx.dataSource;
  };

  return {
    setData: (params) => {
      const payload = params as Record<string, unknown>;
      const path = payload.path;
      if (typeof path !== "string") {
        return;
      }
      ctx.set(path, payload.value);
    },

    updateData: (params) => {
      const payload = params as Record<string, unknown>;
      const updates = payload.updates;
      if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        return;
      }
      ctx.update(updates as Record<string, unknown>);
    },

    sequence: async (params, handlerCtx) => {
      const payload = params as Record<string, unknown>;
      const actions = payload.actions;
      if (!Array.isArray(actions)) {
        return;
      }

      for (const candidate of actions) {
        if (isAction(candidate)) {
          await ctx.execute(candidate, handlerCtx?.runtime);
        }
      }
    },

    conditional: async (params, handlerCtx) => {
      const payload = params as Record<string, unknown>;
      const condition = payload.condition as VisibilityCondition | undefined;
      const thenAction = payload.then;
      const elseAction = payload.else;

      if (
        condition === undefined ||
        condition === null ||
        !isAction(thenAction)
      ) {
        return;
      }

      const runtimeDataModel = buildRuntimeDataModel(
        ctx.getDataModel(),
        handlerCtx?.runtime,
      );

      const pass = evaluateVisibility(condition, {
        dataModel: runtimeDataModel,
      });

      if (pass) {
        await ctx.execute(thenAction, handlerCtx?.runtime);
        return;
      }

      if (isAction(elseAction)) {
        await ctx.execute(elseAction, handlerCtx?.runtime);
      }
    },

    showToast: (params) => {
      const payload = params as Record<string, unknown>;
      const message = payload.message;
      if (typeof message !== "string" || message.length === 0) {
        return;
      }
      const type =
        typeof payload.type === "string" && payload.type.length > 0
          ? payload.type
          : "info";
      emitToast(message, type, ctx.onToast);
    },

    fetchSource: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      if (typeof sourceId !== "string") return;
      const requestParams =
        payload.params &&
        typeof payload.params === "object" &&
        !Array.isArray(payload.params)
          ? (payload.params as Record<string, unknown>)
          : undefined;
      await dataSource.fetchSource(sourceId, requestParams);
    },

    createRecord: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      if (typeof sourceId !== "string") return;
      await dataSource.createRecord(sourceId, payload.data);
    },

    updateRecord: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      const id = payload.id;
      if (typeof sourceId !== "string" || id === null || id === undefined) {
        return;
      }
      await dataSource.updateRecord(sourceId, String(id), payload.data);
    },

    deleteRecord: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      const id = payload.id;
      if (typeof sourceId !== "string" || id === null || id === undefined) {
        return;
      }
      await dataSource.deleteRecord(sourceId, String(id));
    },

    refetchSource: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      if (typeof sourceId !== "string") return;
      await dataSource.refetchSource(sourceId);
    },

    setPage: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      const page = payload.page;
      if (typeof sourceId !== "string" || typeof page !== "number") return;
      await dataSource.setPage(sourceId, page);
    },

    setSort: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      const field = payload.field;
      const order = payload.order;
      if (
        typeof sourceId !== "string" ||
        typeof field !== "string" ||
        (order !== "asc" && order !== "desc")
      ) {
        return;
      }
      await dataSource.setSort(sourceId, field, order);
    },

    setFilters: async (params) => {
      const dataSource = getDataSource();
      if (!dataSource) return;
      const payload = params as Record<string, unknown>;
      const sourceId = payload.sourceId;
      const filters = payload.filters;
      if (
        typeof sourceId !== "string" ||
        !filters ||
        typeof filters !== "object" ||
        Array.isArray(filters)
      ) {
        return;
      }
      await dataSource.setFilters(sourceId, filters as Record<string, unknown>);
    },
  };
}
