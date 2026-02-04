import { generateText, streamText } from "ai";
import {
  DataSourceSchema,
  GeneratedActionDefinitionSchema,
  getByPath,
  generateSystemPrompt,
} from "@json-render/core";
import { playgroundCatalog } from "@/lib/catalog";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt(playgroundCatalog, {
  customRules: [
    "For forms: Card should be the root element, not wrapped in a centering Stack",
    "NEVER use viewport height classes (min-h-screen, h-screen) - breaks the container",
    "NEVER use page background colors (bg-gray-50) - container has its own background",
    "When possible, include actions and data bindings that make the UI interactive.",
  ],
});

const RUNTIME_RESPONSE_SCHEMA = z.object({
  uiTree: playgroundCatalog.treeSchema,
  dataSources: z.array(DataSourceSchema).default([]),
  initialData: z.record(z.string(), z.unknown()).default({}),
  generatedActions: z
    .record(z.string(), GeneratedActionDefinitionSchema)
    .default({}),
});

const openAICompatibleProvider = createOpenAICompatible({
  name: "private-provider",
  apiKey: process.env.AI_GATEWAY_API_KEY!,
  baseURL: process.env.AI_GATEWAY_BASE_URL! ?? "",
});

const MAX_PROMPT_LENGTH = 500;

function extractJSONObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Model returned empty response");
  }

  let jsonText = trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    jsonText = fenced[1].trim();
  }

  const attempts = new Set<string>([jsonText]);

  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.add(jsonText.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = jsonText.indexOf("[");
  const lastBracket = jsonText.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    attempts.add(jsonText.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue with sanitized pass.
    }

    try {
      const sanitized = sanitizeLooseJSON(candidate);
      return JSON.parse(sanitized);
    } catch {
      // Continue with next candidate.
    }
  }

  throw new Error("Model returned invalid JSON");
}

function sanitizeLooseJSON(input: string): string {
  let text = input;

  // Drop JS-style comments.
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  text = text.replace(/(^|[^:])\/\/[^\n\r]*/g, "$1");

  // Normalize single-quoted keys and values.
  text = text.replace(/([{,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*:)/g, '$1"$2"$3');
  text = text.replace(
    /:\s*'([^'\\]*(?:\\.[^'\\]*)*)'(\s*[,}\]])/g,
    (_match, value: string, suffix: string) =>
      `: "${value.replace(/"/g, '\\"')}"${suffix}`,
  );

  // Quote plain object keys.
  text = text.replace(
    /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$-]*)(\s*:)/g,
    '$1"$2"$3',
  );

  // Quote unquoted moustache expressions as strings.
  text = text.replace(
    /:\s*(\{\{[\s\S]*?\}\})(\s*[,}\]])/g,
    (_match, expression: string, suffix: string) =>
      `: "${expression.replace(/"/g, '\\"')}"${suffix}`,
  );

  // Remove trailing commas.
  text = text.replace(/,\s*([}\]])/g, "$1");

  return text;
}

function buildRuntimePrompt(
  userPrompt: string,
  previousTree?: unknown,
): string {
  const previousTreeBlock =
    previousTree &&
    typeof previousTree === "object" &&
    !Array.isArray(previousTree) &&
    "root" in previousTree &&
    "elements" in previousTree
      ? `CURRENT UI TREE (for iteration):
${JSON.stringify(previousTree, null, 2)}
`
      : "CURRENT UI TREE: null";

  return `${previousTreeBlock}

USER REQUEST:
${userPrompt}

Return ONE JSON object (no markdown fences, no explanations) with exact shape:
{
  "uiTree": UITree,
  "dataSources": DataSource[],
  "initialData": Record<string, unknown>,
  "generatedActions": Record<string, { "description": string, "composed": Action, "implementation"?: string }>
}

Rules:
- "uiTree" must be valid for the provided catalog component props.
- If no data source is needed, return an empty array for "dataSources".
- Action object format must be:
  {"name":"actionName","params":{...},"onSuccess"?:Action,"onError"?:Action}
  Do NOT use legacy format like {"type":"setState",...}.
- DataSource object must include:
  {"id":"users","path":"/users","type":"rest","api":{...},"autoFetch"?:{"onMount":true}}
  Do NOT use autoFetch as boolean.
- "generatedActions" should be composed from meta actions (setData/updateData/sequence/conditional/fetchSource/createRecord/updateRecord/deleteRecord/refetchSource/showToast).
- Prefer using path bindings like {"path":"/users/data"} for data-driven props.
- Include practical initialData defaults for forms/list state.
- Output strict JSON only.`;
}

