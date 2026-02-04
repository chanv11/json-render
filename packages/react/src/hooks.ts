"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  UITree,
  UIElement,
  JsonPatch,
  DataSource,
  GeneratedActionDefinition,
} from "@json-render/core";
import { setByPath } from "@json-render/core";

/**
 * Additional runtime payload for advanced generation protocols.
 */
export interface UIStreamRuntimePayload {
  uiTree?: UITree;
  dataSources?: DataSource[];
  initialData?: Record<string, unknown>;
  generatedActions?: Record<string, GeneratedActionDefinition>;
}

type ParsedStreamLine =
  | { kind: "patch"; patch: JsonPatch }
  | { kind: "runtime"; payload: UIStreamRuntimePayload }
  | null;

function isPatchMessage(value: unknown): value is JsonPatch {
  return (
    typeof value === "object" &&
    value !== null &&
    "op" in value &&
    "path" in value &&
    typeof (value as { op: unknown }).op === "string" &&
    typeof (value as { path: unknown }).path === "string"
  );
}

function isRuntimeMessage(value: unknown): value is UIStreamRuntimePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (
    "uiTree" in value ||
    "dataSources" in value ||
    "initialData" in value ||
    "generatedActions" in value
  );
}

/**
 * Parse a single JSON stream line.
 * Supports JSON Patch lines and optional runtime payload lines.
 */
function parseStreamLine(line: string): ParsedStreamLine {
  try {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return null;
    }
    const parsed = JSON.parse(trimmed) as unknown;
    if (isPatchMessage(parsed)) {
      return { kind: "patch", patch: parsed };
    }
    if (isRuntimeMessage(parsed)) {
      return { kind: "runtime", payload: parsed };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apply a JSON patch to the current tree
 */
function applyPatch(tree: UITree, patch: JsonPatch): UITree {
  const newTree = { ...tree, elements: { ...tree.elements } };

  switch (patch.op) {
    case "set":
    case "add":
    case "replace": {
      // Handle root path
      if (patch.path === "/root") {
        newTree.root = patch.value as string;
        return newTree;
      }

      // Handle elements paths
      if (patch.path.startsWith("/elements/")) {
        const pathParts = patch.path.slice("/elements/".length).split("/");
        const elementKey = pathParts[0];

        if (!elementKey) return newTree;

        if (pathParts.length === 1) {
          // Setting entire element
          newTree.elements[elementKey] = patch.value as UIElement;
        } else {
          // Setting property of element
          const element = newTree.elements[elementKey];
          if (element) {
            const propPath = "/" + pathParts.slice(1).join("/");
            const newElement = { ...element };
            setByPath(
              newElement as unknown as Record<string, unknown>,
              propPath,
              patch.value,
            );
            newTree.elements[elementKey] = newElement;
          }
        }
      }
      break;
    }
    case "remove": {
      if (patch.path.startsWith("/elements/")) {
        const elementKey = patch.path.slice("/elements/".length).split("/")[0];
        if (elementKey) {
          const { [elementKey]: _, ...rest } = newTree.elements;
          newTree.elements = rest;
        }
      }
      break;
    }
  }

  return newTree;
}

/**
 * Options for useUIStream
 */
export interface UseUIStreamOptions {
  /** API endpoint */
  api: string;
  /** Callback when complete */
  onComplete?: (tree: UITree) => void;
  /** Callback for runtime payload lines */
  onRuntime?: (payload: UIStreamRuntimePayload) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useUIStream
 */
export interface UseUIStreamReturn {
  /** Current UI tree */
  tree: UITree | null;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Error if any */
  error: Error | null;
  /** Send a prompt to generate UI */
  send: (prompt: string, context?: Record<string, unknown>) => Promise<void>;
  /** Clear the current tree */
  clear: () => void;
}

/**
 * Hook for streaming UI generation
 */
export function useUIStream({
  api,
  onComplete,
  onRuntime,
  onError,
}: UseUIStreamOptions): UseUIStreamReturn {
  const [tree, setTree] = useState<UITree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setTree(null);
    setError(null);
  }, []);

  const send = useCallback(
    async (prompt: string, context?: Record<string, unknown>) => {
      // Abort any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);

      // Start with previous tree if provided, otherwise empty tree
      const previousTree = context?.previousTree as UITree | undefined;
      let currentTree: UITree =
        previousTree && previousTree.root
          ? { ...previousTree, elements: { ...previousTree.elements } }
          : { root: "", elements: {} };
      setTree(currentTree);

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            context,
            currentTree,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          // Try to parse JSON error response for better error messages
          let errorMessage = `HTTP error: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // Ignore JSON parsing errors, use default message
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const message = parseStreamLine(line);
            if (!message) {
              continue;
            }
            if (message.kind === "patch") {
              currentTree = applyPatch(currentTree, message.patch);
              setTree({ ...currentTree });
              continue;
            }
            onRuntime?.(message.payload);
            if (message.payload.uiTree) {
              currentTree = message.payload.uiTree;
              setTree({ ...currentTree });
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const message = parseStreamLine(buffer);
          if (message?.kind === "patch") {
            currentTree = applyPatch(currentTree, message.patch);
            setTree({ ...currentTree });
          } else if (message?.kind === "runtime") {
            onRuntime?.(message.payload);
            if (message.payload.uiTree) {
              currentTree = message.payload.uiTree;
              setTree({ ...currentTree });
            }
          }
        }

        onComplete?.(currentTree);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsStreaming(false);
      }
    },
    [api, onComplete, onRuntime, onError],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    tree,
    isStreaming,
    error,
    send,
    clear,
  };
}

/**
 * Convert a flat element list to a UITree
 */
export function flatToTree(
  elements: Array<UIElement & { parentKey?: string | null }>,
): UITree {
  const elementMap: Record<string, UIElement> = {};
  let root = "";

  // First pass: add all elements to map
  for (const element of elements) {
    elementMap[element.key] = {
      key: element.key,
      type: element.type,
      props: element.props,
      children: [],
      visible: element.visible,
    };
  }

  // Second pass: build parent-child relationships
  for (const element of elements) {
    if (element.parentKey) {
      const parent = elementMap[element.parentKey];
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(element.key);
      }
    } else {
      root = element.key;
    }
  }

  return { root, elements: elementMap };
}
