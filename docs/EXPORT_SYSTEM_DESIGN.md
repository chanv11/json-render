# JSON Render Export System 设计文档

> 目标：通过自然语言生成带交互的页面，用户可迭代修改，最终导出一个包含完整信息的 URL/文件，供 Code Agent（如 Cursor）100% 还原。

## 目录

1. [概述](#1-概述)
2. [整体架构](#2-整体架构)
3. [Action 系统扩展](#3-action-系统扩展)
4. [Data 系统扩展](#4-data-系统扩展)
5. [Export Schema 设计](#5-export-schema-设计)
6. [Playground 预览机制](#6-playground-预览机制)
7. [Code Agent 还原流程](#7-code-agent-还原流程)
8. [API 接口规范](#8-api-接口规范)
9. [实现路线图](#9-实现路线图)

---

## 1. 概述

### 1.1 背景与目标

当前 json-render 提供了约束式 UI 生成能力：

- **Catalog**：定义 AI 可用的组件集合
- **UITree**：可序列化的页面结构
- **Renderer**：实时渲染 React 组件
- **Codegen**：生成 JSX 代码

**新目标**是扩展为完整的页面生成与导出系统：

```
用户自然语言 → AI 生成页面 → 用户迭代修改 → 导出 → Code Agent 还原
```

### 1.2 核心需求

| 需求        | 描述                                  |
| ----------- | ------------------------------------- |
| 动态 Action | AI 可生成任意交互逻辑，不受预定义限制 |
| 数据绑定    | 支持 CRUD 场景，与后端 API 交互       |
| 完整导出    | 包含所有还原所需信息                  |
| 100% 还原   | Code Agent 可生成完全可运行的项目     |

### 1.3 设计原则

1. **声明式优先**：所有配置可序列化为 JSON
2. **约束性**：AI 在定义的边界内生成
3. **可扩展**：支持自定义组件、Action、验证规则
4. **渐进增强**：兼容现有功能，逐步扩展

---

## 2. 整体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户界面层                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │   Chat UI    │    │   Preview    │    │ Code Export  │          │
│   │  (自然语言)   │───▶│   (实时预览)  │───▶│   (导出)     │          │
│   └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                         核心引擎层                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │   AI Engine  │    │   Renderer   │    │   Codegen    │          │
│   │  (LLM 生成)  │    │  (React 渲染) │    │  (代码生成)   │          │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│          │                   │                   │                   │
│          ▼                   ▼                   ▼                   │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                    Core Systems                          │       │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │       │
│   │  │ Catalog │  │ Action  │  │  Data   │  │Visibility│     │       │
│   │  │ System  │  │ System  │  │ System  │  │ System  │     │       │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │       │
│   └─────────────────────────────────────────────────────────┘       │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                         数据流层                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │  DataSource  │◀──▶│   API Layer  │◀──▶│   Backend    │          │
│   │   Manager    │    │   (Fetch)    │    │   Server     │          │
│   └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                         完整数据流                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 用户输入                                                          │
│     │                                                                │
│     ▼                                                                │
│  2. AI 生成 (LLM)                                                    │
│     │  - 解析用户意图                                                 │
│     │  - 根据 Catalog 约束生成 UITree                                 │
│     │  - 生成 DataSource 配置                                        │
│     │  - 生成 Action 配置（使用元操作组合）                            │
│     │                                                                │
│     ▼                                                                │
│  3. 流式传输 (JSON Patch)                                            │
│     │  - 增量更新 UITree                                             │
│     │  - 实时渲染预览                                                 │
│     │                                                                │
│     ▼                                                                │
│  4. 用户交互                                                          │
│     │  - 预览页面                                                     │
│     │  - 测试交互                                                     │
│     │  - 继续修改（返回步骤 1）                                        │
│     │                                                                │
│     ▼                                                                │
│  5. 导出                                                              │
│     │  - 生成 Export Schema                                          │
│     │  - 压缩/编码为 URL 或文件                                       │
│     │                                                                │
│     ▼                                                                │
│  6. Code Agent 还原                                                   │
│     │  - 解析 Export Schema                                          │
│     │  - 生成完整项目代码                                             │
│     │  - 用户可直接运行                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Action 系统扩展

### 3.1 当前系统的局限

当前 Action 系统要求：

1. 在 Catalog 中预定义 Action 名称和参数
2. 在运行时注册对应的 Handler 实现

```typescript
// 当前：必须预定义
catalog.actions = {
  submitForm: { params: z.object({ formId: z.string() }) },
  deleteItem: { params: z.object({ id: z.string() }) },
};

// 当前：必须注册 handler
<ActionProvider handlers={{
  submitForm: async (params) => { /* 实现 */ },
  deleteItem: async (params) => { /* 实现 */ },
}} />
```

**问题**：AI 无法生成预定义之外的交互逻辑。

### 3.2 解决方案：三层 Action 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     三层 Action 架构                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Layer 1: 内置元操作 (Meta Actions)                                  │
│  ├─ 系统预置，无需定义                                               │
│  ├─ 通用、可组合                                                     │
│  └─ 运行时由框架提供 Handler                                         │
│                                                                      │
│  Layer 2: 业务预定义 Action                                          │
│  ├─ 在 Catalog 中定义                                                │
│  ├─ 用户提供 Handler 实现                                            │
│  └─ 适合复杂业务逻辑                                                 │
│                                                                      │
│  Layer 3: AI 生成的 Action                                           │
│  ├─ AI 使用元操作组合生成                                            │
│  ├─ 导出时生成完整代码                                               │
│  └─ 适合动态需求                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Layer 1: 内置元操作定义

#### 3.3.1 数据操作类

```typescript
/**
 * setData - 设置数据模型中的值
 */
interface SetDataAction {
  name: "setData";
  params: {
    /** 目标路径 */
    path: string;
    /** 要设置的值（支持 DynamicValue） */
    value: DynamicValue;
  };
}

/**
 * updateData - 批量更新数据
 */
interface UpdateDataAction {
  name: "updateData";
  params: {
    /** 路径到值的映射 */
    updates: Record<string, DynamicValue>;
  };
}

/**
 * deleteData - 删除数据
 */
interface DeleteDataAction {
  name: "deleteData";
  params: {
    /** 要删除的路径 */
    path: string;
  };
}

/**
 * appendData - 向数组追加元素
 */
interface AppendDataAction {
  name: "appendData";
  params: {
    /** 数组路径 */
    path: string;
    /** 要追加的值 */
    value: DynamicValue;
  };
}

/**
 * removeFromArray - 从数组移除元素
 */
interface RemoveFromArrayAction {
  name: "removeFromArray";
  params: {
    /** 数组路径 */
    path: string;
    /** 要移除的索引或条件 */
    index?: number;
    where?: { field: string; equals: DynamicValue };
  };
}
```

#### 3.3.2 API 请求类

```typescript
/**
 * fetch - 发起 HTTP 请求
 */
interface FetchAction {
  name: "fetch";
  params: {
    /** 请求 URL（支持路径插值 ${/path}） */
    url: string;
    /** HTTP 方法 */
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    /** 请求头 */
    headers?: Record<string, string>;
    /** 请求体（支持 DynamicValue） */
    body?: DynamicValue;
    /** 响应存储路径 */
    resultPath?: string;
    /** 响应转换表达式 */
    transform?: string;
  };
  /** 成功回调 */
  onSuccess?: ActionOnSuccess;
  /** 错误回调 */
  onError?: ActionOnError;
}

// 示例：获取用户列表
{
  "name": "fetch",
  "params": {
    "url": "/api/users?page=${/pagination/page}",
    "method": "GET",
    "resultPath": "/users",
    "transform": "response.data"
  }
}

// 示例：提交表单
{
  "name": "fetch",
  "params": {
    "url": "/api/users",
    "method": "POST",
    "body": { "path": "/form" }
  },
  "onSuccess": { "action": "refreshUsers" },
  "onError": { "set": { "/error": "$error.message" } }
}
```

#### 3.3.3 导航类

```typescript
/**
 * navigate - 页面导航
 */
interface NavigateAction {
  name: "navigate";
  params: {
    /** 目标路径 */
    to: string;
    /** 是否替换历史 */
    replace?: boolean;
    /** 查询参数 */
    query?: Record<string, DynamicValue>;
  };
}

/**
 * openUrl - 打开外部链接
 */
interface OpenUrlAction {
  name: "openUrl";
  params: {
    url: string;
    target?: "_blank" | "_self";
  };
}

/**
 * goBack - 返回上一页
 */
interface GoBackAction {
  name: "goBack";
}
```

#### 3.3.4 UI 控制类

```typescript
/**
 * openModal - 打开弹窗
 */
interface OpenModalAction {
  name: "openModal";
  params: {
    /** 弹窗 ID 或路径 */
    modalId?: string;
    visibilityPath?: string;
    /** 初始数据 */
    data?: Record<string, DynamicValue>;
  };
}

/**
 * closeModal - 关闭弹窗
 */
interface CloseModalAction {
  name: "closeModal";
  params: {
    modalId?: string;
    visibilityPath?: string;
  };
}

/**
 * showToast - 显示提示
 */
interface ShowToastAction {
  name: "showToast";
  params: {
    message: DynamicValue<string>;
    type?: "success" | "error" | "warning" | "info";
    duration?: number;
  };
}

/**
 * copyToClipboard - 复制到剪贴板
 */
interface CopyToClipboardAction {
  name: "copyToClipboard";
  params: {
    text: DynamicValue<string>;
  };
}
```

#### 3.3.5 流程控制类

```typescript
/**
 * sequence - 顺序执行多个 Action
 */
interface SequenceAction {
  name: "sequence";
  params: {
    actions: Action[];
  };
}

/**
 * parallel - 并行执行多个 Action
 */
interface ParallelAction {
  name: "parallel";
  params: {
    actions: Action[];
  };
}

/**
 * conditional - 条件执行
 */
interface ConditionalAction {
  name: "conditional";
  params: {
    condition: VisibilityCondition;
    then: Action;
    else?: Action;
  };
}

/**
 * delay - 延迟执行
 */
interface DelayAction {
  name: "delay";
  params: {
    ms: number;
    then: Action;
  };
}

/**
 * loop - 循环执行
 */
interface LoopAction {
  name: "loop";
  params: {
    /** 遍历的数组路径 */
    over: string;
    /** 每次迭代执行的 Action（可使用 /item 和 /index） */
    action: Action;
  };
}
```

#### 3.3.6 表单类

```typescript
/**
 * validateForm - 验证表单
 */
interface ValidateFormAction {
  name: "validateForm";
  params: {
    /** 表单数据路径 */
    formPath: string;
    /** 验证规则（引用 Catalog 中的 validationFunctions） */
    rules: Record<string, ValidationRule[]>;
  };
  /** 验证通过后执行 */
  onValid?: Action;
  /** 验证失败后执行 */
  onInvalid?: Action;
}

/**
 * resetForm - 重置表单
 */
interface ResetFormAction {
  name: "resetForm";
  params: {
    formPath: string;
    defaultValues?: Record<string, unknown>;
  };
}

/**
 * submitForm - 提交表单（validate + fetch 的组合）
 */
interface SubmitFormAction {
  name: "submitForm";
  params: {
    formPath: string;
    url: string;
    method?: "POST" | "PUT" | "PATCH";
    rules?: Record<string, ValidationRule[]>;
  };
  onSuccess?: ActionOnSuccess;
  onError?: ActionOnError;
}
```

### 3.4 Layer 2: 业务预定义 Action

在 Catalog 中定义，用户提供 Handler：

```typescript
// catalog.ts
export const catalog = createCatalog({
  components: { /* ... */ },

  actions: {
    // 复杂业务逻辑，需要自定义实现
    processPayment: {
      params: z.object({
        orderId: z.string(),
        amount: z.number(),
        paymentMethod: z.enum(["credit_card", "alipay", "wechat"]),
      }),
      description: "处理支付，包含第三方支付集成",
    },

    generateReport: {
      params: z.object({
        type: z.enum(["daily", "weekly", "monthly"]),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }),
      }),
      description: "生成报表并下载",
    },
  },
});

// 运行时注册
<ActionProvider handlers={{
  processPayment: async ({ orderId, amount, paymentMethod }) => {
    // 调用支付网关
    const result = await paymentGateway.process({ orderId, amount, paymentMethod });
    return result;
  },
  generateReport: async ({ type, dateRange }) => {
    // 生成报表
    const report = await reportService.generate(type, dateRange);
    downloadFile(report);
  },
}} />
```

### 3.5 Layer 3: AI 生成的 Action

AI 使用元操作组合生成复杂逻辑：

```json
{
  "generatedActions": {
    "saveUserAndRefresh": {
      "description": "保存用户信息并刷新列表",
      "composed": {
        "name": "sequence",
        "params": {
          "actions": [
            {
              "name": "validateForm",
              "params": {
                "formPath": "/userForm",
                "rules": {
                  "name": [
                    { "type": "required" },
                    { "type": "minLength", "value": 2 }
                  ],
                  "email": [{ "type": "required" }, { "type": "email" }]
                }
              },
              "onValid": {
                "name": "sequence",
                "params": {
                  "actions": [
                    {
                      "name": "fetch",
                      "params": {
                        "url": "/api/users/${/userForm/id}",
                        "method": "PUT",
                        "body": { "path": "/userForm" }
                      },
                      "onSuccess": {
                        "name": "sequence",
                        "params": {
                          "actions": [
                            {
                              "name": "showToast",
                              "params": {
                                "message": "保存成功",
                                "type": "success"
                              }
                            },
                            {
                              "name": "closeModal",
                              "params": { "visibilityPath": "/modal/visible" }
                            },
                            {
                              "name": "fetch",
                              "params": {
                                "url": "/api/users",
                                "method": "GET",
                                "resultPath": "/users"
                              }
                            }
                          ]
                        }
                      },
                      "onError": {
                        "name": "showToast",
                        "params": {
                          "message": "保存失败: ${$error.message}",
                          "type": "error"
                        }
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    }
  }
}
```

### 3.6 Action 类型定义汇总

```typescript
// packages/core/src/actions.ts

import { z } from "zod";

/**
 * 所有元操作名称
 */
export type MetaActionName =
  // 数据操作
  | "setData"
  | "updateData"
  | "deleteData"
  | "appendData"
  | "removeFromArray"
  // API 请求
  | "fetch"
  // 导航
  | "navigate"
  | "openUrl"
  | "goBack"
  // UI 控制
  | "openModal"
  | "closeModal"
  | "showToast"
  | "copyToClipboard"
  // 流程控制
  | "sequence"
  | "parallel"
  | "conditional"
  | "delay"
  | "loop"
  // 表单
  | "validateForm"
  | "resetForm"
  | "submitForm";

/**
 * 元操作定义
 */
export const MetaActions: Record<MetaActionName, ActionDefinition> = {
  setData: {
    params: z.object({
      path: z.string(),
      value: DynamicValueSchema,
    }),
    description: "设置数据模型中的值",
  },

  fetch: {
    params: z.object({
      url: z.string(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      headers: z.record(z.string()).optional(),
      body: DynamicValueSchema.optional(),
      resultPath: z.string().optional(),
      transform: z.string().optional(),
    }),
    description: "发起 HTTP 请求",
  },

  sequence: {
    params: z.object({
      actions: z.array(ActionSchema),
    }),
    description: "顺序执行多个操作",
  },

  conditional: {
    params: z.object({
      condition: VisibilityConditionSchema,
      then: ActionSchema,
      else: ActionSchema.optional(),
    }),
    description: "条件执行",
  },

  // ... 其他元操作定义
};

/**
 * 扩展后的 Action 类型
 */
export interface Action {
  /** Action 名称（元操作名或自定义名） */
  name: string;
  /** 参数 */
  params?: Record<string, DynamicValue>;
  /** 确认对话框 */
  confirm?: ActionConfirm;
  /** 成功回调 */
  onSuccess?: ActionOnSuccess;
  /** 错误回调 */
  onError?: ActionOnError;
}

/**
 * 生成的 Action 定义（用于 Export）
 */
export interface GeneratedActionDefinition {
  /** 描述 */
  description: string;
  /** 使用元操作组合的实现 */
  composed: Action;
  /** 可选：生成的 TypeScript 代码（用于 Code Agent） */
  implementation?: string;
}
```

### 3.7 元操作 Handler 实现

```typescript
// packages/react/src/contexts/meta-actions.tsx

import { useData } from "./data";
import { useCallback } from "react";

/**
 * 内置元操作的 Handler 实现
 */
export function useMetaActionHandlers() {
  const { get, set, update } = useData();

  const handlers: Record<string, ActionHandler> = {
    // 数据操作
    setData: ({ path, value }) => {
      const resolved = resolveDynamicValue(value, get("/"));
      set(path, resolved);
    },

    updateData: ({ updates }) => {
      const resolvedUpdates: Record<string, unknown> = {};
      for (const [path, value] of Object.entries(updates)) {
        resolvedUpdates[path] = resolveDynamicValue(value, get("/"));
      }
      update(resolvedUpdates);
    },

    // API 请求
    fetch: async ({ url, method, headers, body, resultPath, transform }) => {
      const data = get("/");
      const resolvedUrl = interpolateString(url, data);
      const resolvedBody = body ? resolveDynamicValue(body, data) : undefined;

      const response = await fetch(resolvedUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: resolvedBody ? JSON.stringify(resolvedBody) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let result = await response.json();

      // 应用转换
      if (transform) {
        result = evaluateTransform(result, transform);
      }

      // 存储结果
      if (resultPath) {
        set(resultPath, result);
      }

      return result;
    },

    // 流程控制
    sequence: async ({ actions }, executeAction) => {
      for (const action of actions) {
        await executeAction(action);
      }
    },

    parallel: async ({ actions }, executeAction) => {
      await Promise.all(actions.map((action) => executeAction(action)));
    },

    conditional: async (
      { condition, then, else: elseAction },
      executeAction
    ) => {
      const data = get("/");
      const result = evaluateVisibility(condition, data);
      if (result) {
        await executeAction(then);
      } else if (elseAction) {
        await executeAction(elseAction);
      }
    },

    // ... 其他 handler
  };

  return handlers;
}
```

---

## 4. Data 系统扩展

### 4.1 当前系统的局限

当前 DataProvider 仅支持：

- 内存中的数据存储
- 通过路径读写数据
- 数据变化触发重渲染

**不支持**：

- 从 API 获取初始数据
- 数据与后端同步
- 分页、排序、筛选
- 加载/错误状态管理

### 4.2 DataSource 概念引入

```typescript
// packages/core/src/data-source.ts

import { z } from "zod";

/**
 * API 端点配置
 */
export interface ApiEndpoint {
  /** 请求 URL（支持路径参数 :id 和查询插值 ${path}） */
  url: string;
  /** HTTP 方法 */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体数据来源路径 */
  bodyPath?: string;
  /** 响应数据转换表达式 */
  transform?: string;
}

/**
 * 分页配置
 */
export interface PaginationConfig {
  /** 页码参数名 */
  pageParam?: string;
  /** 每页数量参数名 */
  pageSizeParam?: string;
  /** 响应中总数的路径 */
  totalPath?: string;
  /** 响应中数据列表的路径 */
  itemsPath?: string;
}

/**
 * 数据源定义
 */
export interface DataSource {
  /** 唯一标识 */
  id: string;

  /** 绑定到数据模型的路径 */
  path: string;

  /** 数据源类型 */
  type: "rest" | "graphql" | "mock";

  /** CRUD API 配置 */
  api: {
    /** 列表接口 */
    list?: ApiEndpoint & {
      /** 分页配置 */
      pagination?: PaginationConfig;
      /** 排序参数配置 */
      sort?: {
        fieldParam: string;
        orderParam: string;
      };
      /** 筛选参数配置 */
      filters?: {
        /** 筛选参数映射：字段名 → 查询参数名 */
        params: Record<string, string>;
      };
    };

    /** 获取单条记录 */
    get?: ApiEndpoint;

    /** 创建记录 */
    create?: ApiEndpoint;

    /** 更新记录 */
    update?: ApiEndpoint;

    /** 删除记录 */
    delete?: ApiEndpoint;
  };

  /** 自动获取配置 */
  autoFetch?: {
    /** 是否在挂载时自动获取 */
    onMount?: boolean;
    /** 依赖的数据路径（变化时重新获取） */
    deps?: string[];
    /** 轮询间隔（毫秒） */
    pollingInterval?: number;
  };

  /** 操作后自动刷新 */
  refetchOn?: string[];

  /** Mock 数据（用于预览） */
  mockData?: {
    list?: unknown[];
    delay?: number;
  };
}

/**
 * DataSource Zod Schema
 */
export const DataSourceSchema = z.object({
  id: z.string(),
  path: z.string(),
  type: z.enum(["rest", "graphql", "mock"]),
  api: z.object({
    list: z
      .object({
        url: z.string(),
        method: z.enum(["GET"]).optional().default("GET"),
        headers: z.record(z.string()).optional(),
        transform: z.string().optional(),
        pagination: z
          .object({
            pageParam: z.string().optional(),
            pageSizeParam: z.string().optional(),
            totalPath: z.string().optional(),
            itemsPath: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
    get: z
      .object({
        url: z.string(),
        method: z.enum(["GET"]).optional().default("GET"),
      })
      .optional(),
    create: z
      .object({
        url: z.string(),
        method: z.enum(["POST"]).optional().default("POST"),
        bodyPath: z.string().optional(),
      })
      .optional(),
    update: z
      .object({
        url: z.string(),
        method: z.enum(["PUT", "PATCH"]).optional().default("PUT"),
        bodyPath: z.string().optional(),
      })
      .optional(),
    delete: z
      .object({
        url: z.string(),
        method: z.enum(["DELETE"]).optional().default("DELETE"),
      })
      .optional(),
  }),
  autoFetch: z
    .object({
      onMount: z.boolean().optional(),
      deps: z.array(z.string()).optional(),
      pollingInterval: z.number().optional(),
    })
    .optional(),
  refetchOn: z.array(z.string()).optional(),
  mockData: z
    .object({
      list: z.array(z.unknown()).optional(),
      delay: z.number().optional(),
    })
    .optional(),
});
```

### 4.3 扩展后的数据模型结构

```typescript
/**
 * 数据源状态
 */
interface DataSourceState<T = unknown> {
  /** 数据 */
  data: T | null;
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 最后更新时间 */
  lastUpdated: number | null;
}

/**
 * 列表数据源状态
 */
interface ListDataSourceState<T = unknown> extends DataSourceState<T[]> {
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  /** 排序信息 */
  sort?: {
    field: string;
    order: "asc" | "desc";
  };
  /** 筛选条件 */
  filters?: Record<string, unknown>;
}

/**
 * 完整的数据模型示例
 */
interface ExampleDataModel {
  // 用户列表数据源
  users: ListDataSourceState<User>;

  // 当前用户数据源
  currentUser: DataSourceState<User>;

  // 表单状态（本地）
  userForm: {
    data: Partial<User>;
    errors: Record<string, string>;
    touched: Record<string, boolean>;
  };

  // UI 状态（本地）
  ui: {
    modalVisible: boolean;
    selectedUserId: string | null;
    editMode: boolean;
  };
}
```

### 4.4 DataSourceProvider 实现

```typescript
// packages/react/src/contexts/data-source.tsx

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { DataSource } from "@json-render/core";
import { useData } from "./data";

export interface DataSourceContextValue {
  /** 数据源配置 */
  sources: DataSource[];
  /** 获取数据 */
  fetchSource: (sourceId: string, params?: Record<string, unknown>) => Promise<void>;
  /** 创建记录 */
  createRecord: (sourceId: string, data: unknown) => Promise<unknown>;
  /** 更新记录 */
  updateRecord: (sourceId: string, id: string, data: unknown) => Promise<unknown>;
  /** 删除记录 */
  deleteRecord: (sourceId: string, id: string) => Promise<void>;
  /** 刷新数据源 */
  refetchSource: (sourceId: string) => Promise<void>;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

export interface DataSourceProviderProps {
  sources: DataSource[];
  children: ReactNode;
}

export function DataSourceProvider({
  sources,
  children,
}: DataSourceProviderProps) {
  const { get, set, update } = useData();

  // 获取数据源配置
  const getSource = (sourceId: string): DataSource | undefined => {
    return sources.find(s => s.id === sourceId);
  };

  // 构建 API URL
  const buildUrl = (
    urlTemplate: string,
    params?: Record<string, unknown>
  ): string => {
    let url = urlTemplate;
    const data = get("/");

    // 替换路径参数 :id
    url = url.replace(/:(\w+)/g, (_, key) => {
      return String(params?.[key] ?? "");
    });

    // 替换插值 ${path}
    url = url.replace(/\$\{([^}]+)\}/g, (_, path) => {
      const value = getByPath(data, path);
      return encodeURIComponent(String(value ?? ""));
    });

    return url;
  };

  // 获取数据
  const fetchSource = async (
    sourceId: string,
    params?: Record<string, unknown>
  ): Promise<void> => {
    const source = getSource(sourceId);
    if (!source?.api.list) return;

    const { path } = source;
    const { url, method, headers, transform, pagination } = source.api.list;

    // 设置 loading 状态
    set(`${path}/loading`, true);
    set(`${path}/error`, null);

    try {
      // 构建 URL（包含分页参数）
      let fetchUrl = buildUrl(url, params);

      if (pagination) {
        const currentPage = get(`${path}/pagination/page`) ?? 1;
        const pageSize = get(`${path}/pagination/pageSize`) ?? 10;
        const urlParams = new URLSearchParams();
        if (pagination.pageParam) {
          urlParams.set(pagination.pageParam, String(currentPage));
        }
        if (pagination.pageSizeParam) {
          urlParams.set(pagination.pageSizeParam, String(pageSize));
        }
        fetchUrl += `?${urlParams.toString()}`;
      }

      const response = await fetch(fetchUrl, {
        method: method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let result = await response.json();

      // 应用转换
      if (transform) {
        result = evaluateTransform(result, transform);
      }

      // 提取数据和总数
      if (pagination) {
        const items = pagination.itemsPath
          ? getByPath(result, pagination.itemsPath)
          : result;
        const total = pagination.totalPath
          ? getByPath(result, pagination.totalPath)
          : items?.length ?? 0;

        update({
          [`${path}/data`]: items,
          [`${path}/pagination/total`]: total,
        });
      } else {
        set(`${path}/data`, result);
      }

      set(`${path}/lastUpdated`, Date.now());
    } catch (error) {
      set(`${path}/error`, (error as Error).message);
    } finally {
      set(`${path}/loading`, false);
    }
  };

  // 创建记录
  const createRecord = async (
    sourceId: string,
    data: unknown
  ): Promise<unknown> => {
    const source = getSource(sourceId);
    if (!source?.api.create) throw new Error("Create API not configured");

    const { url, method, headers, bodyPath } = source.api.create;
    const body = bodyPath ? get(bodyPath) : data;

    const response = await fetch(buildUrl(url), {
      method: method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // 触发 refetch
    if (source.refetchOn?.includes("create")) {
      await fetchSource(sourceId);
    }

    return result;
  };

  // 更新记录
  const updateRecord = async (
    sourceId: string,
    id: string,
    data: unknown
  ): Promise<unknown> => {
    const source = getSource(sourceId);
    if (!source?.api.update) throw new Error("Update API not configured");

    const { url, method, headers, bodyPath } = source.api.update;
    const body = bodyPath ? get(bodyPath) : data;

    const response = await fetch(buildUrl(url, { id }), {
      method: method ?? "PUT",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // 触发 refetch
    if (source.refetchOn?.includes("update")) {
      await fetchSource(sourceId);
    }

    return result;
  };

  // 删除记录
  const deleteRecord = async (
    sourceId: string,
    id: string
  ): Promise<void> => {
    const source = getSource(sourceId);
    if (!source?.api.delete) throw new Error("Delete API not configured");

    const { url, method, headers } = source.api.delete;

    const response = await fetch(buildUrl(url, { id }), {
      method: method ?? "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // 触发 refetch
    if (source.refetchOn?.includes("delete")) {
      await fetchSource(sourceId);
    }
  };

  // 刷新数据源
  const refetchSource = async (sourceId: string): Promise<void> => {
    await fetchSource(sourceId);
  };

  // 自动获取（onMount）
  useEffect(() => {
    sources.forEach(source => {
      if (source.autoFetch?.onMount) {
        fetchSource(source.id);
      }
    });
  }, []);

  // 依赖变化时重新获取
  useEffect(() => {
    sources.forEach(source => {
      if (source.autoFetch?.deps) {
        // 监听依赖路径变化
        // 实现省略，可使用 useSyncExternalStore 或自定义 hook
      }
    });
  }, [sources]);

  const value = useMemo<DataSourceContextValue>(
    () => ({
      sources,
      fetchSource,
      createRecord,
      updateRecord,
      deleteRecord,
      refetchSource,
    }),
    [sources, fetchSource, createRecord, updateRecord, deleteRecord, refetchSource]
  );

  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource(): DataSourceContextValue {
  const ctx = useContext(DataSourceContext);
  if (!ctx) {
    throw new Error("useDataSource must be used within a DataSourceProvider");
  }
  return ctx;
}
```

### 4.5 数据源相关的内置 Action

```typescript
// 数据源操作 Action
const dataSourceActions = {
  /**
   * fetchSource - 获取数据源数据
   */
  fetchSource: {
    params: z.object({
      sourceId: z.string(),
      params: z.record(z.unknown()).optional(),
    }),
    description: "从数据源获取数据",
  },

  /**
   * createRecord - 创建记录
   */
  createRecord: {
    params: z.object({
      sourceId: z.string(),
      data: DynamicValueSchema.optional(),
    }),
    description: "在数据源中创建记录",
  },

  /**
   * updateRecord - 更新记录
   */
  updateRecord: {
    params: z.object({
      sourceId: z.string(),
      id: DynamicValueSchema,
      data: DynamicValueSchema.optional(),
    }),
    description: "更新数据源中的记录",
  },

  /**
   * deleteRecord - 删除记录
   */
  deleteRecord: {
    params: z.object({
      sourceId: z.string(),
      id: DynamicValueSchema,
    }),
    description: "删除数据源中的记录",
  },

  /**
   * refetchSource - 刷新数据源
   */
  refetchSource: {
    params: z.object({
      sourceId: z.string(),
    }),
    description: "重新获取数据源数据",
  },

  /**
   * setPage - 设置分页
   */
  setPage: {
    params: z.object({
      sourceId: z.string(),
      page: z.number(),
    }),
    description: "设置数据源分页并刷新",
  },

  /**
   * setSort - 设置排序
   */
  setSort: {
    params: z.object({
      sourceId: z.string(),
      field: z.string(),
      order: z.enum(["asc", "desc"]),
    }),
    description: "设置数据源排序并刷新",
  },

  /**
   * setFilters - 设置筛选
   */
  setFilters: {
    params: z.object({
      sourceId: z.string(),
      filters: z.record(z.unknown()),
    }),
    description: "设置数据源筛选条件并刷新",
  },
};
```

### 4.6 AI 生成的 CRUD 页面示例

用户输入："帮我生成一个用户管理页面，支持增删改查"

AI 生成的完整配置：

```json
{
  "dataSources": [
    {
      "id": "users",
      "path": "/users",
      "type": "rest",
      "api": {
        "list": {
          "url": "/api/users",
          "method": "GET",
          "pagination": {
            "pageParam": "page",
            "pageSizeParam": "pageSize",
            "totalPath": "total",
            "itemsPath": "data"
          }
        },
        "get": {
          "url": "/api/users/:id",
          "method": "GET"
        },
        "create": {
          "url": "/api/users",
          "method": "POST",
          "bodyPath": "/form/data"
        },
        "update": {
          "url": "/api/users/:id",
          "method": "PUT",
          "bodyPath": "/form/data"
        },
        "delete": {
          "url": "/api/users/:id",
          "method": "DELETE"
        }
      },
      "autoFetch": {
        "onMount": true
      },
      "refetchOn": ["create", "update", "delete"],
      "mockData": {
        "list": [
          {
            "id": "1",
            "name": "张三",
            "email": "zhangsan@example.com",
            "role": "admin"
          },
          {
            "id": "2",
            "name": "李四",
            "email": "lisi@example.com",
            "role": "user"
          },
          {
            "id": "3",
            "name": "王五",
            "email": "wangwu@example.com",
            "role": "user"
          }
        ],
        "delay": 500
      }
    }
  ],

  "initialData": {
    "users": {
      "data": null,
      "loading": true,
      "error": null,
      "pagination": { "page": 1, "pageSize": 10, "total": 0 }
    },
    "form": {
      "data": { "name": "", "email": "", "role": "user" },
      "errors": {},
      "touched": {}
    },
    "ui": {
      "modalVisible": false,
      "editMode": false,
      "selectedId": null
    }
  },

  "uiTree": {
    "root": "page",
    "elements": {
      "page": {
        "key": "page",
        "type": "Stack",
        "props": { "direction": "column", "gap": "lg", "padding": "lg" },
        "children": ["header", "content", "modal"]
      },

      "header": {
        "key": "header",
        "type": "Stack",
        "props": {
          "direction": "row",
          "justify": "space-between",
          "align": "center"
        },
        "children": ["title", "addButton"]
      },

      "title": {
        "key": "title",
        "type": "Heading",
        "props": { "level": 1, "text": "用户管理" }
      },

      "addButton": {
        "key": "addButton",
        "type": "Button",
        "props": {
          "label": "新增用户",
          "variant": "primary",
          "icon": "plus",
          "action": {
            "name": "sequence",
            "params": {
              "actions": [
                {
                  "name": "updateData",
                  "params": {
                    "updates": {
                      "/form/data": { "name": "", "email": "", "role": "user" },
                      "/form/errors": {},
                      "/ui/modalVisible": true,
                      "/ui/editMode": false,
                      "/ui/selectedId": null
                    }
                  }
                }
              ]
            }
          }
        }
      },

      "content": {
        "key": "content",
        "type": "Card",
        "props": {},
        "children": ["table"]
      },

      "table": {
        "key": "table",
        "type": "Table",
        "props": {
          "data": { "path": "/users/data" },
          "loading": { "path": "/users/loading" },
          "columns": [
            { "key": "name", "title": "姓名", "width": 150 },
            { "key": "email", "title": "邮箱", "width": 200 },
            { "key": "role", "title": "角色", "width": 100, "render": "tag" },
            {
              "key": "actions",
              "title": "操作",
              "width": 150,
              "render": "actions"
            }
          ],
          "rowKey": "id",
          "pagination": {
            "current": { "path": "/users/pagination/page" },
            "pageSize": { "path": "/users/pagination/pageSize" },
            "total": { "path": "/users/pagination/total" },
            "onChange": {
              "name": "setPage",
              "params": {
                "sourceId": "users",
                "page": { "path": "/$event/page" }
              }
            }
          },
          "rowActions": [
            {
              "label": "编辑",
              "icon": "edit",
              "action": {
                "name": "sequence",
                "params": {
                  "actions": [
                    {
                      "name": "updateData",
                      "params": {
                        "updates": {
                          "/form/data": { "path": "/$row" },
                          "/ui/modalVisible": true,
                          "/ui/editMode": true,
                          "/ui/selectedId": { "path": "/$row/id" }
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              "label": "删除",
              "icon": "delete",
              "variant": "danger",
              "action": {
                "name": "deleteRecord",
                "params": {
                  "sourceId": "users",
                  "id": { "path": "/$row/id" }
                },
                "confirm": {
                  "title": "确认删除",
                  "message": "确定要删除用户「${/$row/name}」吗？此操作不可恢复。",
                  "variant": "danger",
                  "confirmLabel": "删除",
                  "cancelLabel": "取消"
                },
                "onSuccess": {
                  "name": "showToast",
                  "params": { "message": "删除成功", "type": "success" }
                },
                "onError": {
                  "name": "showToast",
                  "params": {
                    "message": "删除失败: ${$error.message}",
                    "type": "error"
                  }
                }
              }
            }
          ]
        }
      },

      "modal": {
        "key": "modal",
        "type": "Modal",
        "props": {
          "visible": { "path": "/ui/modalVisible" },
          "title": {
            "path": "/ui/editMode",
            "transform": "value ? '编辑用户' : '新增用户'"
          },
          "onClose": {
            "name": "setData",
            "params": { "path": "/ui/modalVisible", "value": false }
          }
        },
        "children": ["form"]
      },

      "form": {
        "key": "form",
        "type": "Form",
        "props": {
          "layout": "vertical"
        },
        "children": ["nameField", "emailField", "roleField", "formActions"]
      },

      "nameField": {
        "key": "nameField",
        "type": "Input",
        "props": {
          "label": "姓名",
          "name": "name",
          "value": { "path": "/form/data/name" },
          "error": { "path": "/form/errors/name" },
          "required": true,
          "placeholder": "请输入姓名",
          "onChange": {
            "name": "setData",
            "params": {
              "path": "/form/data/name",
              "value": { "path": "/$event/value" }
            }
          }
        }
      },

      "emailField": {
        "key": "emailField",
        "type": "Input",
        "props": {
          "label": "邮箱",
          "name": "email",
          "type": "email",
          "value": { "path": "/form/data/email" },
          "error": { "path": "/form/errors/email" },
          "required": true,
          "placeholder": "请输入邮箱",
          "onChange": {
            "name": "setData",
            "params": {
              "path": "/form/data/email",
              "value": { "path": "/$event/value" }
            }
          }
        }
      },

      "roleField": {
        "key": "roleField",
        "type": "Select",
        "props": {
          "label": "角色",
          "name": "role",
          "value": { "path": "/form/data/role" },
          "options": [
            { "value": "admin", "label": "管理员" },
            { "value": "user", "label": "普通用户" }
          ],
          "onChange": {
            "name": "setData",
            "params": {
              "path": "/form/data/role",
              "value": { "path": "/$event/value" }
            }
          }
        }
      },

      "formActions": {
        "key": "formActions",
        "type": "Stack",
        "props": {
          "direction": "row",
          "justify": "end",
          "gap": "md",
          "marginTop": "lg"
        },
        "children": ["cancelButton", "submitButton"]
      },

      "cancelButton": {
        "key": "cancelButton",
        "type": "Button",
        "props": {
          "label": "取消",
          "variant": "secondary",
          "action": {
            "name": "setData",
            "params": { "path": "/ui/modalVisible", "value": false }
          }
        }
      },

      "submitButton": {
        "key": "submitButton",
        "type": "Button",
        "props": {
          "label": {
            "path": "/ui/editMode",
            "transform": "value ? '保存' : '创建'"
          },
          "variant": "primary",
          "loading": { "path": "/form/submitting" },
          "action": {
            "name": "conditional",
            "params": {
              "condition": { "path": "/ui/editMode" },
              "then": {
                "name": "updateRecord",
                "params": {
                  "sourceId": "users",
                  "id": { "path": "/ui/selectedId" }
                },
                "onSuccess": {
                  "name": "sequence",
                  "params": {
                    "actions": [
                      {
                        "name": "showToast",
                        "params": { "message": "更新成功", "type": "success" }
                      },
                      {
                        "name": "setData",
                        "params": { "path": "/ui/modalVisible", "value": false }
                      }
                    ]
                  }
                }
              },
              "else": {
                "name": "createRecord",
                "params": {
                  "sourceId": "users"
                },
                "onSuccess": {
                  "name": "sequence",
                  "params": {
                    "actions": [
                      {
                        "name": "showToast",
                        "params": { "message": "创建成功", "type": "success" }
                      },
                      {
                        "name": "setData",
                        "params": { "path": "/ui/modalVisible", "value": false }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 5. Export Schema 设计

### 5.1 完整的 Export Schema

```typescript
// packages/core/src/export-schema.ts

import { z } from "zod";

/**
 * 组件来源配置
 */
export interface ComponentSource {
  /** 来源类型 */
  type: "npm" | "local" | "inline";

  /** NPM 包配置 */
  npm?: {
    package: string;
    version: string;
    exports: Record<string, string>; // 组件名 → 导出路径
  };

  /** 本地文件配置 */
  local?: {
    basePath: string;
    files: Record<string, string>; // 组件名 → 文件路径
  };

  /** 内联代码配置 */
  inline?: {
    components: Record<string, string>; // 组件名 → 代码
  };
}

/**
 * API 端点信息（用于文档和代码生成）
 */
export interface ApiEndpointInfo {
  /** 唯一标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** URL */
  url: string;
  /** HTTP 方法 */
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** 路径参数 */
  pathParams?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  /** 查询参数 */
  queryParams?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
  /** 请求体 Schema */
  requestBody?: {
    contentType: string;
    schema: Record<string, unknown>; // JSON Schema
  };
  /** 响应 Schema */
  response?: {
    contentType: string;
    schema: Record<string, unknown>; // JSON Schema
  };
}

/**
 * 项目配置
 */
export interface ProjectConfig {
  /** 项目类型 */
  type: "nextjs" | "vite-react" | "remix" | "custom";
  /** 样式方案 */
  styling: "tailwind" | "css-modules" | "styled-components" | "emotion";
  /** TypeScript 版本 */
  typescript?: string;
  /** 额外依赖 */
  dependencies?: Record<string, string>;
  /** 额外开发依赖 */
  devDependencies?: Record<string, string>;
}

/**
 * 完整的 Export Schema
 */
export interface ExportSchema {
  /** Schema 版本 */
  version: string;

  /** 元信息 */
  meta: {
    /** 名称 */
    name: string;
    /** 描述 */
    description?: string;
    /** 创建时间 */
    createdAt: string;
    /** 更新时间 */
    updatedAt: string;
    /** 创建者（可选） */
    author?: string;
  };

  /** UI 树结构 */
  uiTree: UITree;

  /** 数据配置 */
  data: {
    /** 初始数据 */
    initial: DataModel;
    /** 数据源配置 */
    sources: DataSource[];
  };

  /** Action 配置 */
  actions: {
    /** AI 生成的 Action */
    generated: Record<string, GeneratedActionDefinition>;
  };

  /** 组件配置 */
  components: {
    /** 组件来源 */
    source: ComponentSource;
    /** 使用的组件列表 */
    used: string[];
    /** Catalog 定义（用于验证） */
    catalog: {
      components: Record<
        string,
        {
          props: Record<string, unknown>; // JSON Schema
          hasChildren?: boolean;
          description?: string;
        }
      >;
    };
  };

  /** API 接口信息 */
  apis: ApiEndpointInfo[];

  /** 项目配置 */
  project: ProjectConfig;

  /** 上下文信息 */
  context?: {
    /** 原始用户提示词历史 */
    prompts?: string[];
    /** 业务上下文说明 */
    businessContext?: string;
    /** 备注 */
    notes?: string;
  };
}

/**
 * Export Schema Zod 验证
 */
export const ExportSchemaValidator = z.object({
  version: z.string(),
  meta: z.object({
    name: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    author: z.string().optional(),
  }),
  uiTree: UITreeSchema,
  data: z.object({
    initial: z.record(z.unknown()),
    sources: z.array(DataSourceSchema),
  }),
  actions: z.object({
    generated: z.record(GeneratedActionDefinitionSchema),
  }),
  components: z.object({
    source: ComponentSourceSchema,
    used: z.array(z.string()),
    catalog: z.object({
      components: z.record(
        z.object({
          props: z.record(z.unknown()),
          hasChildren: z.boolean().optional(),
          description: z.string().optional(),
        })
      ),
    }),
  }),
  apis: z.array(ApiEndpointInfoSchema),
  project: ProjectConfigSchema,
  context: z
    .object({
      prompts: z.array(z.string()).optional(),
      businessContext: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
```

### 5.2 Export 生成器

```typescript
// packages/codegen/src/export.ts

import type { UITree, DataSource, ExportSchema } from "@json-render/core";
import {
  collectUsedComponents,
  collectDataPaths,
  collectActions,
} from "./traverse";

/**
 * 生成 Export Schema
 */
export function generateExportSchema(options: {
  uiTree: UITree;
  dataSources: DataSource[];
  initialData: Record<string, unknown>;
  generatedActions: Record<string, GeneratedActionDefinition>;
  componentSource: ComponentSource;
  catalog: CatalogType;
  projectConfig: ProjectConfig;
  meta: {
    name: string;
    description?: string;
    author?: string;
  };
  context?: {
    prompts?: string[];
    businessContext?: string;
  };
}): ExportSchema {
  const {
    uiTree,
    dataSources,
    initialData,
    generatedActions,
    componentSource,
    catalog,
    projectConfig,
    meta,
    context,
  } = options;

  // 收集使用的组件
  const usedComponents = collectUsedComponents(uiTree);

  // 从 DataSource 提取 API 信息
  const apis = extractApisFromDataSources(dataSources);

  // 构建 Catalog 子集（仅包含使用的组件）
  const catalogSubset = buildCatalogSubset(catalog, usedComponents);

  const now = new Date().toISOString();

  return {
    version: "1.0.0",
    meta: {
      name: meta.name,
      description: meta.description,
      createdAt: now,
      updatedAt: now,
      author: meta.author,
    },
    uiTree,
    data: {
      initial: initialData,
      sources: dataSources,
    },
    actions: {
      generated: generatedActions,
    },
    components: {
      source: componentSource,
      used: usedComponents,
      catalog: catalogSubset,
    },
    apis,
    project: projectConfig,
    context,
  };
}

/**
 * 从 DataSource 提取 API 信息
 */
function extractApisFromDataSources(
  dataSources: DataSource[]
): ApiEndpointInfo[] {
  const apis: ApiEndpointInfo[] = [];

  for (const source of dataSources) {
    const { id, api } = source;

    if (api.list) {
      apis.push({
        id: `${id}-list`,
        name: `获取${id}列表`,
        url: api.list.url,
        method: api.list.method ?? "GET",
        queryParams: extractQueryParams(api.list),
        response: {
          contentType: "application/json",
          schema: { type: "array" },
        },
      });
    }

    if (api.get) {
      apis.push({
        id: `${id}-get`,
        name: `获取${id}详情`,
        url: api.get.url,
        method: "GET",
        pathParams: extractPathParams(api.get.url),
      });
    }

    if (api.create) {
      apis.push({
        id: `${id}-create`,
        name: `创建${id}`,
        url: api.create.url,
        method: api.create.method ?? "POST",
      });
    }

    if (api.update) {
      apis.push({
        id: `${id}-update`,
        name: `更新${id}`,
        url: api.update.url,
        method: api.update.method ?? "PUT",
        pathParams: extractPathParams(api.update.url),
      });
    }

    if (api.delete) {
      apis.push({
        id: `${id}-delete`,
        name: `删除${id}`,
        url: api.delete.url,
        method: "DELETE",
        pathParams: extractPathParams(api.delete.url),
      });
    }
  }

  return apis;
}
```

### 5.3 导出格式选项

```typescript
/**
 * 导出为 URL（短链接服务）
 */
export async function exportToUrl(schema: ExportSchema): Promise<string> {
  // 压缩 JSON
  const json = JSON.stringify(schema);
  const compressed = await compress(json);
  const encoded = base64UrlEncode(compressed);

  // 如果太长，使用短链接服务
  if (encoded.length > 2000) {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });
    const { id } = await response.json();
    return `https://yourapp.com/export/${id}`;
  }

  return `https://yourapp.com/import?data=${encoded}`;
}

/**
 * 导出为 JSON 文件
 */
export function exportToJson(schema: ExportSchema): string {
  return JSON.stringify(schema, null, 2);
}

/**
 * 导出为 GitHub Gist
 */
export async function exportToGist(
  schema: ExportSchema,
  githubToken: string
): Promise<string> {
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: schema.meta.description ?? schema.meta.name,
      public: false,
      files: {
        "export.json": {
          content: JSON.stringify(schema, null, 2),
        },
      },
    }),
  });

  const { html_url } = await response.json();
  return html_url;
}
```

---

## 6. Playground 预览机制

### 6.1 预览架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Playground 预览架构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐                                                    │
│  │  Chat Panel │  用户输入 Prompt                                    │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │  AI Engine  │  生成 UITree + DataSources + Actions               │
│  └──────┬──────┘                                                    │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │                  Preview Runtime                         │        │
│  │                                                          │        │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │        │
│  │  │ DataProvider │  │ MockProvider │  │ActionProvider│   │        │
│  │  │  (真实数据)   │  │  (模拟数据)  │  │  (元操作)    │   │        │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │        │
│  │         │                 │                 │           │        │
│  │         ▼                 ▼                 ▼           │        │
│  │  ┌──────────────────────────────────────────────────┐   │        │
│  │  │                   Renderer                        │   │        │
│  │  │            渲染 UITree → React 组件               │   │        │
│  │  └──────────────────────────────────────────────────┘   │        │
│  │                                                          │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌─────────────┐                                                    │
│  │ Code Panel  │  显示生成的代码                                     │
│  └─────────────┘                                                    │
│                                                                      │
│  ┌─────────────┐                                                    │
│  │Export Button│  导出 Schema                                        │
│  └─────────────┘                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Mock 数据处理

```typescript
// packages/react/src/contexts/mock-data-source.tsx

/**
 * Mock 模式的 DataSourceProvider
 * 用于 Playground 预览，不发起真实 API 请求
 */
export function MockDataSourceProvider({
  sources,
  children,
}: DataSourceProviderProps) {
  const { get, set, update } = useData();

  // 使用 mock 数据而非真实 API
  const fetchSource = async (sourceId: string): Promise<void> => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;

    const { path, mockData } = source;

    // 设置 loading
    set(`${path}/loading`, true);

    // 模拟延迟
    if (mockData?.delay) {
      await new Promise((resolve) => setTimeout(resolve, mockData.delay));
    }

    // 使用 mock 数据
    if (mockData?.list) {
      update({
        [`${path}/data`]: mockData.list,
        [`${path}/pagination/total`]: mockData.list.length,
        [`${path}/loading`]: false,
      });
    } else {
      // 生成随机 mock 数据
      const generatedMock = generateMockData(source);
      update({
        [`${path}/data`]: generatedMock,
        [`${path}/loading`]: false,
      });
    }
  };

  // Mock 创建
  const createRecord = async (
    sourceId: string,
    data: unknown
  ): Promise<unknown> => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) throw new Error("Source not found");

    const { path } = source;
    const currentData = (get(`${path}/data`) as unknown[]) ?? [];

    // 生成 mock ID
    const newRecord = {
      id: `mock-${Date.now()}`,
      ...(data as object),
    };

    // 添加到列表
    set(`${path}/data`, [...currentData, newRecord]);

    return newRecord;
  };

  // Mock 更新
  const updateRecord = async (
    sourceId: string,
    id: string,
    data: unknown
  ): Promise<unknown> => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) throw new Error("Source not found");

    const { path } = source;
    const currentData = (get(`${path}/data`) as unknown[]) ?? [];

    const updatedData = currentData.map((item) => {
      if ((item as { id: string }).id === id) {
        return { ...item, ...(data as object) };
      }
      return item;
    });

    set(`${path}/data`, updatedData);

    return data;
  };

  // Mock 删除
  const deleteRecord = async (sourceId: string, id: string): Promise<void> => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) throw new Error("Source not found");

    const { path } = source;
    const currentData = (get(`${path}/data`) as unknown[]) ?? [];

    const filteredData = currentData.filter(
      (item) => (item as { id: string }).id !== id
    );

    set(`${path}/data`, filteredData);
  };

  // 自动 mock 获取
  useEffect(() => {
    sources.forEach((source) => {
      if (source.autoFetch?.onMount) {
        fetchSource(source.id);
      }
    });
  }, []);

  // ... 其余实现
}

