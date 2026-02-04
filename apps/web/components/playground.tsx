"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Renderer,
  useUIStream,
  JSONUIProvider,
  type UIStreamRuntimePayload,
} from "@json-render/react";
import type {
  UITree,
  DataSource,
  GeneratedActionDefinition,
} from "@json-render/core";
import { collectUsedComponents, serializeProps } from "@json-render/codegen";
import { toast } from "sonner";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { Toaster } from "./ui/sonner";
import { Header } from "./header";
import {
  demoRegistry,
  fallbackComponent,
  useInteractiveState,
} from "./demo/index";

type Tab = "json" | "stream";
type RenderView = "preview" | "code";
type MobilePane = "chat" | "code" | "preview";

interface Version {
  id: string;
  prompt: string;
  runtime: PlaygroundRuntimeState;
  status: "generating" | "complete" | "error";
}

interface PlaygroundRuntimeState {
  uiTree: UITree | null;
  dataSources: DataSource[];
  initialData: Record<string, unknown>;
  generatedActions: Record<string, GeneratedActionDefinition>;
}

type DataSourceMode = "live" | "mock";

function createEmptyRuntimeState(): PlaygroundRuntimeState {
  return {
    uiTree: null,
    dataSources: [],
    initialData: {},
    generatedActions: {},
  };
}

function mergeRuntimePayload(
  runtime: PlaygroundRuntimeState,
  payload: UIStreamRuntimePayload,
): PlaygroundRuntimeState {
  return {
    uiTree: payload.uiTree ?? runtime.uiTree,
    dataSources: payload.dataSources ?? runtime.dataSources,
    initialData: payload.initialData ?? runtime.initialData,
    generatedActions: payload.generatedActions ?? runtime.generatedActions,
  };
}

const EXAMPLE_PROMPTS = [
  "Create a login form",
  "Build a pricing page",
  "Design a user profile card",
  "Make a contact form",
];