function buildPatchPrompt(userPrompt: string, previousTree?: unknown): string {
  if (
    previousTree &&
    typeof previousTree === "object" &&
    !Array.isArray(previousTree) &&
    "root" in previousTree &&
    "elements" in previousTree
  ) {
    return `CURRENT UI STATE (already loaded, DO NOT recreate existing elements):
${JSON.stringify(previousTree, null, 2)}

USER REQUEST: ${userPrompt}

IMPORTANT: The current UI is already loaded. Output ONLY the patches needed to make the requested change:
- To add a new element: {"op":"add","path":"/elements/new-key","value":{...}}
- To modify an existing element: {"op":"set","path":"/elements/existing-key","value":{...}}
- To update the root: {"op":"set","path":"/root","value":"new-root-key"}
- To add children: update the parent element with new children array

DO NOT output patches for elements that don't need to change. Only output what's necessary for the requested modification.`;
  }

  return userPrompt;
}

type JsonRecord = Record<string, unknown>;

const STRING_COMPAT_KEYS = new Set([
  "title",
  "label",
  "text",
  "content",
  "message",
  "placeholder",
  "href",
  "description",
  "actionText",
  "icon",
]);

const ACTION_COMPAT_KEYS = new Set([
  "action",
  "onChangeAction",
  "onSubmitAction",
  "onClickAction",
  "onCancelAction",
  "onOkAction",
  "then",
  "else",
  "onSuccess",
  "onError",
]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function looksLikeLegacyAction(value: JsonRecord): boolean {
  if (typeof value.type !== "string") {
    return false;
  }
  return (
    "path" in value ||
    "value" in value ||
    "actions" in value ||
    "endpoint" in value ||
    "method" in value ||
    "body" in value ||
    "content" in value ||
    "messageType" in value ||
    "target" in value ||
    "condition" in value ||
    "then" in value ||
    "else" in value
  );
}

function asMessageType(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "info";
  }
  if (value === "success" || value === "error" || value === "warning") {
    return value;
  }
  if (value === "warn") {
    return "warning";
  }
  return "info";
}

function normalizeAction(action: unknown, initialData: JsonRecord): unknown {
  if (!isRecord(action)) {
    return action;
  }

  if (typeof action.name === "string") {
    return {
      ...action,
      params: isRecord(action.params)
        ? normalizeObject(action.params, initialData)
        : action.params,
      onSuccess: normalizeAction(action.onSuccess, initialData),
      onError: normalizeAction(action.onError, initialData),
    };
  }

  if (!looksLikeLegacyAction(action)) {
    return action;
  }

  const type = action.type as string;

  if (type === "setState" || type === "setData") {
    return {
      name: "setData",
      params: {
        path: normalizePath(String(action.path ?? "/")),
        value: normalizeUnknown(action.value, initialData),
      },
    };
  }

  if (type === "updateState" || type === "updateData") {
    return {
      name: "updateData",
      params: {
        updates: normalizeUnknown(action.updates, initialData) ?? {},
      },
    };
  }

  if (type === "sequence") {
    const rawActions = Array.isArray(action.actions) ? action.actions : [];
    return {
      name: "sequence",
      params: {
        actions: rawActions.map((item) => normalizeAction(item, initialData)),
      },
    };
  }

  if (type === "showMessage" || type === "showToast") {
    return {
      name: "showToast",
      params: {
        message: String(action.content ?? action.message ?? ""),
        type: asMessageType(action.messageType ?? action.type),
      },
    };
  }

  if (type === "refetch" || type === "refetchSource") {
    return {
      name: "refetchSource",
      params: {
        sourceId: String(action.target ?? action.sourceId ?? ""),
      },
    };
  }

  if (type === "conditional") {
    return {
      name: "conditional",
      params: {
        condition: normalizeUnknown(action.condition, initialData),
        then: normalizeAction(action.then, initialData),
        else: normalizeAction(action.else, initialData),
      },
    };
  }

  // Fallback: preserve as executable action name alias.
  const params = { ...action };
  delete params.type;
  return {
    name: type,
    params: normalizeObject(params, initialData),
  };
}

function coercePathObjectToString(
  value: unknown,
  initialData: JsonRecord,
): unknown {
  if (!isRecord(value) || typeof value.path !== "string") {
    return value;
  }
  const resolved = getByPath(initialData, normalizePath(value.path));
  if (
    typeof resolved === "string" ||
    typeof resolved === "number" ||
    typeof resolved === "boolean"
  ) {
    return String(resolved);
  }
  return value.path;
}

function normalizeUnknown(value: unknown, initialData: JsonRecord): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnknown(item, initialData));
  }
  if (!isRecord(value)) {
    return value;
  }
  if (typeof value.name === "string" || looksLikeLegacyAction(value)) {
    return normalizeAction(value, initialData);
  }
  return normalizeObject(value, initialData);
}