/**
 * 根据 Schema 生成 Mock 数据
 */
function generateMockData(source: DataSource): unknown[] {
  // 可以集成 faker.js 或其他 mock 库
  return [
    { id: "1", name: "Mock Item 1", createdAt: new Date().toISOString() },
    { id: "2", name: "Mock Item 2", createdAt: new Date().toISOString() },
    { id: "3", name: "Mock Item 3", createdAt: new Date().toISOString() },
  ];
}
```

### 6.3 Playground 组件更新

```typescript
// apps/web/components/playground.tsx

interface PlaygroundProps {
  initialPrompt?: string;
}

export function Playground({ initialPrompt }: PlaygroundProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [previewMode, setPreviewMode] = useState<"mock" | "live">("mock");

  // 当前生成的配置
  const [generatedConfig, setGeneratedConfig] = useState<{
    uiTree: UITree | null;
    dataSources: DataSource[];
    initialData: Record<string, unknown>;
    generatedActions: Record<string, GeneratedActionDefinition>;
  }>({
    uiTree: null,
    dataSources: [],
    initialData: {},
    generatedActions: {},
  });

  // 处理 AI 生成
  const handleGenerate = async (prompt: string) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt,
        previousTree: currentVersion?.tree,
        catalog: getCatalog(),
      }),
    });

    // 流式处理响应
    const reader = response.body?.getReader();
    // ... 处理 JSON Patch 流
  };

  // 导出
  const handleExport = async () => {
    const schema = generateExportSchema({
      uiTree: generatedConfig.uiTree!,
      dataSources: generatedConfig.dataSources,
      initialData: generatedConfig.initialData,
      generatedActions: generatedConfig.generatedActions,
      componentSource: {
        type: "npm",
        npm: {
          package: "@yourorg/ui",
          version: "1.0.0",
          exports: { /* ... */ },
        },
      },
      catalog: getCatalog(),
      projectConfig: {
        type: "nextjs",
        styling: "tailwind",
      },
      meta: {
        name: "Generated Page",
        description: versions[0]?.prompt,
      },
      context: {
        prompts: versions.map(v => v.prompt),
      },
    });

    const url = await exportToUrl(schema);
    // 显示导出结果
  };

  return (
    <div className="playground">
      {/* Chat Panel */}
      <ChatPanel
        versions={versions}
        onGenerate={handleGenerate}
      />

      {/* Preview Panel */}
      <PreviewPanel
        uiTree={generatedConfig.uiTree}
        dataSources={generatedConfig.dataSources}
        initialData={generatedConfig.initialData}
        mode={previewMode}
        onModeChange={setPreviewMode}
      />

      {/* Code Panel */}
      <CodePanel
        uiTree={generatedConfig.uiTree}
        dataSources={generatedConfig.dataSources}
      />

      {/* Export Button */}
      <ExportButton
        disabled={!generatedConfig.uiTree}
        onExport={handleExport}
      />
    </div>
  );
}

