# JSON Render 第一阶段实施清单（不含 Export Schema）

> 目标：先打通「生成 -> 交互 -> 数据 CRUD -> Playground 验证」运行时闭环，不包含导出与 Code Agent 还原。

## 1. 范围定义

### 1.1 本阶段必须完成（In Scope）

1. Action 系统升级为「内置元操作 + 业务预定义 + 可组合执行」。
2. DataSource 系统落地（live + mock），支持 CRUD、分页、加载与错误状态。
3. React 运行时上下文打通（DataProvider / DataSourceProvider / ActionProvider / Renderer）。
4. Playground 升级为可验证交互和 CRUD 的工作台（支持 mock/live 切换）。
5. `/api/generate` 协议升级，支持输出 `uiTree + dataSources + initialData + generatedActions`。
6. 补齐测试与文档，保证主流程可回归。

### 1.2 本阶段不做（Out of Scope）

1. Export Schema 设计与校验。
2. `/api/export`、短链服务、Gist 导出。
3. Code Agent 项目还原器。

## 2. 交付标准（阶段验收）

1. 输入「生成用户管理 CRUD 页面」后，Playground 可直接增删改查。
2. 可在 Playground 里切换 `mock/live` 模式，行为一致、可观测 loading/error。
3. 组合 Action（如 `sequence + conditional + fetch + showToast`）可执行。
4. 全仓 `pnpm type-check` 通过，新增核心单测通过。

### 2.1 生成协议最小契约（MVP）

第一阶段先固定 `/api/generate` 的目标数据结构，前后端都按该结构对齐：

```json
{
  "uiTree": {
    "root": "page",
    "elements": {
      "page": {
        "key": "page",
        "type": "Stack",
        "props": { "direction": "vertical", "gap": "md" },
        "children": ["toolbar", "table"]
      },
      "toolbar": {
        "key": "toolbar",
        "type": "Button",
        "props": { "label": "新增用户", "action": { "name": "openCreateModal" } }
      },
      "table": {
        "key": "table",
        "type": "Table",
        "props": {
          "dataSource": { "path": "/users/data" },
          "loading": { "path": "/users/loading" }
        }
      }
    }
  },
  "dataSources": [
    {
      "id": "users",
      "path": "/users",
      "type": "rest",
      "api": {
        "list": { "url": "/api/users", "method": "GET" },
        "create": { "url": "/api/users", "method": "POST", "bodyPath": "/form/data" },
        "update": { "url": "/api/users/:id", "method": "PUT", "bodyPath": "/form/data" },
        "delete": { "url": "/api/users/:id", "method": "DELETE" }
      },
      "autoFetch": { "onMount": true },
      "refetchOn": ["create", "update", "delete"]
    }
  ],
  "initialData": {
    "users": {
      "data": [],
      "loading": false,
      "error": null,
      "pagination": { "page": 1, "pageSize": 10, "total": 0 }
    },
    "form": { "data": { "name": "", "email": "", "role": "user" }, "errors": {} },
    "ui": { "modalVisible": false, "editMode": false, "selectedId": null }
  },
  "generatedActions": {
    "openCreateModal": {
      "description": "打开新增弹窗并重置表单",
      "composed": {
        "name": "updateData",
        "params": {
          "updates": {
            "/form/data": { "name": "", "email": "", "role": "user" },
            "/ui/modalVisible": true,
            "/ui/editMode": false,
            "/ui/selectedId": null
          }
        }
      }
    },
    "submitUser": {
      "description": "新增或更新用户，成功后提示并刷新",
      "composed": {
        "name": "conditional",
        "params": {
          "condition": { "path": "/ui/editMode" },
          "then": { "name": "updateRecord", "params": { "sourceId": "users", "id": { "path": "/ui/selectedId" } } },
          "else": { "name": "createRecord", "params": { "sourceId": "users" } }
        },
        "onSuccess": {
          "name": "sequence",
          "params": {
            "actions": [
              { "name": "showToast", "params": { "message": "保存成功", "type": "success" } },
              { "name": "setData", "params": { "path": "/ui/modalVisible", "value": false } },
              { "name": "refetchSource", "params": { "sourceId": "users" } }
            ]
          }
        },
        "onError": {
          "name": "showToast",
          "params": { "message": "保存失败: ${$error.message}", "type": "error" }
        }
      }
    }
  }
}
```

该结构满足最小 CRUD 场景：列表拉取、提交接口、删除接口、成功提示、失败提示、操作后刷新。

