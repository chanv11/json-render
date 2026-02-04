"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  resolveAction,
  executeAction as executeResolvedAction,
  type Action,
  type ActionRuntimeContext,
  type ActionHandler,
  type ActionConfirm,
  type GeneratedActionDefinition,
  type ResolvedAction,
} from "@json-render/core";
import { useData } from "./data";
import { createMetaActionHandlers } from "./meta-actions";
import { useOptionalDataSource } from "./data-source";

/**
 * Pending confirmation state
 */
export interface PendingConfirmation {
  /** The resolved action */
  action: ResolvedAction;
  /** The action handler */
  handler: ActionHandler;
  /** Runtime context when the action was triggered */
  runtime?: ActionRuntimeContext;
  /** Resolve callback */
  resolve: () => void;
  /** Reject callback */
  reject: () => void;
}

/**
 * Action context value
 */
export interface ActionContextValue {
  /** Registered action handlers */
  handlers: Record<string, ActionHandler>;
  /** Currently loading action names */
  loadingActions: Set<string>;
  /** Pending confirmation dialog */
  pendingConfirmation: PendingConfirmation | null;
  /** Execute an action */
  execute: (action: Action, runtime?: ActionRuntimeContext) => Promise<void>;
  /** Confirm the pending action */
  confirm: () => void;
  /** Cancel the pending action */
  cancel: () => void;
  /** Register an action handler */
  registerHandler: (name: string, handler: ActionHandler) => void;
}

const ActionContext = createContext<ActionContextValue | null>(null);

/**
 * Props for ActionProvider
 */
export interface ActionProviderProps {
  /** Initial action handlers */
  handlers?: Record<string, ActionHandler>;
  /** Navigation function */
  navigate?: (path: string) => void;
  /** Whether built-in meta actions are enabled */
  enableMetaActions?: boolean;
  /** Optional toast bridge for showToast meta action */
  onToast?: (payload: { message: string; type: string }) => void;
  /** AI generated composed actions, indexed by action name */
  generatedActions?: Record<string, GeneratedActionDefinition>;
  children: ReactNode;
}

/**
 * Provider for action execution
 */
export function ActionProvider({
  handlers: initialHandlers = {},
  navigate,
  enableMetaActions = true,
  onToast,
  generatedActions = {},
  children,
}: ActionProviderProps) {
  const { data, set, update } = useData();
  const dataSource = useOptionalDataSource();
  const [handlers, setHandlers] =
    useState<Record<string, ActionHandler>>(initialHandlers);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const executeRef = useRef<ActionContextValue["execute"] | null>(null);

  const registerHandler = useCallback(
    (name: string, handler: ActionHandler) => {
      setHandlers((prev) => ({ ...prev, [name]: handler }));
    },
    [],
  );

  const metaHandlers = useMemo<Record<string, ActionHandler>>(() => {
    if (!enableMetaActions) {
      return {};
    }
    return createMetaActionHandlers({
      getDataModel: () => data,
      set,
      update,
      execute: async (action, runtime) => {
        await executeRef.current?.(action, runtime);
      },
      dataSource,
      onToast,
    });
  }, [enableMetaActions, data, set, update, dataSource, onToast]);

  const generatedActionHandlers = useMemo<Record<string, ActionHandler>>(
    () =>
      Object.fromEntries(
        Object.entries(generatedActions).map(([name, definition]) => [
          name,
          async (_params: Record<string, unknown>, handlerContext) => {
            await executeRef.current?.(
              definition.composed,
              handlerContext?.runtime,
            );
          },
        ]),
      ),
    [generatedActions],
  );

  const allHandlers = useMemo(
    () => ({
      ...metaHandlers,
      ...generatedActionHandlers,
      ...handlers,
    }),
    [metaHandlers, generatedActionHandlers, handlers],
  );

  const runResolvedAction = useCallback(
    async (resolved: ResolvedAction, runtime?: ActionRuntimeContext) => {
      const handler = allHandlers[resolved.name];

      if (!handler) {
        console.warn(`No handler registered for action: ${resolved.name}`);
        return;
      }

      setLoadingActions((prev) => new Set(prev).add(resolved.name));
      try {
        await executeResolvedAction({
          action: resolved,
          handler,
          runtime,
          getDataModel: () => data,
          setData: set,
          navigate,
          executeAction: async (nextAction, nextRuntime) => {
            if (typeof nextAction === "string") {
              const subAction: Action = { name: nextAction };
              await executeRef.current?.(subAction, nextRuntime ?? runtime);
              return;
            }
            await executeRef.current?.(nextAction, nextRuntime ?? runtime);
          },
        });
      } finally {
        setLoadingActions((prev) => {
          const next = new Set(prev);
          next.delete(resolved.name);
          return next;
        });
      }
    },
    [allHandlers, data, set, navigate],
  );

  const execute = useCallback(
    async (action: Action, runtime?: ActionRuntimeContext) => {
      const resolved = resolveAction(action, data, runtime);
      const handler = allHandlers[resolved.name];

      if (!handler) {
        console.warn(`No handler registered for action: ${resolved.name}`);
        return;
      }

      // If confirmation is required, show dialog
      if (resolved.confirm) {
        return new Promise<void>((resolve, reject) => {
          setPendingConfirmation({
            action: resolved,
            handler,
            runtime,
            resolve: () => {
              setPendingConfirmation(null);
              resolve();
            },
            reject: () => {
              setPendingConfirmation(null);
              reject(new Error("Action cancelled"));
            },
          });
        }).then(async () => {
          await runResolvedAction(resolved, runtime);
        });
      }

      await runResolvedAction(resolved, runtime);
    },
    [data, allHandlers, runResolvedAction],
  );

  executeRef.current = execute;

  const confirm = useCallback(() => {
    pendingConfirmation?.resolve();
  }, [pendingConfirmation]);

  const cancel = useCallback(() => {
    pendingConfirmation?.reject();
  }, [pendingConfirmation]);

  const value = useMemo<ActionContextValue>(
    () => ({
      handlers: allHandlers,
      loadingActions,
      pendingConfirmation,
      execute,
      confirm,
      cancel,
      registerHandler,
    }),
    [
      allHandlers,
      loadingActions,
      pendingConfirmation,
      execute,
      confirm,
      cancel,
      registerHandler,
    ],
  );

  return (
    <ActionContext.Provider value={value}>{children}</ActionContext.Provider>
  );
}

/**
 * Hook to access action context
 */
export function useActions(): ActionContextValue {
  const ctx = useContext(ActionContext);
  if (!ctx) {
    throw new Error("useActions must be used within an ActionProvider");
  }
  return ctx;
}

/**
 * Hook to execute an action
 */
export function useAction(action: Action): {
  execute: () => Promise<void>;
  isLoading: boolean;
} {
  const { execute, loadingActions } = useActions();
  const isLoading = loadingActions.has(action.name);

  const executeAction = useCallback(() => execute(action), [execute, action]);

  return { execute: executeAction, isLoading };
}

/**
 * Props for ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** The confirmation config */
  confirm: ActionConfirm;
  /** Called when confirmed */
  onConfirm: () => void;
  /** Called when cancelled */
  onCancel: () => void;
}

/**
 * Default confirmation dialog component
 */
export function ConfirmDialog({
  confirm,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = confirm.variant === "danger";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          {confirm.title}
        </h3>
        <p
          style={{
            margin: "0 0 24px 0",
            color: "#6b7280",
          }}
        >
          {confirm.message}
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            {confirm.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: isDanger ? "#dc2626" : "#3b82f6",
              color: "white",
              cursor: "pointer",
            }}
          >
            {confirm.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