/**
 * Preview Panel 组件
 */
function PreviewPanel({
  uiTree,
  dataSources,
  initialData,
  mode,
  onModeChange,
}: PreviewPanelProps) {
  if (!uiTree) {
    return <EmptyState message="等待生成..." />;
  }

  const DataSourceProviderComponent = mode === "mock"
    ? MockDataSourceProvider
    : DataSourceProvider;

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <select value={mode} onChange={e => onModeChange(e.target.value as "mock" | "live")}>
          <option value="mock">Mock 模式</option>
          <option value="live">Live 模式</option>
        </select>
      </div>

      <div className="preview-content">
        <DataProvider initialData={initialData}>
          <DataSourceProviderComponent sources={dataSources}>
            <ActionProvider handlers={useMetaActionHandlers()}>
              <Renderer
                tree={uiTree}
                registry={componentRegistry}
              />
            </ActionProvider>
          </DataSourceProviderComponent>
        </DataProvider>
      </div>
    </div>
  );
}
```

---

## 7. Code Agent 还原流程

### 7.1 还原流程概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Code Agent 还原流程                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: 获取 Export Schema                                         │
│  ├─ 从 URL 下载 JSON                                                │
│  └─ 验证 Schema 格式                                                │
│                                                                      │
│  Step 2: 分析依赖                                                    │
│  ├─ 解析 components.source                                          │
│  ├─ 解析 project.dependencies                                       │
│  └─ 生成 package.json                                               │
│                                                                      │
│  Step 3: 生成组件代码                                                │
│  ├─ 如果 source.type === "npm"：安装 npm 包                         │
│  ├─ 如果 source.type === "local"：复制组件文件                      │
│  └─ 如果 source.type === "inline"：写入内联代码                     │
│                                                                      │
│  Step 4: 生成 API 客户端                                            │
│  ├─ 根据 apis 生成类型定义                                          │
│  └─ 生成 API 调用函数                                               │
│                                                                      │
│  Step 5: 生成 Action Handlers                                       │
│  ├─ 内置元操作使用框架提供的 handler                                 │
│  └─ 生成的 Action 转换为 TypeScript 代码                            │
│                                                                      │
│  Step 6: 生成页面组件                                                │
│  ├─ 将 UITree 转换为 JSX                                            │
│  ├─ 注入数据绑定逻辑                                                │
│  └─ 生成完整的 React 组件                                           │
│                                                                      │
│  Step 7: 生成项目配置                                                │
│  ├─ tsconfig.json                                                   │
│  ├─ tailwind.config.js（如果使用 Tailwind）                         │
│  └─ next.config.js（如果是 Next.js）                                │
│                                                                      │
│  Step 8: 运行和测试                                                  │
│  ├─ npm install                                                     │
│  └─ npm run dev                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Code Agent 指令模板

````markdown
# 从 Export Schema 还原项目

## 输入

Export Schema URL: `{url}`

## 步骤

### 1. 下载并解析 Schema

```bash
curl -o export.json {url}
```
````

### 2. 创建项目结构

根据 `project.type` 创建项目：

- 如果是 `nextjs`：`npx create-next-app@latest {name} --typescript --tailwind`
- 如果是 `vite-react`：`npm create vite@latest {name} -- --template react-ts`

### 3. 安装依赖

```bash
# 从 export.json 中提取依赖
npm install {dependencies}
```

### 4. 生成文件

根据 Schema 生成以下文件：

#### 4.1 组件文件

- 路径：`src/components/`
- 来源：`components.source`

#### 4.2 API 客户端

- 路径：`src/api/client.ts`
- 内容：根据 `apis` 生成

#### 4.3 Action Handlers

- 路径：`src/actions/`
- 内容：根据 `actions.generated` 生成

#### 4.4 页面组件

- 路径：`src/pages/` 或 `app/`
- 内容：将 `uiTree` 转换为 JSX

#### 4.5 数据层

- 路径：`src/hooks/`
- 内容：根据 `data.sources` 生成自定义 hooks

### 5. 运行项目

```bash
npm run dev
```

## 验证

1. 页面正确渲染
2. 数据正确加载
3. 交互正常工作

````

### 7.3 代码生成器实现

```typescript
// packages/codegen/src/project-generator.ts