function normalizeObject(
  value: JsonRecord,
  initialData: JsonRecord,
): JsonRecord {
  const normalized: JsonRecord = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (ACTION_COMPAT_KEYS.has(key)) {
      normalized[key] = normalizeAction(rawValue, initialData);
      continue;
    }

    if (
      (key === "path" || key.endsWith("Path")) &&
      typeof rawValue === "string"
    ) {
      normalized[key] = normalizePath(rawValue);
      continue;
    }

    if (STRING_COMPAT_KEYS.has(key)) {
      normalized[key] = coercePathObjectToString(rawValue, initialData);
      continue;
    }

    normalized[key] = normalizeUnknown(rawValue, initialData);
  }

  return normalized;
}

function normalizeApiEndpoint(
  endpoint: unknown,
  fallbackMethod: string,
): JsonRecord | undefined {
  if (!isRecord(endpoint)) {
    return undefined;
  }
  const url =
    typeof endpoint.url === "string"
      ? endpoint.url
      : typeof endpoint.endpoint === "string"
        ? endpoint.endpoint
        : undefined;
  if (!url) {
    return undefined;
  }
  const method =
    typeof endpoint.method === "string"
      ? endpoint.method.toUpperCase()
      : fallbackMethod;
  const normalized: JsonRecord = {
    url,
    method,
  };
  if (isRecord(endpoint.headers)) {
    normalized.headers = endpoint.headers;
  }
  if (typeof endpoint.bodyPath === "string") {
    normalized.bodyPath = normalizePath(endpoint.bodyPath);
  }
  if (typeof endpoint.transform === "string") {
    normalized.transform = endpoint.transform;
  }
  if (isRecord(endpoint.pagination)) {
    normalized.pagination = endpoint.pagination;
  }
  if (isRecord(endpoint.sort)) {
    normalized.sort = endpoint.sort;
  }
  if (isRecord(endpoint.filters)) {
    normalized.filters = endpoint.filters;
  }
  return normalized;
}

function normalizeDataSource(
  source: unknown,
  index: number,
): JsonRecord | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const id =
    typeof source.id === "string" && source.id.length > 0
      ? source.id
      : `source_${index + 1}`;
  const path =
    typeof source.path === "string" && source.path.length > 0
      ? normalizePath(source.path)
      : normalizePath(id);

  const rawType =
    typeof source.type === "string" ? source.type.toLowerCase() : "rest";
  const type =
    rawType === "rest" || rawType === "graphql" || rawType === "mock"
      ? rawType
      : "rest";

  const rawApi = isRecord(source.api)
    ? source.api
    : isRecord(source.endpoints)
      ? source.endpoints
      : {};
  const api = {
    list: normalizeApiEndpoint(rawApi.list, "GET"),
    get: normalizeApiEndpoint(rawApi.get, "GET"),
    create: normalizeApiEndpoint(rawApi.create, "POST"),
    update: normalizeApiEndpoint(rawApi.update, "PUT"),
    delete: normalizeApiEndpoint(rawApi.delete, "DELETE"),
  };

  const autoFetch =
    typeof source.autoFetch === "boolean"
      ? { onMount: source.autoFetch }
      : isRecord(source.autoFetch)
        ? source.autoFetch
        : undefined;

  return {
    id,
    path,
    type,
    api,
    ...(autoFetch ? { autoFetch } : {}),
    ...(Array.isArray(source.refetchOn) ? { refetchOn: source.refetchOn } : {}),
    ...(isRecord(source.mockData) ? { mockData: source.mockData } : {}),
  };
}

function hasTreeShape(value: unknown): value is JsonRecord {
  return (
    isRecord(value) &&
    typeof value.root === "string" &&
    isRecord(value.elements)
  );
}

function createFallbackUITree(prompt: string): JsonRecord {
  const title =
    prompt.trim().length > 0
      ? `Generated UI - ${prompt.slice(0, 40)}`
      : "Generated UI";
  return {
    root: "fallback-card",
    elements: {
      "fallback-card": {
        key: "fallback-card",
        type: "Card",
        props: {
          title,
          maxWidth: "lg",
        },
        children: ["fallback-text"],
      },
      "fallback-text": {
        key: "fallback-text",
        type: "Text",
        props: {
          text: "The model output was repaired. You can iterate with another prompt.",
          type: "secondary",
        },
      },
    },
  };
}