## 3. 工作拆解（按工作流）

## 3.1 工作流 A：Action 系统扩展

### A1. 扩展 Core Action 类型与 Schema
- 产出：
  - 新增 Meta Actions 类型定义（数据操作、流程控制、UI 控制、数据源操作）。
  - Action Schema 支持递归组合（如 `sequence`、`conditional`）。
  - 明确 P0 必选元操作列表。
- 关键文件：
  - `packages/core/src/actions.ts`
  - `packages/core/src/index.ts`

### A1-补充：P0 必选元操作清单

第一阶段必须可用的元操作（缺一不可）：

1. 数据操作：`setData`、`updateData`
2. 流程控制：`sequence`、`conditional`
3. 数据源操作：`fetchSource`、`createRecord`、`updateRecord`、`deleteRecord`、`refetchSource`
4. 反馈能力：`showToast`

第一阶段建议实现（P1）：

1. `setPage`、`setSort`、`setFilters`
2. `validateForm`
3. `openModal`、`closeModal`

### A2. 实现 Meta Action 执行引擎
- 产出：
  - 元操作执行器（可链式 onSuccess/onError）。
  - 动态变量解析（至少覆盖 `$event`、`$row`、`$error`）。
  - 明确动态上下文解析规则并固化测试。
- 关键文件：
  - `packages/react/src/contexts/actions.tsx`
  - `packages/react/src/contexts/meta-actions.tsx`（新增）

### A2-补充：动态上下文约定（必须实现）

执行 Action 时统一上下文：

1. 数据模型：`/xxx` 从 `dataModel` 解析。
2. 事件对象：`/$event/xxx` 从组件事件载荷解析。
3. 行数据：`/$row/xxx` 从表格当前行数据解析。
4. 错误对象：`${$error.message}` 用于 `onError` 文案与字段赋值。

字符串插值规则：

1. 支持 `${/path}`、`${/$row/name}`、`${$error.message}`。
2. 路径不存在时返回空字符串，不抛异常。
3. `onError` 上下文必须可访问 `$error`。

### A3. 兼容业务自定义 Action
- 产出：
  - 保持现有 `handlers` 机制不变。
  - 元操作与业务 handler 可混用。
- 关键文件：
  - `packages/react/src/contexts/actions.tsx`

## 3.2 工作流 B：DataSource 系统落地

### B1. 定义 DataSource 类型
- 产出：
  - `DataSource`、`ApiEndpoint`、分页/排序/筛选配置的类型和 Zod Schema。
- 关键文件：
  - `packages/core/src/data-source.ts`（新增）
  - `packages/core/src/index.ts`

### B2. 实现 DataSourceProvider（Live）
- 产出：
  - `fetchSource/createRecord/updateRecord/deleteRecord/refetchSource`。
  - 自动拉取（onMount）、loading/error/lastUpdated 状态管理。
- 关键文件：
  - `packages/react/src/contexts/data-source.tsx`（新增）
  - `packages/react/src/index.ts`

### B3. 实现 MockDataSourceProvider
- 产出：
  - 基于 `mockData` 或自动 mock 生成数据。
  - CRUD 模拟行为与 live 接口保持一致。
- 关键文件：
  - `packages/react/src/contexts/mock-data-source.tsx`（新增）
  - `packages/react/src/index.ts`

### B4. 增加 DataSource 相关内置 Action
- 产出：
  - `fetchSource/createRecord/updateRecord/deleteRecord/setPage/setSort/setFilters`。
- 关键文件：
  - `packages/core/src/actions.ts`
  - `packages/react/src/contexts/meta-actions.tsx`

## 3.3 工作流 C：运行时集成

### C1. Renderer 与上下文编排
- 产出：
  - 统一运行时组合：`DataProvider -> DataSourceProvider -> ActionProvider -> Renderer`。
  - 动作执行中可访问 DataSource 能力。
- 关键文件：
  - `packages/react/src/renderer.tsx`
  - `packages/react/src/index.ts`

### C2. Playground 侧状态模型升级
- 产出：
  - 生成结果从仅 `uiTree` 扩展到：
    - `uiTree`
    - `dataSources`
    - `initialData`
    - `generatedActions`
- 关键文件：
  - `apps/web/components/playground.tsx`

## 3.4 工作流 D：生成接口协议升级（仅生成，不导出）

### D1. `/api/generate` 输出结构升级
- 产出：
  - 支持返回完整配置对象（可先非流式跑通，再补流式 patch）。
  - Prompt 模板加入 DataSource / Meta Action 约束。