import type { ExportSchema } from "@json-render/core";

/**
 * 项目生成器
 */
export class ProjectGenerator {
  private schema: ExportSchema;
  private outputDir: string;

  constructor(schema: ExportSchema, outputDir: string) {
    this.schema = schema;
    this.outputDir = outputDir;
  }

  /**
   * 生成完整项目
   */
  async generate(): Promise<GeneratedProject> {
    const files: GeneratedFile[] = [];

    // 1. package.json
    files.push(this.generatePackageJson());

    // 2. tsconfig.json
    files.push(this.generateTsConfig());

    // 3. 组件文件
    files.push(...this.generateComponents());

    // 4. API 客户端
    files.push(this.generateApiClient());

    // 5. Action handlers
    files.push(...this.generateActionHandlers());

    // 6. 数据 hooks
    files.push(...this.generateDataHooks());

    // 7. 页面组件
    files.push(this.generatePageComponent());

    // 8. 样式文件
    files.push(this.generateStyles());

    return {
      files,
      instructions: this.generateInstructions(),
    };
  }

  /**
   * 生成 package.json
   */
  private generatePackageJson(): GeneratedFile {
    const { project, components } = this.schema;

    const packageJson = {
      name: this.schema.meta.name.toLowerCase().replace(/\s+/g, "-"),
      version: "0.1.0",
      private: true,
      scripts: {
        dev: project.type === "nextjs" ? "next dev" : "vite",
        build: project.type === "nextjs" ? "next build" : "vite build",
        start: project.type === "nextjs" ? "next start" : "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        ...(project.type === "nextjs" ? { next: "^14.0.0" } : {}),
        ...(components.source.type === "npm"
          ? { [components.source.npm!.package]: components.source.npm!.version }
          : {}),
        ...project.dependencies,
      },
      devDependencies: {
        typescript: project.typescript ?? "^5.0.0",
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        ...(project.styling === "tailwind"
          ? { tailwindcss: "^3.4.0", autoprefixer: "^10.4.0", postcss: "^8.4.0" }
          : {}),
        ...project.devDependencies,
      },
    };

    return {
      path: "package.json",
      content: JSON.stringify(packageJson, null, 2),
    };
  }