function createCrudFallbackUITree(sourcePath: string): JsonRecord {
  return {
    root: "crud-fallback-card",
    elements: {
      "crud-fallback-card": {
        key: "crud-fallback-card",
        type: "Card",
        props: {
          title: "User Management",
          maxWidth: "full",
        },
        children: ["crud-header", "crud-table", "crud-hint"],
      },
      "crud-header": {
        key: "crud-header",
        type: "Stack",
        props: {
          direction: "horizontal",
          justify: "between",
          align: "center",
          className: ["mb-4"],
        },
        children: ["crud-title", "crud-add"],
      },
      "crud-title": {
        key: "crud-title",
        type: "Heading",
        props: {
          text: "Users",
          level: 3,
        },
      },
      "crud-add": {
        key: "crud-add",
        type: "Button",
        props: {
          label: "Add User",
          type: "primary",
          action: {
            name: "openCreateModal",
          },
        },
      },
      "crud-table": {
        key: "crud-table",
        type: "Table",
        props: {
          dataSource: { path: `${sourcePath}/data` },
          loading: { path: `${sourcePath}/loading` },
          rowKey: "id",
          bordered: true,
          columns: [
            { key: "id", title: "ID", dataIndex: "id", width: 80 },
            { key: "name", title: "Name", dataIndex: "name" },
            { key: "email", title: "Email", dataIndex: "email" },
            {
              key: "role",
              title: "Role",
              dataIndex: "role",
              renderType: "tag",
              renderProps: { color: "processing" },
            },
            {
              key: "actions",
              title: "Actions",
              width: 180,
              render: [
                {
                  type: "Button",
                  props: {
                    label: "Edit",
                    type: "link",
                    action: { name: "openEditModal" },
                  },
                },
                {
                  type: "Button",
                  props: {
                    label: "Delete",
                    type: "link",
                    danger: true,
                    action: { name: "deleteUser" },
                  },
                },
              ],
            },
          ],
        },
      },
      "crud-hint": {
        key: "crud-hint",
        type: "Text",
        props: {
          text: "The model output was repaired and a CRUD scaffold was applied.",
          type: "secondary",
        },
      },
    },
  };
}

function normalizeRuntimePayload(
  parsed: unknown,
  previousTree?: unknown,
): unknown {
  if (Array.isArray(parsed)) {
    const treeCandidate = parsed.find((candidate) => hasTreeShape(candidate));
    if (treeCandidate) {
      return normalizeRuntimePayload({ uiTree: treeCandidate }, previousTree);
    }

    const firstRecord = parsed.find((candidate) => isRecord(candidate));
    if (firstRecord) {
      return normalizeRuntimePayload(firstRecord, previousTree);
    }

    return {
      uiTree: hasTreeShape(previousTree) ? previousTree : undefined,
      dataSources: [],
      initialData: {},
      generatedActions: {},
    };
  }

  if (!isRecord(parsed)) {
    return {
      uiTree: hasTreeShape(previousTree) ? previousTree : undefined,
      dataSources: [],
      initialData: {},
      generatedActions: {},
    };
  }

  const initialData = isRecord(parsed.initialData) ? parsed.initialData : {};

  let uiTree = parsed.uiTree;
  if (!isRecord(uiTree) && hasTreeShape(parsed)) {
    uiTree = {
      root: parsed.root,
      elements: parsed.elements,
    };
  }
  if (Array.isArray(uiTree)) {
    const candidate = uiTree.find((item) => hasTreeShape(item));
    if (candidate) {
      uiTree = candidate;
    } else {
      const mappedElements: JsonRecord = {};
      for (const element of uiTree) {
        if (!isRecord(element) || typeof element.key !== "string") {
          continue;
        }
        mappedElements[element.key] = element;
      }
      const firstKey = Object.keys(mappedElements)[0];
      if (firstKey) {
        uiTree = {
          root: firstKey,
          elements: mappedElements,
        };
      }
    }
  }
  if (isRecord(uiTree) && Array.isArray(uiTree.elements)) {
    const mappedElements: JsonRecord = {};
    for (const element of uiTree.elements) {
      if (!isRecord(element) || typeof element.key !== "string") {
        continue;
      }
      mappedElements[element.key] = element;
    }
    uiTree = {
      ...uiTree,
      elements: mappedElements,
    };
  }
  if (
    isRecord(uiTree) &&
    isRecord(uiTree.elements) &&
    (typeof uiTree.root !== "string" ||
      uiTree.root.length === 0 ||
      !isRecord(uiTree.elements[uiTree.root]))
  ) {
    const firstKey = Object.keys(uiTree.elements)[0];
    if (firstKey) {
      uiTree = {
        ...uiTree,
        root: firstKey,
      };
    }
  }
  if (!isRecord(uiTree) && hasTreeShape(previousTree)) {
    uiTree = previousTree;
  }

  if (isRecord(uiTree) && isRecord(uiTree.elements)) {
    const normalizedElements: JsonRecord = {};
    for (const [elementKey, rawElement] of Object.entries(uiTree.elements)) {
      if (!isRecord(rawElement)) {
        continue;
      }
      const rawProps = isRecord(rawElement.props) ? rawElement.props : {};
      if (
        !("actionName" in rawProps) &&
        typeof rawElement.actionName === "string"
      ) {
        rawProps.actionName = rawElement.actionName;
      }
      if (!("action" in rawProps) && rawElement.action !== undefined) {
        rawProps.action = rawElement.action;
      }
      if (
        !("actionText" in rawProps) &&
        typeof rawElement.actionText === "string"
      ) {
        rawProps.actionText = rawElement.actionText;
      }
      normalizedElements[elementKey] = {
        ...rawElement,
        props: normalizeObject(rawProps, initialData),
      };
    }
    uiTree = {
      ...uiTree,
      elements: normalizedElements,
    };
  }

  const normalizedDataSources = Array.isArray(parsed.dataSources)
    ? parsed.dataSources
        .map((source, index) => normalizeDataSource(source, index))
        .filter((source): source is JsonRecord => Boolean(source))
    : [];

  const generatedActions: JsonRecord = {};
  if (isRecord(parsed.generatedActions)) {
    for (const [name, candidate] of Object.entries(parsed.generatedActions)) {
      if (!isRecord(candidate)) {
        const composed = normalizeAction(candidate, initialData);
        if (isRecord(composed) && typeof composed.name === "string") {
          generatedActions[name] = { description: name, composed };
        }
        continue;
      }
      const composedSource =
        candidate.composed ?? candidate.action ?? candidate.definition;
      const composed = normalizeAction(composedSource, initialData);
      if (!isRecord(composed) || typeof composed.name !== "string") {
        continue;
      }
      generatedActions[name] = {
        description:
          typeof candidate.description === "string"
            ? candidate.description
            : name,
        composed,
        ...(typeof candidate.implementation === "string"
          ? { implementation: candidate.implementation }
          : {}),
      };
    }
  }

  return {
    uiTree,
    dataSources: normalizedDataSources,
    initialData,
    generatedActions,
  };
}

