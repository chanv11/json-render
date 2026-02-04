import { z } from "zod";
import type { DataModel } from "./types";
import { getByPath } from "./types";

/**
 * Runtime values available while executing actions.
 * Keys follow the "$*" convention to support path lookups like "/$event/value".
 */
export interface ActionRuntimeContext {
  $event?: Record<string, unknown>;
  $row?: Record<string, unknown>;
  $error?: unknown;
  [key: `$${string}`]: unknown;
}

/**
 * Confirmation dialog configuration
 */
export interface ActionConfirm {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
}

/**
 * Legacy callback shapes (kept for backwards compatibility)
 */
export type LegacyActionOnSuccess =
  | { navigate: string }
  | { set: Record<string, unknown> }
  | { action: string };

export type LegacyActionOnError =
  | { set: Record<string, unknown> }
  | { action: string };

/**
 * Rich action definition
 */
export interface Action {
  /** Action name (meta action or host-defined action) */
  name: string;
  /** Parameters to pass to the action handler */
  params?: Record<string, unknown>;
  /** Confirmation dialog before execution */
  confirm?: ActionConfirm;
  /** Handler after successful execution */
  onSuccess?: ActionOnSuccess;
  /** Handler after failed execution */
  onError?: ActionOnError;
}

/**
 * AI-generated action definition, composed from meta actions.
 */
export interface GeneratedActionDefinition {
  description: string;
  composed: Action;
  implementation?: string;
}

/**
 * Callback types now support nested actions.
 */
export type ActionOnSuccess = LegacyActionOnSuccess | Action;
export type ActionOnError = LegacyActionOnError | Action;

/**
 * Schema for action confirmation
 */
export const ActionConfirmSchema = z.object({
  title: z.string(),
  message: z.string(),
  confirmLabel: z.string().optional(),
  cancelLabel: z.string().optional(),
  variant: z.enum(["default", "danger"]).optional(),
});

const LegacyActionOnSuccessSchema = z.union([
  z.object({ navigate: z.string() }),
  z.object({ set: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.string() }),
]);

const LegacyActionOnErrorSchema = z.union([
  z.object({ set: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.string() }),
]);

/**
 * JSON-like schema for action params.
 */
const ActionParamValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(ActionParamValueSchema),
    z.record(z.string(), ActionParamValueSchema),
  ]),
);

/**
 * Full action schema (recursive)
 */
export const ActionSchema: z.ZodType<Action> = z.lazy(() =>
  z.object({
    name: z.string(),
    params: z.record(z.string(), ActionParamValueSchema).optional(),
    confirm: ActionConfirmSchema.optional(),
    onSuccess: ActionOnSuccessSchema.optional(),
    onError: ActionOnErrorSchema.optional(),
  }),
) as z.ZodType<Action>;

/**
 * Schema for callbacks (legacy callback or nested action)
 */
export const ActionOnSuccessSchema: z.ZodType<ActionOnSuccess> = z.lazy(() =>
  z.union([LegacyActionOnSuccessSchema, ActionSchema]),
) as z.ZodType<ActionOnSuccess>;

export const ActionOnErrorSchema: z.ZodType<ActionOnError> = z.lazy(() =>
  z.union([LegacyActionOnErrorSchema, ActionSchema]),
) as z.ZodType<ActionOnError>;

/**
 * Unified callback schema export.
 */
export const ActionCallbackSchema = z.union([
  ActionOnSuccessSchema,
  ActionOnErrorSchema,
]);

/**
 * Schema for generated action definitions.
 */
export const GeneratedActionDefinitionSchema: z.ZodType<GeneratedActionDefinition> =
  z.object({
    description: z.string(),
    composed: ActionSchema,
    implementation: z.string().optional(),
  }) as z.ZodType<GeneratedActionDefinition>;

/**
 * Action handler function signature
 */
export interface ActionHandlerContext {
  runtime?: ActionRuntimeContext;
}

export type ActionHandler<
  TParams = Record<string, unknown>,
  TResult = unknown,
> = (
  params: TParams,
  context?: ActionHandlerContext,
) => Promise<TResult> | TResult;

/**
 * Action definition in catalog
 */
export interface ActionDefinition<TParams = Record<string, unknown>> {
  /** Zod schema for params validation */
  params?: z.ZodType<TParams>;
  /** Description for AI */
  description?: string;
}

/**
 * Resolved action with all dynamic/template values resolved
 */
export interface ResolvedAction {
  name: string;
  params: Record<string, unknown>;
  confirm?: ActionConfirm;
  onSuccess?: ActionOnSuccess;
  onError?: ActionOnError;
}

function normalizePath(path: string): string {
  if (!path) return path;
  if (path.startsWith("/")) return path;
  if (path.startsWith("$")) {
    return `/${path.replace(/\./g, "/")}`;
  }
  return path.includes("/") ? `/${path}` : `/${path}`;
}

function resolvePath(path: string, dataModel: DataModel): unknown {
  return getByPath(dataModel, normalizePath(path));
}