  /**
   * 生成 API 客户端
   */
  private generateApiClient(): GeneratedFile {
    const { apis } = this.schema;

    let content = `// Auto-generated API client\n\n`;

    // 生成类型定义
    content += `// Types\n`;
    for (const api of apis) {
      if (api.requestBody?.schema) {
        content += `export interface ${pascalCase(api.id)}Request ${jsonSchemaToTs(api.requestBody.schema)}\n\n`;
      }
      if (api.response?.schema) {
        content += `export interface ${pascalCase(api.id)}Response ${jsonSchemaToTs(api.response.schema)}\n\n`;
      }
    }

    // 生成 API 函数
    content += `// API Functions\n`;
    for (const api of apis) {
      const funcName = camelCase(api.id);
      const hasPathParams = api.pathParams && api.pathParams.length > 0;
      const hasQueryParams = api.queryParams && api.queryParams.length > 0;
      const hasBody = api.method !== "GET" && api.method !== "DELETE";

      const params: string[] = [];
      if (hasPathParams) {
        params.push(
          api.pathParams!.map(p => `${p.name}: ${p.type}`).join(", ")
        );
      }
      if (hasQueryParams) {
        params.push(
          `query?: { ${api.queryParams!.map(p => `${p.name}?: ${p.type}`).join("; ")} }`
        );
      }
      if (hasBody) {
        params.push(`data: ${pascalCase(api.id)}Request`);
      }

      let url = api.url;
      if (hasPathParams) {
        for (const p of api.pathParams!) {
          url = url.replace(`:${p.name}`, `\${${p.name}}`);
        }
      }

      content += `
export async function ${funcName}(${params.join(", ")}): Promise<${pascalCase(api.id)}Response> {
  let url = \`${url}\`;
  ${hasQueryParams ? `
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) params.set(key, String(value));
    });
    url += \`?\${params.toString()}\`;
  }` : ""}

  const response = await fetch(url, {
    method: "${api.method}",
    headers: {
      "Content-Type": "application/json",
    },
    ${hasBody ? `body: JSON.stringify(data),` : ""}
  });

  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
  }

  return response.json();
}
`;
    }

    return {
      path: "src/api/client.ts",
      content,
    };
  }

  /**
   * 生成页面组件
   */
  private generatePageComponent(): GeneratedFile {
    const { uiTree, data, components } = this.schema;

    // 收集导入
    const imports = new Set<string>();
    const usedComponents = components.used;

    for (const component of usedComponents) {
      imports.add(component);
    }

    // 生成 JSX
    const jsx = this.generateJsx(uiTree.root, uiTree.elements);

    // 生成数据 hooks 调用
    const dataHooks = data.sources.map(source => {
      return `const { data: ${source.id}, loading: ${source.id}Loading, refetch: refetch${pascalCase(source.id)} } = use${pascalCase(source.id)}();`;
    });

    const content = `"use client";

