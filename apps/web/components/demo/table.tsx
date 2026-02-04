"use client";

import { Table as AntTable, Space, Flex } from "antd";
import { useData } from "@json-render/react";
import type { ColumnsType } from "antd/es/table";
import type { ReactNode } from "react";
import type { ComponentRenderProps } from "./types";
import { getCustomClass, resolveBoundValue } from "./utils";
import { demoRegistry } from "./index";

// Check if value is a component definition (has type and props)
interface ComponentDef {
  type: string;
  props: Record<string, unknown>;
}

function isComponentDef(value: unknown): value is ComponentDef {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "props" in value &&
    typeof (value as ComponentDef).type === "string"
  );
}

// Render a nested component definition
function renderComponent(
  def: ComponentDef,
  key: string | undefined,
  options?: {
    onAction?: ComponentRenderProps["onAction"];
    row?: TableData;
  },
): ReactNode {
  const Component = demoRegistry[def.type];
  if (!Component) {
    return null;
  }
  const rowRuntime = options?.row ? { $row: options.row } : undefined;

  return (
    <Component
      key={key}
      element={{
        key: key || def.type,
        type: def.type,
        props: def.props,
      }}
      onAction={(action, runtime) => {
        const mergedRuntime =
          rowRuntime && runtime
            ? { ...rowRuntime, ...runtime }
            : (rowRuntime ?? runtime);
        void options?.onAction?.(action, mergedRuntime);
      }}
    />
  );
}

// Replace template variables like {{value}}, {{record.name}} with actual values
function interpolateTemplate(
  template: string,
  value: unknown,
  record: TableData,
): string {
  return template
    .replace(/\{\{value\}\}/g, String(value ?? ""))
    .replace(/\{\{record\.(\w+)\}\}/g, (_, key) => String(record[key] ?? ""));
}

// Process component props with template interpolation
function processTemplateValue(
  candidate: unknown,
  value: unknown,
  record: TableData,
): unknown {
  if (typeof candidate === "string" && candidate.includes("{{")) {
    return interpolateTemplate(candidate, value, record);
  }
  if (Array.isArray(candidate)) {
    return candidate.map((item) => processTemplateValue(item, value, record));
  }
  if (candidate && typeof candidate === "object") {
    const next: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(
      candidate as Record<string, unknown>,
    )) {
      next[nestedKey] = processTemplateValue(nestedValue, value, record);
    }
    return next;
  }
  return candidate;
}

function processComponentProps(
  props: Record<string, unknown>,
  value: unknown,
  record: TableData,
): Record<string, unknown> {
  return processTemplateValue(props, value, record) as Record<string, unknown>;
}

// Render type configurations
type RenderType = "tag" | "tags" | "link" | "badge" | "avatar" | "image";

interface ColumnConfig {
  key: string;
  title: string;
  dataIndex?: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  fixed?: "left" | "right";
  ellipsis?: boolean;
  sortable?: boolean;
  // Render options (mutually exclusive)
  render?: ComponentDef[]; // Fixed components (e.g., action buttons)
  renderType?: RenderType; // Predefined render type
  renderProps?: Record<string, unknown>; // Props for renderType component
}

interface TableData {
  [key: string]: unknown;
}

// Render cell value based on renderType
function renderByType(
  renderType: RenderType,
  renderProps: Record<string, unknown> | undefined,
  value: unknown,
  record: TableData,
  index: number,
  colKey: string,
  onAction?: ComponentRenderProps["onAction"],
): ReactNode {
  const baseKey = `${record.key || index}-${colKey}`;

  switch (renderType) {
    case "tag":
    case "badge": {
      // Single tag/badge
      const props = renderProps
        ? processComponentProps(renderProps, value, record)
        : { children: String(value ?? "") };
      return renderComponent(
        { type: "Badge", props: { children: String(value ?? ""), ...props } },
        baseKey,
        { onAction, row: record },
      );
    }
    case "tags": {
      // Array of tags
      const items = Array.isArray(value) ? value : [value];
      return (
        <Flex gap="small" wrap>
          {items.map((item, idx) => {
            if (isComponentDef(item)) {
              return renderComponent(item, `${baseKey}-${idx}`, {
                onAction,
                row: record,
              });
            }
            const tagProps = renderProps
              ? processComponentProps(renderProps, item, record)
              : {};
            return renderComponent(
              {
                type: "Badge",
                props: { children: String(item ?? ""), ...tagProps },
              },
              `${baseKey}-${idx}`,
              { onAction, row: record },
            );
          })}
        </Flex>
      );
    }
    case "link": {
      const props = renderProps
        ? processComponentProps(renderProps, value, record)
        : { children: String(value ?? "") };
      return renderComponent(
        { type: "Link", props: { children: String(value ?? ""), ...props } },
        baseKey,
        { onAction, row: record },
      );
    }
    case "avatar": {
      const props = renderProps
        ? processComponentProps(renderProps, value, record)
        : {
            fallback: String(value ?? "")
              .substring(0, 2)
              .toUpperCase(),
          };
      return renderComponent({ type: "Avatar", props }, baseKey, {
        onAction,
        row: record,
      });
    }
    case "image": {
      const props = renderProps
        ? processComponentProps(renderProps, value, record)
        : { src: String(value ?? ""), alt: "" };
      return renderComponent({ type: "Image", props }, baseKey, {
        onAction,
        row: record,
      });
    }
    default:
      return String(value ?? "");
  }
}