export function Playground() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [inputValue, setInputValue] = useState("");
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("json");
  const [renderView, setRenderView] = useState<RenderView>("preview");
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>("mock");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const versionsEndRef = useRef<HTMLDivElement>(null);

  // Track the currently generating version ID
  const generatingVersionIdRef = useRef<string | null>(null);

  // Track the current tree for use as previousTree in next generation
  const currentTreeRef = useRef<UITree | null>(null);

  const {
    tree: apiTree,
    isStreaming,
    send,
    clear,
  } = useUIStream({
    api: "/api/generate",
    onRuntime: (payload: UIStreamRuntimePayload) => {
      const generatingVersionId = generatingVersionIdRef.current;
      if (!generatingVersionId) {
        return;
      }

      setVersions((prev) =>
        prev.map((version) =>
          version.id === generatingVersionId
            ? {
                ...version,
                runtime: mergeRuntimePayload(version.runtime, payload),
              }
            : version,
        ),
      );
    },
    onError: (err: Error) => {
      console.error("Generation error:", err);
      toast.error(err.message || "Generation failed. Please try again.");
      // Mark the version as errored
      if (generatingVersionIdRef.current) {
        const erroredVersionId = generatingVersionIdRef.current;
        setVersions((prev) =>
          prev.map((v) =>
            v.id === erroredVersionId ? { ...v, status: "error" as const } : v,
          ),
        );
        generatingVersionIdRef.current = null;
      }
    },
  } as Parameters<typeof useUIStream>[0]);

  useInteractiveState();

  // Get the selected version
  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  // Determine which runtime state to display:
  // - If streaming and selected version is the generating one, uiTree follows apiTree
  // - Otherwise use the selected version's runtime snapshot
  const isSelectedVersionGenerating =
    selectedVersionId === generatingVersionIdRef.current && isStreaming;
  const hasValidApiTree =
    apiTree && apiTree.root && Object.keys(apiTree.elements).length > 0;
  const currentRuntime = useMemo<PlaygroundRuntimeState>(() => {
    const selectedRuntime =
      selectedVersion?.runtime ?? createEmptyRuntimeState();

    if (isSelectedVersionGenerating && hasValidApiTree) {
      return {
        ...selectedRuntime,
        uiTree: apiTree,
      };
    }

    if (isSelectedVersionGenerating && !selectedRuntime.uiTree && apiTree) {
      return {
        ...selectedRuntime,
        uiTree: apiTree,
      };
    }

    return selectedRuntime;
  }, [apiTree, hasValidApiTree, isSelectedVersionGenerating, selectedVersion]);

  const currentTree = currentRuntime.uiTree;

  // Keep the ref updated with the current tree for use in handleSubmit
  if (
    currentTree &&
    currentTree.root &&
    Object.keys(currentTree.elements).length > 0
  ) {
    currentTreeRef.current = currentTree;
  }

  // Scroll to bottom when versions change
  useEffect(() => {
    versionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [versions]);

  useEffect(() => {
    if (apiTree) {
      const streamLine = JSON.stringify({ tree: apiTree });
      if (
        !streamLines.includes(streamLine) &&
        Object.keys(apiTree.elements).length > 0
      ) {
        setStreamLines((prev) => {
          const lastLine = prev[prev.length - 1];
          if (lastLine !== streamLine) {
            return [...prev, streamLine];
          }
          return prev;
        });
      }
    }
  }, [apiTree, streamLines]);

  // Update version when streaming completes
  useEffect(() => {
    if (
      !isStreaming &&
      apiTree &&
      apiTree.root &&
      generatingVersionIdRef.current
    ) {
      const completedVersionId = generatingVersionIdRef.current;
      setVersions((prev) =>
        prev.map((v) =>
          v.id === completedVersionId
            ? {
                ...v,
                runtime: {
                  ...v.runtime,
                  uiTree: apiTree,
                },
                status: "complete" as const,
              }
            : v,
        ),
      );
      generatingVersionIdRef.current = null;
    }
  }, [isStreaming, apiTree]);

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;

    const newVersionId = Date.now().toString();
    const newVersion: Version = {
      id: newVersionId,
      prompt: inputValue.trim(),
      runtime: createEmptyRuntimeState(),
      status: "generating",
    };

    generatingVersionIdRef.current = newVersionId;
    setVersions((prev) => [...prev, newVersion]);
    setSelectedVersionId(newVersionId);
    setInputValue("");
    setStreamLines([]); // Reset stream lines for new generation

    // Pass the current tree as context so the API can iterate on it
    await send(inputValue.trim(), { previousTree: currentTreeRef.current });
  }, [inputValue, isStreaming, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  useEffect(() => {
    (
      window as unknown as { __demoAction?: (text: string) => void }
    ).__demoAction = (text: string) => {
      toast(text);
    };
    return () => {
      delete (window as unknown as { __demoAction?: (text: string) => void })
        .__demoAction;
    };
  }, []);

  const hasRuntimeSnapshot =
    Boolean(currentRuntime.uiTree) ||
    currentRuntime.dataSources.length > 0 ||
    Object.keys(currentRuntime.initialData).length > 0 ||
    Object.keys(currentRuntime.generatedActions).length > 0;

  const jsonCode = hasRuntimeSnapshot
    ? JSON.stringify(
        {
          uiTree: currentRuntime.uiTree,
          dataSources: currentRuntime.dataSources,
          initialData: currentRuntime.initialData,
          generatedActions: currentRuntime.generatedActions,
        },
        null,
        2,
      )
    : "// waiting...";

  const generatedCode = useMemo(() => {
    if (!currentTree || !currentTree.root) {
      return "// Generate a UI to see the code";
    }

    const tree = currentTree;
    const components = collectUsedComponents(tree);

    function generateJSX(key: string, indent: number): string {
      const element = tree.elements[key];
      if (!element) return "";

      const spaces = "  ".repeat(indent);
      const componentName = element.type;

      const propsObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(element.props)) {
        if (v !== null && v !== undefined) {
          propsObj[k] = v;
        }
      }

      const propsStr = serializeProps(propsObj);
      const hasChildren = element.children && element.children.length > 0;

      if (!hasChildren) {
        return propsStr
          ? `${spaces}<${componentName} ${propsStr} />`
          : `${spaces}<${componentName} />`;
      }

      const lines: string[] = [];
      lines.push(
        propsStr
          ? `${spaces}<${componentName} ${propsStr}>`
          : `${spaces}<${componentName}>`,
      );

      for (const childKey of element.children!) {
        lines.push(generateJSX(childKey, indent + 1));
      }

      lines.push(`${spaces}</${componentName}>`);
      return lines.join("\n");
    }

    const jsx = generateJSX(tree.root, 2);
    const imports = Array.from(components).sort().join(", ");

    return `"use client";

import { ${imports} } from "@/components/ui";

export default function Page() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
${jsx}
    </div>
  );
}`;
  }, [currentTree]);

  // Chat pane content
  const chatPane = (
    <div className="h-full flex flex-col border-t border-border">
      <div className="border-b border-border px-3 h-9 flex items-center">
        <span className="text-xs font-mono text-muted-foreground">
          versions
        </span>
      </div>
      <div
        className={`flex-1 p-2 min-h-0 ${versions.length > 0 ? "overflow-y-auto space-y-1" : "flex"}`}
      >
        {versions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you want to build, then iterate on it.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInputValue(prompt);
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(
                          prompt.length,
                          prompt.length,
                        );
                      }
                    }, 0);
                  }}
                  className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          versions.map((version, index) => (
            <button
              key={version.id}
              onClick={() => setSelectedVersionId(version.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedVersionId === version.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground/70 shrink-0">
                  v{index + 1}
                </span>
                <span className="truncate flex-1">{version.prompt}</span>
                {version.status === "generating" && (
                  <span className="text-xs text-muted-foreground shrink-0 animate-pulse">
                    ...
                  </span>
                )}
                {version.status === "error" && (
                  <span className="text-xs text-red-500 shrink-0">failed</span>
                )}
              </div>
            </button>
          ))
        )}
        <div ref={versionsEndRef} />
      </div>
      <div
        className="border-t border-border p-3 cursor-text"
        onMouseDown={(e) => {
          // Focus textarea unless clicking a button or the textarea itself
          const target = e.target as HTMLElement;
          if (!target.closest("button") && target.tagName !== "TEXTAREA") {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe changes..."
          className="w-full bg-background text-base sm:text-sm resize-none outline-none placeholder:text-muted-foreground/50"
          rows={2}
        />
        <div className="flex justify-between items-center mt-2">
          {versions.length > 0 ? (
            <button
              onClick={() => {
                setVersions([]);
                setSelectedVersionId(null);
                setStreamLines([]);
                currentTreeRef.current = null;
                clear();
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          ) : (
            <div />
          )}
          {isStreaming ? (
            <button
              onClick={() => clear()}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              aria-label="Stop"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30"
              aria-label="Send"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Code pane content
  const codePane = (
    <div className="h-full flex flex-col border-t border-border">
      <div className="border-b border-border px-3 h-9 flex items-center gap-3">
        {(["json", "stream"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs font-mono transition-colors ${
              activeTab === tab
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="flex-1" />
        <CopyButton
          text={activeTab === "stream" ? streamLines.join("\n") : jsonCode}
          className="text-muted-foreground"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {activeTab === "stream" ? (
          streamLines.length > 0 ? (
            <CodeBlock
              code={streamLines.join("\n")}
              lang="json"
              fillHeight
              hideCopyButton
            />
          ) : (
            <div className="text-muted-foreground/50 p-3 text-sm font-mono">
              {isStreaming ? "streaming..." : "// waiting for generation"}
            </div>
          )
        ) : (
          <CodeBlock code={jsonCode} lang="json" fillHeight hideCopyButton />
        )}
      </div>
    </div>
  );

  // Preview pane content
  const previewPane = (
    <div className="h-full flex flex-col border-t border-border">
      <div className="border-b border-border px-3 h-9 flex items-center gap-3">
        {(
          [
            { key: "preview", label: "preview" },
            { key: "code", label: "code" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRenderView(key)}
            className={`text-xs font-mono transition-colors ${
              renderView === key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        {renderView === "preview" && currentRuntime.dataSources.length > 0 && (
          <div className="inline-flex rounded border border-border overflow-hidden">
            {(["mock", "live"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDataSourceMode(mode)}
                className={`px-2 py-1 text-[11px] font-mono transition-colors ${
                  dataSourceMode === mode
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        )}
        {renderView === "code" && (
          <CopyButton text={generatedCode} className="text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {renderView === "preview" ? (
          currentTree && currentTree.root ? (
            <div className="w-full min-h-full flex items-center justify-center p-6">
              <JSONUIProvider
                registry={
                  demoRegistry as Parameters<
                    typeof JSONUIProvider
                  >[0]["registry"]
                }
                initialData={currentRuntime.initialData}
                dataSources={currentRuntime.dataSources}
                dataSourceMode={dataSourceMode}
                generatedActions={currentRuntime.generatedActions}
                onToast={({ message, type }) => {
                  if (type === "success") {
                    toast.success(message);
                    return;
                  }
                  if (type === "error") {
                    toast.error(message);
                    return;
                  }
                  if (type === "warning") {
                    toast.warning(message);
                    return;
                  }
                  toast(message);
                }}
              >
                <Renderer
                  tree={currentTree!}
                  registry={
                    demoRegistry as Parameters<typeof Renderer>[0]["registry"]
                  }
                  loading={isStreaming}
                  fallback={
                    fallbackComponent as Parameters<
                      typeof Renderer
                    >[0]["fallback"]
                  }
                />
              </JSONUIProvider>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
              {isStreaming
                ? "generating..."
                : "// enter a prompt to generate UI"}
            </div>
          )
        ) : (
          <CodeBlock
            code={generatedCode}
            lang="tsx"
            fillHeight
            hideCopyButton
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <Header />

      {/* Desktop: 3-pane resizable layout */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <ResizablePanelGroup className="flex-1">
          <ResizablePanel defaultSize={25} minSize={15}>
            {chatPane}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={35} minSize={20}>
            {codePane}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={40} minSize={20}>
            {previewPane}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile: Single pane with bottom tabs */}
      <div className="flex lg:hidden flex-col flex-1 min-h-0">
        {/* Panes - all in DOM, visibility controlled */}
        <div className="flex-1 min-h-0 relative">
          <div
            className={`absolute inset-0 ${mobilePane === "chat" ? "" : "invisible"}`}
          >
            {chatPane}
          </div>
          <div
            className={`absolute inset-0 ${mobilePane === "code" ? "" : "invisible"}`}
          >
            {codePane}
          </div>
          <div
            className={`absolute inset-0 ${mobilePane === "preview" ? "" : "invisible"}`}
          >
            {previewPane}
          </div>
        </div>

        {/* Bottom tab bar */}
        <div className="border-t border-border flex shrink-0">
          {(
            [
              {
                key: "chat",
                label: "Chat",
                icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
              },
              {
                key: "code",
                label: "Code",
                icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
              },
              {
                key: "preview",
                label: "Preview",
                icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
              },
            ] as const
          ).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setMobilePane(key)}
              className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                mobilePane === key ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <Toaster position="bottom-right" />
    </div>
  );
}