import React, { useState } from "react";
import { ${Array.from(imports).join(", ")} } from "@/components/ui";
${data.sources.map(s => `import { use${pascalCase(s.id)} } from "@/hooks/use${pascalCase(s.id)}";`).join("\n")}

export default function Page() {
  // Data
  ${dataHooks.join("\n  ")}

  // Local state
  const [formData, setFormData] = useState(${JSON.stringify(data.initial.form ?? {})});
  const [uiState, setUiState] = useState(${JSON.stringify(data.initial.ui ?? {})});

  return (
    ${jsx}
  );
}
`;

    const pagePath = this.schema.project.type === "nextjs"
      ? "app/page.tsx"
      : "src/pages/index.tsx";

    return {
      path: pagePath,
      content,
    };
  }

  /**
   * 递归生成 JSX
   */
  private generateJsx(
    elementKey: string,
    elements: Record<string, UIElement>,
    indent: number = 4
  ): string {
    const element = elements[elementKey];
    if (!element) return "";

    const { type, props, children } = element;
    const indentStr = " ".repeat(indent);

    // 序列化 props
    const propsStr = Object.entries(props)
      .filter(([key]) => key !== "children")
      .map(([key, value]) => {
        if (typeof value === "object" && value !== null && "path" in value) {
          // 动态值
          return `${key}={${this.pathToExpression((value as { path: string }).path)}}`;
        }
        return serializePropValue(key, value);
      })
      .join(" ");

    if (!children || children.length === 0) {
      return `<${type} ${propsStr} />`;
    }

    const childrenJsx = children
      .map(childKey => this.generateJsx(childKey, elements, indent + 2))
      .join(`\n${indentStr}`);

    return `<${type} ${propsStr}>