function isLikelyCrudIntent(prompt: string, payload: JsonRecord): boolean {
  if (isLikelyCrudPrompt(prompt)) {
    return true;
  }
  const uiTree = payload.uiTree;
  if (!isRecord(uiTree) || !isRecord(uiTree.elements)) {
    return false;
  }
  return Object.values(uiTree.elements).some((element) => {
    if (!isRecord(element) || !isRecord(element.props)) {
      return false;
    }
    const actionName = element.props.actionName;
    return (
      typeof actionName === "string" &&
      /create|add|edit|delete|save|fetch/i.test(actionName)
    );
  });
}

function isLikelyCrudPrompt(prompt: string): boolean {
  return /crud|user management|users?|增删改查|用户管理|新增|编辑|删除/i.test(
    prompt,
  );
}

function templateToRuntimeBinding(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const rowMatch = value.match(/^\{\{\s*record\.([a-zA-Z0-9_]+)\s*\}\}$/);
  if (rowMatch?.[1]) {
    return { path: `$row.${rowMatch[1]}` };
  }
  const valueMatch = value.match(/^\{\{\s*value\s*\}\}$/);
  if (valueMatch) {
    return { path: "$event.value" };
  }
  return value;
}

function actionPropsToParams(actionProps: unknown): JsonRecord | undefined {
  if (!isRecord(actionProps)) {
    return undefined;
  }
  const params: JsonRecord = {};
  for (const [key, rawValue] of Object.entries(actionProps)) {
    params[key] = templateToRuntimeBinding(rawValue);
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

function buildCrudGeneratedActions(sourceId: string): JsonRecord {
  return {
    openCreateModal: {
      description: "Open create modal and reset form",
      composed: {
        name: "updateData",
        params: {
          updates: {
            "/form/data": { name: "", email: "", role: "user" },
            "/ui/modalVisible": true,
            "/ui/editMode": false,
            "/ui/selectedId": null,
          },
        },
      },
    },
    openEditModal: {
      description: "Open edit modal with selected row",
      composed: {
        name: "updateData",
        params: {
          updates: {
            "/form/data": { path: "$row" },
            "/ui/modalVisible": true,
            "/ui/editMode": true,
            "/ui/selectedId": { path: "$row.id" },
          },
        },
      },
    },
    closeModal: {
      description: "Close modal",
      composed: {
        name: "setData",
        params: { path: "/ui/modalVisible", value: false },
      },
    },
    fetchUsers: {
      description: "Fetch user list",
      composed: {
        name: "fetchSource",
        params: { sourceId },
      },
    },
    refetchUsers: {
      description: "Refetch user list",
      composed: {
        name: "refetchSource",
        params: { sourceId },
      },
    },
    saveUser: {
      description: "Create or update user",
      composed: {
        name: "conditional",
        params: {
          condition: { path: "/ui/editMode" },
          then: {
            name: "updateRecord",
            params: {
              sourceId,
              id: { path: "/ui/selectedId" },
              data: { path: "/form/data" },
            },
          },
          else: {
            name: "createRecord",
            params: {
              sourceId,
              data: { path: "/form/data" },
            },
          },
        },
        onSuccess: {
          name: "sequence",
          params: {
            actions: [
              {
                name: "showToast",
                params: { message: "Saved successfully", type: "success" },
              },
              {
                name: "setData",
                params: { path: "/ui/modalVisible", value: false },
              },
              { name: "refetchSource", params: { sourceId } },
            ],
          },
        },
        onError: {
          name: "showToast",
          params: { message: "Save failed: ${$error.message}", type: "error" },
        },
      },
    },
    resetForm: {
      description: "Reset form values",
      composed: {
        name: "updateData",
        params: {
          updates: {
            "/form/data": { name: "", email: "", role: "user" },
            "/ui/editMode": false,
            "/ui/selectedId": null,
          },
        },
      },
    },
    deleteUser: {
      description: "Delete user by row id",
      composed: {
        name: "deleteRecord",
        params: {
          sourceId,
          id: { path: "$row.id" },
        },
        onSuccess: {
          name: "sequence",
          params: {
            actions: [
              {
                name: "showToast",
                params: { message: "Deleted successfully", type: "success" },
              },
              { name: "refetchSource", params: { sourceId } },
            ],
          },
        },
        onError: {
          name: "showToast",
          params: {
            message: "Delete failed: ${$error.message}",
            type: "error",
          },
        },
      },
    },
  };
}

function normalizeElementActionProps(
  props: JsonRecord,
  aliases: Record<string, string>,
): void {
  if (typeof props.action === "string") {
    const name = aliases[props.action] ?? props.action;
    props.action = { name };
  }

  if (typeof props.actionName === "string") {
    const name = aliases[props.actionName] ?? props.actionName;
    const inlineParams =
      isRecord(props.action) && typeof props.action.name !== "string"
        ? actionPropsToParams(props.action)
        : undefined;
    const actionPropsParams = actionPropsToParams(props.actionProps);
    const mergedParams = {
      ...(inlineParams ?? {}),
      ...(actionPropsParams ?? {}),
    };

    if (isRecord(props.action) && typeof props.action.name === "string") {
      const existingName = aliases[props.action.name] ?? props.action.name;
      const existingParams = isRecord(props.action.params)
        ? props.action.params
        : undefined;
      const mergedExistingParams = {
        ...(existingParams ?? {}),
        ...mergedParams,
      };
      props.action =
        Object.keys(mergedExistingParams).length > 0
          ? { name, params: mergedExistingParams }
          : { name };
      if (existingName !== name) {
        props.action = {
          ...(props.action as JsonRecord),
          name,
        };
      }
      return;
    }

    props.action =
      Object.keys(mergedParams).length > 0
        ? { name, params: mergedParams }
        : { name };
  }
}

function ensureCrudModal(uiTree: JsonRecord): void {
  const rootKey = typeof uiTree.root === "string" ? uiTree.root : "";
  if (!rootKey || !isRecord(uiTree.elements)) {
    return;
  }
  const elements = uiTree.elements as JsonRecord;

  const existingModalKey = Object.entries(elements).find(
    ([key, rawElement]) => {
      if (key.toLowerCase().includes("modal")) {
        return true;
      }
      if (!isRecord(rawElement)) {
        return false;
      }
      if (rawElement.type === "Modal") {
        return true;
      }
      const visible = rawElement.visible;
      return isRecord(visible) && visible.path === "/ui/modalVisible";
    },
  )?.[0];

  if (existingModalKey) {
    const existingModal = elements[existingModalKey];
    if (!isRecord(existingModal)) {
      return;
    }
    const modalProps = isRecord(existingModal.props)
      ? ({ ...existingModal.props } as JsonRecord)
      : {};
    if (!("width" in modalProps) && "maxWidth" in modalProps) {
      modalProps.width =
        typeof modalProps.maxWidth === "string" ? modalProps.maxWidth : "md";
    }
    delete modalProps.maxWidth;
    if (!("onCancelAction" in modalProps)) {
      modalProps.onCancelAction = { name: "closeModal" };
    }
    if (!("destroyOnClose" in modalProps)) {
      modalProps.destroyOnClose = true;
    }

    existingModal.type = "Modal";
    existingModal.props = modalProps;

    if (!isRecord(existingModal.visible)) {
      existingModal.visible = { path: "/ui/modalVisible" };
    }
    return;
  }

  const rootElement = elements[rootKey];
  if (!isRecord(rootElement)) {
    return;
  }
  const rootChildren = Array.isArray(rootElement.children)
    ? (rootElement.children as unknown[])
    : [];
  if (!rootChildren.includes("auto-user-modal-card")) {
    rootChildren.push("auto-user-modal-card");
  }
  rootElement.children = rootChildren as string[];

  elements["auto-user-modal-card"] = {
    key: "auto-user-modal-card",
    type: "Modal",
    props: {
      title: "User Form",
      width: "md",
      centered: true,
      destroyOnClose: true,
      onCancelAction: {
        name: "closeModal",
      },
    },
    visible: { path: "/ui/modalVisible" },
    children: [
      "auto-user-name",
      "auto-user-email",
      "auto-user-role",
      "auto-user-actions",
    ],
  };
  elements["auto-user-name"] = {
    key: "auto-user-name",
    type: "Input",
    props: {
      label: "Name",
      name: "name",
      valuePath: "/form/data/name",
      placeholder: "Enter name",
    },
  };
  elements["auto-user-email"] = {
    key: "auto-user-email",
    type: "Input",
    props: {
      label: "Email",
      name: "email",
      type: "email",
      valuePath: "/form/data/email",
      placeholder: "Enter email",
    },
  };
  elements["auto-user-role"] = {
    key: "auto-user-role",
    type: "Select",
    props: {
      label: "Role",
      name: "role",
      options: ["user", "admin", "viewer"],
      valuePath: "/form/data/role",
      placeholder: "Select role",
    },
  };
  elements["auto-user-actions"] = {
    key: "auto-user-actions",
    type: "Stack",
    props: {
      direction: "horizontal",
      justify: "end",
      gap: "sm",
    },
    children: ["auto-user-cancel", "auto-user-save"],
  };
  elements["auto-user-cancel"] = {
    key: "auto-user-cancel",
    type: "Button",
    props: {
      label: "Cancel",
      action: { name: "closeModal" },
    },
  };
  elements["auto-user-save"] = {
    key: "auto-user-save",
    type: "Button",
    props: {
      label: "Save",
      type: "primary",
      action: { name: "saveUser" },
    },
  };
}

function ensureCrudScaffold(payload: JsonRecord, prompt: string): JsonRecord {
  if (!isLikelyCrudIntent(prompt, payload)) {
    return payload;
  }

  const dataSources = Array.isArray(payload.dataSources)
    ? ([...payload.dataSources] as unknown[])
    : [];
  if (dataSources.length === 0) {
    dataSources.push({
      id: "users",
      path: "/users",
      type: "rest",
      api: {
        list: { url: "/api/users", method: "GET" },
        create: { url: "/api/users", method: "POST", bodyPath: "/form/data" },
        update: {
          url: "/api/users/:id",
          method: "PUT",
          bodyPath: "/form/data",
        },
        delete: { url: "/api/users/:id", method: "DELETE" },
      },
      autoFetch: { onMount: true },
      refetchOn: ["create", "update", "delete"],
    });
  }
  payload.dataSources = dataSources;

  const primarySource =
    (dataSources[0] as JsonRecord | undefined) && isRecord(dataSources[0])
      ? (dataSources[0] as JsonRecord)
      : ({ id: "users", path: "/users" } as JsonRecord);
  const sourceId =
    typeof primarySource.id === "string" ? primarySource.id : "users";
  const sourcePath =
    typeof primarySource.path === "string"
      ? normalizePath(primarySource.path)
      : "/users";

  const initialData = isRecord(payload.initialData)
    ? { ...payload.initialData }
    : {};
  if (!isRecord(initialData[sourceId])) {
    initialData[sourceId] = {
      data: [],
      loading: false,
      error: null,
      pagination: { page: 1, pageSize: 10, total: 0 },
    };
  }
  if (!isRecord(initialData.form)) {
    initialData.form = {
      data: { name: "", email: "", role: "user" },
      errors: {},
    };
  }
  if (!isRecord(initialData.ui)) {
    initialData.ui = {
      modalVisible: false,
      editMode: false,
      selectedId: null,
    };
  }
  payload.initialData = initialData;

  const generatedActions = isRecord(payload.generatedActions)
    ? { ...payload.generatedActions }
    : {};
  const defaults = buildCrudGeneratedActions(sourceId);
  for (const [name, definition] of Object.entries(defaults)) {
    if (!(name in generatedActions)) {
      generatedActions[name] = definition;
    }
  }

  const aliases: Record<string, string> = {
    createUser: "openCreateModal",
    addUser: "openCreateModal",
    openAddModal: "openCreateModal",
    openCreateModal: "openCreateModal",
    editUser: "openEditModal",
    openEditModal: "openEditModal",
    deleteUser: "deleteUser",
    removeUser: "deleteUser",
    saveUser: "saveUser",
    submitUser: "saveUser",
    closeModal: "closeModal",
    cancelEdit: "closeModal",
    fetchUsers: "fetchUsers",
    refetchUsers: "refetchUsers",
    refreshUsers: "refetchUsers",
    onMount: "fetchUsers",
    resetForm: "resetForm",
    clearForm: "resetForm",
  };
  for (const [legacyName, canonicalName] of Object.entries(aliases)) {
    if (legacyName in generatedActions) {
      continue;
    }
    const canonical = generatedActions[canonicalName];
    if (canonical) {
      generatedActions[legacyName] = canonical;
    }
  }
  payload.generatedActions = generatedActions;

  if (isRecord(payload.uiTree) && isRecord(payload.uiTree.elements)) {
    const uiTree = payload.uiTree;
    const elements = uiTree.elements as JsonRecord;

    for (const rawElement of Object.values(elements)) {
      if (!isRecord(rawElement) || !isRecord(rawElement.props)) {
        continue;
      }
      const props = rawElement.props as JsonRecord;
      normalizeElementActionProps(props, aliases);

      if (
        (rawElement.type === "Input" ||
          rawElement.type === "Select" ||
          rawElement.type === "Textarea") &&
        typeof props.name === "string"
      ) {
        const fieldName = props.name;
        if (
          typeof props.valuePath !== "string" ||
          props.valuePath.length === 0 ||
          /^(selectedUser|editingUser|form|formData)\./.test(props.valuePath)
        ) {
          props.valuePath = `/form/data/${fieldName}`;
        }
      }

      if (rawElement.type === "Table") {
        if (
          isRecord(props.dataSource) &&
          typeof props.dataSource.path === "string"
        ) {
          const path = normalizePath(props.dataSource.path);
          if (!path.endsWith("/data")) {
            props.dataSource = { path: `${sourcePath}/data` };
          }
        }
        if (!isRecord(props.loading)) {
          props.loading = { path: `${sourcePath}/loading` };
        }

        const columns = Array.isArray(props.columns) ? props.columns : [];
        for (const rawColumn of columns) {
          if (!isRecord(rawColumn) || !Array.isArray(rawColumn.render)) {
            continue;
          }
          for (const rawRenderItem of rawColumn.render) {
            if (!isRecord(rawRenderItem) || !isRecord(rawRenderItem.props)) {
              continue;
            }
            normalizeElementActionProps(
              rawRenderItem.props as JsonRecord,
              aliases,
            );
          }
        }
      }
    }

    ensureCrudModal(uiTree);
  }

  return payload;
}

function summarizeZodIssues(error: z.ZodError, limit = 10): string {
  return error.issues
    .slice(0, limit)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function toErrorMessage(error: unknown): string {
  const message =
    error instanceof z.ZodError
      ? summarizeZodIssues(error)
      : error instanceof Error
        ? error.message
        : String(error);
  return message.length > 1200 ? `${message.slice(0, 1200)}...` : message;
}

function buildFallbackRuntimePayload(
  prompt: string,
  previousTree?: unknown,
): JsonRecord {
  const fallbackTree = isLikelyCrudPrompt(prompt)
    ? createCrudFallbackUITree("/users")
    : createFallbackUITree(prompt);

  return ensureCrudScaffold(
    {
      uiTree: hasTreeShape(previousTree) ? previousTree : fallbackTree,
      dataSources: [],
      initialData: {},
      generatedActions: {},
    },
    prompt,
  );
}

export async function POST(req: Request) {
  const { prompt, context } = await req.json();
  const previousTree = context?.previousTree;
  const sanitizedPrompt = String(prompt || "").slice(0, MAX_PROMPT_LENGTH);

  // Prefer runtime payload protocol (phase-1 target structure).
  try {
    const runtimePrompt = buildRuntimePrompt(sanitizedPrompt, previousTree);
    const runtimeResult = await generateText({
      model: openAICompatibleProvider(process.env.AI_GATEWAY_MODEL!),
      system: SYSTEM_PROMPT,
      prompt: runtimePrompt,
      temperature: 0.4,
    });

    const parsed = extractJSONObject(runtimeResult.text);
    const normalized = normalizeRuntimePayload(parsed, previousTree);
    const repaired = isRecord(normalized)
      ? ensureCrudScaffold(normalized, sanitizedPrompt)
      : buildFallbackRuntimePayload(sanitizedPrompt, previousTree);
    let runtimePayloadResult = RUNTIME_RESPONSE_SCHEMA.safeParse(repaired);

    if (!runtimePayloadResult.success) {
      const fallbackPayload = buildFallbackRuntimePayload(
        sanitizedPrompt,
        previousTree,
      );
      runtimePayloadResult = RUNTIME_RESPONSE_SCHEMA.safeParse(fallbackPayload);
    }

    if (!runtimePayloadResult.success) {
      throw new Error(summarizeZodIssues(runtimePayloadResult.error));
    }

    const runtimePayload = runtimePayloadResult.data;

    return new Response(`${JSON.stringify(runtimePayload)}\n`, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (runtimeError) {
    console.warn(
      "Runtime payload generation failed, fallback to patch stream",
      {
        error: toErrorMessage(runtimeError),
      },
    );
  }

  // Backward-compatible fallback: legacy patch streaming.
  const patchPrompt = buildPatchPrompt(sanitizedPrompt, previousTree);
  const streamResult = streamText({
    model: openAICompatibleProvider(process.env.AI_GATEWAY_MODEL!),
    system: SYSTEM_PROMPT,
    prompt: patchPrompt,
    temperature: 0.7,
  });

  return streamResult.toTextStreamResponse();
}