function isPathRef(value: unknown): value is { path: string } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entries = Object.entries(value);
  return (
    entries.length === 1 &&
    entries[0]?.[0] === "path" &&
    typeof entries[0][1] === "string"
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

function resolveValue(value: unknown, dataModel: DataModel): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.includes("${")) {
      return interpolateString(value, dataModel);
    }
    if (value === "$error.message") {
      const message = resolvePath("$error.message", dataModel);
      if (typeof message === "string") {
        return message;
      }
    }
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (isPathRef(value)) {
    return resolvePath(value.path, dataModel);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, dataModel));
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    resolved[key] = resolveValue(nested, dataModel);
  }
  return resolved;
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

function isNavigateCallback(
  callback: ActionOnSuccess | ActionOnError,
): callback is { navigate: string } {
  return "navigate" in callback;
}

function isSetCallback(
  callback: ActionOnSuccess | ActionOnError,
): callback is { set: Record<string, unknown> } {
  return "set" in callback;
}

function isActionNameCallback(
  callback: ActionOnSuccess | ActionOnError,
): callback is { action: string } {
  return "action" in callback;
}

/**
 * Resolve all dynamic values in an action.
 */
export function resolveAction(
  action: Action,
  dataModel: DataModel,
  runtime?: ActionRuntimeContext,
): ResolvedAction {
  const runtimeDataModel = buildRuntimeDataModel(dataModel, runtime);
  const resolvedParams: Record<string, unknown> = {};

  if (action.params) {
    for (const [key, value] of Object.entries(action.params)) {
      resolvedParams[key] = resolveValue(value, runtimeDataModel);
    }
  }

  let confirm = action.confirm;
  if (confirm) {
    confirm = {
      ...confirm,
      message: interpolateString(confirm.message, runtimeDataModel),
      title: interpolateString(confirm.title, runtimeDataModel),
    };
  }

  return {
    name: action.name,
    params: resolvedParams,
    confirm,
    onSuccess: action.onSuccess,
    onError: action.onError,
  };
}

/**
 * Interpolate ${path} expressions in a string.
 */
export function interpolateString(
  template: string,
  dataModel: DataModel,
): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, rawPath: string) => {
    const value = resolvePath(rawPath, dataModel);
    return String(value ?? "");
  });
}

/**
 * Context for action execution
 */
export interface ActionExecutionContext {
  /** The resolved action */
  action: ResolvedAction;
  /** The action handler from the host */
  handler: ActionHandler;
  /** Current runtime values */
  runtime?: ActionRuntimeContext;
  /** Function to read latest data model for callback interpolation */
  getDataModel?: () => DataModel;
  /** Function to update data model */
  setData: (path: string, value: unknown) => void;
  /** Function to navigate */
  navigate?: (path: string) => void;
  /** Function to execute another action */
  executeAction?: (
    action: Action | string,
    runtime?: ActionRuntimeContext,
  ) => Promise<void>;
}

async function runActionCallback(
  callback: ActionOnSuccess | ActionOnError | undefined,
  ctx: ActionExecutionContext,
  runtime?: ActionRuntimeContext,
): Promise<void> {
  if (!callback) {
    return;
  }

  if (isAction(callback)) {
    await ctx.executeAction?.(callback, runtime);
    return;
  }

  const runtimeDataModel = buildRuntimeDataModel(
    ctx.getDataModel?.() ?? {},
    runtime,
  );

  if (isNavigateCallback(callback) && ctx.navigate) {
    const path = interpolateString(callback.navigate, runtimeDataModel);
    ctx.navigate(path);
    return;
  }

  if (isSetCallback(callback)) {
    for (const [path, value] of Object.entries(callback.set)) {
      const resolvedValue = resolveValue(value, runtimeDataModel);
      ctx.setData(path, resolvedValue);
    }
    return;
  }

  if (isActionNameCallback(callback) && ctx.executeAction) {
    const actionName = interpolateString(callback.action, runtimeDataModel);
    await ctx.executeAction(actionName, runtime);
  }
}

/**
 * Execute an action with all callbacks.
 */
export async function executeAction(
  ctx: ActionExecutionContext,
): Promise<void> {
  const { action, handler, runtime } = ctx;

  try {
    await handler(action.params, { runtime });
    await runActionCallback(action.onSuccess, ctx, runtime);
  } catch (error) {
    if (!action.onError) {
      throw error;
    }

    const runtimeWithError: ActionRuntimeContext = {
      ...(runtime ?? {}),
      $error: error,
    };

    await runActionCallback(action.onError, ctx, runtimeWithError);
  }
}

/**
 * Helper to create actions.
 */
export const action = {
  /** Create a simple action */
  simple: (name: string, params?: Record<string, unknown>): Action => ({
    name,
    params,
  }),

  /** Create an action with confirmation */
  withConfirm: (
    name: string,
    confirm: ActionConfirm,
    params?: Record<string, unknown>,
  ): Action => ({
    name,
    params,
    confirm,
  }),

  /** Create an action with success handler */
  withSuccess: (
    name: string,
    onSuccess: ActionOnSuccess,
    params?: Record<string, unknown>,
  ): Action => ({
    name,
    params,
    onSuccess,
  }),
};