${indentStr}  ${childrenJsx}
${indentStr}</${type}>`;
  }

  /**
   * 将数据路径转换为 JS 表达式
   */
  private pathToExpression(path: string): string {
    // /users/data → users?.data
    // /form/name → formData.name
    // /ui/modalVisible → uiState.modalVisible

    const segments = path.slice(1).split("/");
    const root = segments[0];
    const rest = segments.slice(1);

    if (root === "form") {
      return `formData${rest.map(s => `.${s}`).join("")}`;
    }
    if (root === "ui") {
      return `uiState${rest.map(s => `.${s}`).join("")}`;
    }

    // 数据源
    return `${root}${rest.map(s => `?.${s}`).join("")}`;
  }

  /**
   * 生成使用说明
   */
  private generateInstructions(): string {
    return `
# 项目还原说明

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
\`\`\`

## 项目结构

\`\`\`
${this.schema.meta.name}/
├── src/
│   ├── api/
│   │   └── client.ts          # API 客户端
│   ├── components/
│   │   └── ui/                # UI 组件
│   ├── hooks/
│   │   └── use*.ts            # 数据 hooks
│   ├── actions/
│   │   └── handlers.ts        # Action 处理器
│   └── pages/                 # 页面组件
├── package.json
└── tsconfig.json
\`\`\`

## API 接口

${this.schema.apis.map(api => `
### ${api.name}
- URL: \`${api.url}\`
- Method: ${api.method}
`).join("\n")}