export function Table({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get } = useData();
  const customClass = getCustomClass(props);

  const columns = (props.columns as ColumnConfig[]) || [];
  const resolvedDataSource =
    resolveBoundValue<TableData[] | TableData>(props.dataSource, get) ??
    resolveBoundValue<TableData[] | TableData>(props.data, get);
  const dataSource = Array.isArray(resolvedDataSource)
    ? resolvedDataSource
    : [];
  const rowKey = (props.rowKey as string) || "id";
  const size = (props.size as "large" | "middle" | "small") || "small";
  const bordered = props.bordered as boolean | undefined;
  const loading = Boolean(resolveBoundValue<boolean>(props.loading, get));
  const showHeader = props.showHeader !== false;
  const pagination = resolveBoundValue<boolean | object>(props.pagination, get);

  // Convert column config to antd format
  const antdColumns: ColumnsType<TableData> = columns.map((col) => {
    const baseColumn = {
      key: col.key,
      title: col.title,
      dataIndex: col.dataIndex || col.key,
      width: col.width,
      align: col.align,
      fixed: col.fixed,
      ellipsis: col.ellipsis,
      sorter: col.sortable
        ? (a: TableData, b: TableData) => {
            const aVal = a[col.dataIndex || col.key];
            const bVal = b[col.dataIndex || col.key];
            if (typeof aVal === "number" && typeof bVal === "number") {
              return aVal - bVal;
            }
            return String(aVal).localeCompare(String(bVal));
          }
        : undefined,
    };

    // 1. Fixed render components (e.g., action buttons)
    if (col.render && Array.isArray(col.render)) {
      return {
        ...baseColumn,
        render: (_: unknown, record: TableData, index: number) => (
          <Space size="small">
            {col.render!.map((componentDef, idx) => {
              // Support template interpolation in render components
              const processedProps = processComponentProps(
                componentDef.props,
                _,
                record,
              );
              return renderComponent(
                { ...componentDef, props: processedProps },
                `${record.key || index}-action-${idx}`,
                {
                  onAction,
                  row: record,
                },
              );
            })}
          </Space>
        ),
      };
    }

    // 2. Predefined render type
    if (col.renderType) {
      return {
        ...baseColumn,
        render: (value: unknown, record: TableData, index: number) =>
          renderByType(
            col.renderType!,
            col.renderProps,
            value,
            record,
            index,
            col.key,
            onAction,
          ),
      };
    }

    // 3. Default render: check if cell value is a component definition or array
    return {
      ...baseColumn,
      render: (value: unknown, record: TableData, index: number) => {
        // Single component definition
        if (isComponentDef(value)) {
          return renderComponent(value, `${record.key || index}-${col.key}`, {
            onAction,
            row: record,
          });
        }
        // Array of component definitions
        if (
          Array.isArray(value) &&
          value.length > 0 &&
          isComponentDef(value[0])
        ) {
          return (
            <Flex gap="small" wrap>
              {value.map((item, idx) =>
                isComponentDef(item)
                  ? renderComponent(
                      item,
                      `${record.key || index}-${col.key}-${idx}`,
                      {
                        onAction,
                        row: record,
                      },
                    )
                  : String(item),
              )}
            </Flex>
          );
        }
        return value as ReactNode;
      },
    };
  });

  // Handle pagination config
  const paginationConfig =
    pagination === false
      ? false
      : pagination === true || pagination === undefined
        ? { pageSize: 10, size: "small" as const, showSizeChanger: false }
        : {
            pageSize: 10,
            size: "small" as const,
            showSizeChanger: false,
            ...pagination,
          };

  return (
    <AntTable
      columns={antdColumns}
      dataSource={dataSource}
      rowKey={rowKey}
      size={size}
      bordered={bordered}
      loading={loading}
      showHeader={showHeader}
      pagination={paginationConfig}
      className={customClass}
      scroll={{ x: "max-content" }}
    />
  );
}