- 关键文件：
  - `apps/web/app/api/generate/route.ts`

### D2. 前端解析策略升级
- 产出：
  - Playground 能解析新协议并更新各子状态。
- 关键文件：
  - `apps/web/components/playground.tsx`
  - `packages/react/src/hooks.ts`（如需扩展流式协议）

## 3.5 工作流 E：Playground 可验证性建设

### E1. Mock / Live 模式切换
- 产出：
  - Preview 面板可切换模式，UI 明确显示当前模式。
- 关键文件：
  - `apps/web/components/playground.tsx`

### E2. Demo 组件适配交互字段
- 产出：
  - 表单、表格、弹窗、消息等组件可响应新的 action/data 结构。
- 关键文件：
  - `apps/web/components/demo/table.tsx`
  - `apps/web/components/demo/message.tsx`
  - `apps/web/components/demo/*.tsx`（按需）
  - `apps/web/lib/catalog.ts`

## 3.6 工作流 F：测试与文档

### F1. 单元测试
- 产出：
  - Action 执行（组合、错误链路、动态值解析）测试。
  - DataSource live/mock 行为测试。
- 关键文件：
  - `packages/core/src/actions.test.ts`
  - `packages/react/src/contexts/*.test.tsx`

### F2. 集成测试（最小闭环）
- 产出：
  - 覆盖「生成 CRUD -> 交互 -> 状态变化」核心路径。
- 关键文件：
  - `apps/web` 对应测试（新增）

### F3. 文档同步
- 产出：
  - 更新 docs 中 Action/Data/Playground 的实际能力说明。
- 关键文件：
  - `apps/web/app/(main)/docs/*.tsx`
  - `docs/EXPORT_SYSTEM_DESIGN.md`（必要时同步状态）

## 4. 实施顺序（建议）

1. A（Action Core）  
2. B（DataSource Core）  
3. C（运行时集成）  
4. D（生成接口）  
5. E（Playground 交互）  
6. F（测试与文档收口）

## 5. 任务看板（可直接勾选）

- [ ] A1 扩展 Action 类型与 Schema
- [ ] A2 实现 Meta Action 执行引擎
- [ ] A3 兼容业务自定义 Action
- [ ] B1 定义 DataSource 类型与 Schema
- [ ] B2 实现 DataSourceProvider（Live）
- [ ] B3 实现 MockDataSourceProvider
- [ ] B4 落地 DataSource 相关内置 Action
- [ ] C1 运行时上下文编排打通
- [ ] C2 Playground 状态模型升级
- [ ] D1 `/api/generate` 协议升级
- [ ] D2 前端解析新协议
- [ ] E1 Playground mock/live 切换
- [ ] E2 Demo 组件交互适配
- [ ] F1 核心单测补齐
- [ ] F2 最小闭环集成测试
- [ ] F3 文档更新

## 6. 风险与处理

1. 风险：Action 递归组合导致执行复杂度上升。  
处理：先限制组合深度并加执行日志。

2. 风险：live/mock 行为不一致导致调试困难。  
处理：统一 `DataSourceContext` 接口，mock 与 live 共用调用签名。

3. 风险：生成协议一次性切换影响现有流程。  
处理：先做兼容分支（旧 `uiTree` + 新结构并存），再逐步切换。

## 7. 完成定义（Definition of Done）

1. Playground 可完成一次端到端 CRUD 演示（mock 与 live 均可）。
2. Action 组合链路与错误处理可观察、可测试。
3. DataSource 状态（data/loading/error/pagination）可从 UI 清晰验证。
4. 所有新增代码经过类型检查与测试，主流程无回归。

### 7.1 必测验收用例：用户管理 CRUD

以下用例作为阶段验收门槛（至少覆盖 mock + live）：

1. 首次加载自动拉取 `/api/users`，表格展示数据，`loading` 正确变化。
2. 点击“新增用户”打开弹窗并重置 `form`，提交后调用 `createRecord`。
3. 新增成功后显示 success message，并触发 `refetchSource(users)`。
4. 编辑已有用户时调用 `updateRecord`，成功后关闭弹窗并刷新列表。
5. 删除用户时调用 `deleteRecord`，成功后显示 success message 并刷新。
6. 任意接口失败时显示 error message（包含 `$error.message`），数据不被错误覆盖。
7. `mock/live` 切换后上述行为语义一致（接口来源不同，但状态流转一致）。