## 备注

${this.schema.context?.notes ?? "无"}
`;
  }
}

/**
 * 生成的项目
 */
interface GeneratedProject {
  files: GeneratedFile[];
  instructions: string;
}

/**
 * 生成的文件
 */
interface GeneratedFile {
  path: string;
  content: string;
}
````

---

## 8. API 接口规范

### 8.1 生成接口

```typescript
// POST /api/generate
interface GenerateRequest {
  /** 用户提示词 */
  prompt: string;
  /** 之前的 UITree（用于迭代） */
  previousTree?: UITree;
  /** 生成配置 */
  config?: {
    /** 是否生成 DataSource */
    generateDataSources?: boolean;
    /** 是否生成 Mock 数据 */
    generateMockData?: boolean;
    /** 目标框架 */
    targetFramework?: "nextjs" | "vite-react";
  };
}

interface GenerateResponse {
  /** 流式响应，每行一个 JSON Patch */
  // Content-Type: text/event-stream
  // 格式: {"op":"add","path":"/elements/key","value":{...}}
}
```

### 8.2 导出接口

```typescript
// POST /api/export
interface ExportRequest {
  /** Export Schema */
  schema: ExportSchema;
}

interface ExportResponse {
  /** 导出 ID */
  id: string;
  /** 访问 URL */
  url: string;
  /** 过期时间 */
  expiresAt: string;
}

// GET /api/export/:id
interface GetExportResponse {
  /** Export Schema */
  schema: ExportSchema;
}
```

### 8.3 短链接服务

```typescript
// POST /api/shorten
interface ShortenRequest {
  /** 完整 URL 或数据 */
  data: string;
}

interface ShortenResponse {
  /** 短链接 */
  shortUrl: string;
  /** 原始数据 ID */
  id: string;
}

// GET /api/s/:id
// 重定向或返回数据
```

---

## 9. 实现路线图

### 9.1 Phase 1: Action 系统扩展（1-2 周）

- [ ] 定义所有元操作类型
- [ ] 实现元操作 Handler
- [ ] 更新 ActionProvider 支持元操作
- [ ] 添加流程控制操作（sequence, conditional, loop）
- [ ] 编写测试

### 9.2 Phase 2: Data 系统扩展（1-2 周）

- [ ] 定义 DataSource 类型
- [ ] 实现 DataSourceProvider
- [ ] 实现 MockDataSourceProvider
- [ ] 添加数据源相关 Action
- [ ] 编写测试

### 9.3 Phase 3: Export Schema 设计（1 周）

- [ ] 定义完整的 Export Schema
- [ ] 实现 Schema 验证
- [ ] 实现 Export 生成器
- [ ] 添加导出格式支持（URL, JSON, Gist）

### 9.4 Phase 4: Playground 更新（1-2 周）

- [ ] 更新 AI 提示词支持新功能
- [ ] 添加 DataSource 配置 UI
- [ ] 添加 Mock/Live 切换
- [ ] 添加 Export 按钮和流程
- [ ] 优化预览体验

### 9.5 Phase 5: Code Agent 集成（1-2 周）

- [ ] 实现 ProjectGenerator
- [ ] 生成所有必要文件
- [ ] 编写 Code Agent 指令模板
- [ ] 测试完整还原流程
- [ ] 编写文档

### 9.6 Phase 6: 测试与优化（1 周）

- [ ] 端到端测试
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 文档完善

---

## 附录

### A. 术语表

| 术语          | 说明                                  |
| ------------- | ------------------------------------- |
| UITree        | 扁平化的 UI 结构，用于 LLM 生成和渲染 |
| Catalog       | 组件目录，定义 AI 可用的组件及其约束  |
| DataSource    | 数据源配置，定义数据的获取和操作方式  |
| Meta Action   | 内置的通用操作，可组合实现任意逻辑    |
| Export Schema | 导出的完整配置，包含所有还原所需信息  |
| DynamicValue  | 动态值，可以是字面量或数据路径引用    |

### B. UI 组件库配置

当前系统使用 **Ant Design 5.x** 作为默认 UI 组件库。

#### B.1 已集成的 Antd 组件

| 组件     | Antd 组件                 | 说明                               |
| -------- | ------------------------- | ---------------------------------- |
| Button   | Button                    | 支持 type、danger、size、loading   |
| Card     | Card                      | 支持 title、size、bordered         |
| Input    | Input / Input.Password    | 支持 type、placeholder、size       |
| Select   | Select                    | 支持 options、placeholder、mode    |
| Checkbox | Checkbox                  | 支持 checked、disabled             |
| Radio    | Radio.Group               | 支持 options、direction            |
| Switch   | Switch                    | 支持 checked、size                 |
| Alert    | Alert                     | 支持 type、showIcon、closable      |
| Avatar   | Avatar                    | 支持 src、size、shape              |
| Badge    | Tag                       | 使用 Tag 实现状态标签              |
| Progress | Progress                  | 支持 percent、type、status         |
| Rating   | Rate                      | 支持 value、count、allowHalf       |
| Divider  | Divider                   | 支持 type、dashed                  |
| Heading  | Typography.Title          | 支持 level (1-5)                   |
| Text     | Typography.Text/Paragraph | 支持 type、strong                  |
| Link     | Typography.Link           | 支持 href、target                  |
| Stack    | Flex                      | 支持 vertical、gap、align、justify |
| Grid     | Row/Col                   | 支持 columns、gutter               |

#### B.2 Catalog 配置示例

```typescript
// catalog.ts - Ant Design 5.x 兼容配置
export const playgroundCatalog = createCatalog({
  name: "playground",
  components: {
    Button: {
      props: z.object({
        label: z.string(),
        type: z
          .enum(["primary", "default", "dashed", "text", "link"])
          .optional(),
        danger: z.boolean().optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
        loading: z.boolean().optional(),
      }),
      description: "Ant Design Button",
    },
    Input: {
      props: z.object({
        label: z.string().optional(),
        name: z.string(),
        type: z.enum(["text", "email", "password", "number"]).optional(),
        placeholder: z.string().optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
      }),
      description: "Ant Design Input",
    },
    // ... 其他组件
  },
});
```

#### B.3 扩展其他组件库

如需使用其他组件库（如 shadcn/ui、Material UI），需要：

1. 安装对应组件库依赖
2. 重写 `apps/web/components/demo/` 中的组件适配器
3. 更新 `apps/web/lib/catalog.ts` 中的 props schema
4. 更新 Export Schema 中的 `components.source` 配置

### C. 参考资料

- [JSON Pointer (RFC 6901)](https://tools.ietf.org/html/rfc6901)
- [JSON Patch (RFC 6902)](https://tools.ietf.org/html/rfc6902)
- [Zod Schema Validation](https://zod.dev/)
- [React Context API](https://react.dev/reference/react/useContext)
- [Ant Design 5.x](https://ant.design/)

### D. 版本历史

| 版本 | 日期       | 说明                       |
| ---- | ---------- | -------------------------- |
| 0.1  | 2024-XX-XX | 初稿                       |
| 0.2  | 2024-XX-XX | 集成 Ant Design 5.x 组件库 |
