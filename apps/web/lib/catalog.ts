import { createCatalog, ActionSchema } from "@json-render/core";
import { z } from "zod";

const PathBindingSchema = z.object({ path: z.string() });

/**
 * Web playground component catalog (Ant Design 5.x compatible)
 *
 * This defines the components available for AI generation in the playground.
 * All props align with Ant Design 5.x component APIs.
 */
export const playgroundCatalog = createCatalog({
  name: "playground",
  components: {
    // Layout Components
    Card: {
      props: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        size: z.enum(["default", "small"]).optional(),
        bordered: z.boolean().optional(),
        maxWidth: z.enum(["sm", "md", "lg", "full"]).optional(),
        centered: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      hasChildren: true,
      description:
        "Ant Design Card container for content sections. Use for forms/content boxes.",
    },

    Modal: {
      props: z.object({
        title: z.string().optional(),
        open: z.union([z.boolean(), PathBindingSchema]).optional(),
        width: z
          .union([
            z.literal("sm"),
            z.literal("md"),
            z.literal("lg"),
            z.literal("full"),
            z.number(),
          ])
          .optional(),
        centered: z.boolean().optional(),
        destroyOnClose: z.boolean().optional(),
        maskClosable: z.boolean().optional(),
        onCancelAction: ActionSchema.optional(),
        onCancelActionName: z.string().optional(),
        className: z.array(z.string()).optional(),
      }),
      hasChildren: true,
      description:
        "Ant Design Modal dialog for add/edit flows. Use visible/path or open binding to control display.",
    },

    Stack: {
      props: z.object({
        direction: z.enum(["horizontal", "vertical"]).optional(),
        gap: z.enum(["none", "sm", "md", "lg"]).optional(),
        align: z.enum(["start", "center", "end", "stretch"]).optional(),
        justify: z
          .enum(["start", "center", "end", "between", "around"])
          .optional(),
        wrap: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      hasChildren: true,
      description: "Ant Design Flex container for layouts",
    },

    Grid: {
      props: z.object({
        columns: z
          .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(6),
          ])
          .optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      hasChildren: true,
      description: "Ant Design Row/Col grid layout (1-6 columns)",
    },

    Divider: {
      props: z.object({
        type: z.enum(["horizontal", "vertical"]).optional(),
        dashed: z.boolean().optional(),
        orientation: z.enum(["left", "center", "right"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Divider separator line",
    },

    // Form Inputs
    Input: {
      props: z.object({
        label: z.string().optional(),
        name: z.string(),
        type: z.enum(["text", "email", "password", "number"]).optional(),
        value: z.union([z.string(), z.number(), PathBindingSchema]).optional(),
        valuePath: z.string().optional(),
        defaultValue: z.union([z.string(), z.number()]).optional(),
        placeholder: z.string().optional(),
        disabled: z.boolean().optional(),
        allowClear: z.boolean().optional(),
        maxLength: z.number().optional(),
        onChangeAction: ActionSchema.optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Input text field",
    },

    Textarea: {
      props: z.object({
        label: z.string().optional(),
        name: z.string(),
        value: z.union([z.string(), PathBindingSchema]).optional(),
        valuePath: z.string().optional(),
        defaultValue: z.string().optional(),
        placeholder: z.string().optional(),
        rows: z.number().optional(),
        maxLength: z.number().optional(),
        showCount: z.boolean().optional(),
        disabled: z.boolean().optional(),
        onChangeAction: ActionSchema.optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design TextArea multi-line input",
    },

    Select: {
      props: z.object({
        label: z.string().optional(),
        name: z.string(),
        value: z
          .union([z.string(), z.array(z.string()), PathBindingSchema])
          .optional(),
        valuePath: z.string().optional(),
        options: z.array(z.string()),
        placeholder: z.string().optional(),
        disabled: z.boolean().optional(),
        allowClear: z.boolean().optional(),
        mode: z.enum(["multiple", "tags"]).optional(),
        onChangeAction: ActionSchema.optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Select dropdown",
    },

    Checkbox: {
      props: z.object({
        label: z.string(),
        name: z.string(),
        checked: z.union([z.boolean(), PathBindingSchema]).optional(),
        checkedPath: z.string().optional(),
        disabled: z.boolean().optional(),
        onChangeAction: ActionSchema.optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Checkbox input",
    },

    Radio: {
      props: z.object({
        label: z.string().optional(),
        name: z.string(),
        options: z.array(z.string()),
        value: z.union([z.string(), PathBindingSchema]).optional(),
        valuePath: z.string().optional(),
        direction: z.enum(["horizontal", "vertical"]).optional(),
        disabled: z.boolean().optional(),
        onChangeAction: ActionSchema.optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Radio button group",
    },

    Switch: {
      props: z.object({
        label: z.string(),
        name: z.string(),
        checked: z.union([z.boolean(), PathBindingSchema]).optional(),
        checkedPath: z.string().optional(),
        disabled: z.boolean().optional(),
        onChangeAction: ActionSchema.optional(),
        size: z.enum(["default", "small"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Switch toggle",
    },

    // Actions
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["primary", "default", "danger"]).optional(),
        type: z
          .enum(["primary", "default", "dashed", "text", "link"])
          .optional(),
        danger: z.boolean().optional(),
        disabled: z.boolean().optional(),
        loading: z.boolean().optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
        block: z.boolean().optional(),
        icon: z.string().optional(),
        actionText: z.string().optional(),
        action: ActionSchema.optional(),
        actionName: z.string().optional(),
        className: z.array(z.string()).optional(),
      }),
      description:
        "Ant Design Button. actionText is shown in toast on click (defaults to label). Use type='primary' for main actions, danger=true for destructive actions.",
    },

    Link: {
      props: z.object({
        label: z.string(),
        href: z.string(),
        target: z.enum(["_blank", "_self"]).optional(),
        action: ActionSchema.optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Typography Link",
    },

    // Typography
    Heading: {
      props: z.object({
        text: z.string(),
        level: z
          .union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
          ])
          .optional(),
        type: z.enum(["secondary", "success", "warning", "danger"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Typography.Title heading (h1-h5)",
    },

    Text: {
      props: z.object({
        text: z.string(),
        type: z.enum(["secondary", "success", "warning", "danger"]).optional(),
        strong: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.boolean().optional(),
        disabled: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Typography.Text/Paragraph",
    },

    // Data Display
    Image: {
      props: z.object({
        src: z.string().optional(),
        alt: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        preview: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      description:
        "Ant Design Image (displays alt text as placeholder if no src)",
    },

    Avatar: {
      props: z.object({
        src: z.string().optional(),
        name: z.string(),
        size: z
          .union([z.enum(["large", "small", "default"]), z.number()])
          .optional(),
        shape: z.enum(["circle", "square"]).optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Avatar with fallback initials",
    },

    Badge: {
      props: z.object({
        text: z.string(),
        color: z
          .enum(["success", "processing", "error", "warning", "default"])
          .optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Tag (used as status badge)",
    },

    Alert: {
      props: z.object({
        title: z.string(),
        message: z.string().optional(),
        type: z.enum(["success", "info", "warning", "error"]).optional(),
        showIcon: z.boolean().optional(),
        closable: z.boolean().optional(),
        banner: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Alert banner",
    },

    Message: {
      props: z.object({
        content: z.string(),
        type: z
          .enum(["success", "info", "warning", "error", "loading"])
          .optional(),
        duration: z.number().optional(),
        action: ActionSchema.optional(),
        actionName: z.string().optional(),
        actionText: z.string().optional(),
      }),
      description:
        "Ant Design Message toast notification. Triggers a toast on mount, can optionally trigger an action on mount, renders nothing visible.",
    },

    Progress: {
      props: z.object({
        value: z.number(),
        max: z.number().optional(),
        label: z.string().optional(),
        type: z.enum(["line", "circle", "dashboard"]).optional(),
        status: z.enum(["success", "exception", "normal", "active"]).optional(),
        showInfo: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Progress bar (value 0-100)",
    },

    Rating: {
      props: z.object({
        value: z.number(),
        max: z.number().optional(),
        label: z.string().optional(),
        allowHalf: z.boolean().optional(),
        disabled: z.boolean().optional(),
        className: z.array(z.string()).optional(),
      }),
      description: "Ant Design Rate star rating",
    },

    // Charts (custom implementation, same API)
    BarGraph: {
      props: z.object({
        title: z.string().optional(),
        data: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
          }),
        ),
        className: z.array(z.string()).optional(),
      }),
      description: "Vertical bar chart",
    },

    LineGraph: {
      props: z.object({
        title: z.string().optional(),
        data: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
          }),
        ),
        className: z.array(z.string()).optional(),
      }),
      description: "Line chart with points",
    },

    // Data Table
    Table: {
      props: z.object({
        columns: z.array(
          z.object({
            key: z.string(),
            title: z.string(),
            dataIndex: z.string().optional(),
            width: z.union([z.number(), z.string()]).optional(),
            align: z.enum(["left", "center", "right"]).optional(),
            fixed: z.enum(["left", "right"]).optional(),
            ellipsis: z.boolean().optional(),
            sortable: z.boolean().optional(),
            // Render options (use one of these)
            render: z
              .array(
                z.object({
                  type: z.string(),
                  props: z.record(z.string(), z.unknown()),
                }),
              )
              .optional(), // Fixed components for action columns
            renderType: z
              .enum(["tag", "tags", "link", "badge", "avatar", "image"])
              .optional(), // Predefined render type
            renderProps: z.record(z.string(), z.unknown()).optional(), // Props for renderType, supports {{value}} and {{record.field}} templates
          }),
        ),
        dataSource: z
          .union([
            z.array(z.record(z.string(), z.unknown())),
            PathBindingSchema,
          ])
          .optional(),
        data: z
          .union([
            z.array(z.record(z.string(), z.unknown())),
            PathBindingSchema,
          ])
          .optional(),
        rowKey: z.string().optional(),
        size: z.enum(["large", "middle", "small"]).optional(),
        bordered: z.boolean().optional(),
        loading: z.union([z.boolean(), PathBindingSchema]).optional(),
        showHeader: z.boolean().optional(),
        pagination: z
          .union([
            z.boolean(),
            PathBindingSchema,
            z.object({
              pageSize: z.number().optional(),
              current: z.number().optional(),
              total: z.number().optional(),
            }),
          ])
          .optional(),
        className: z.array(z.string()).optional(),
      }),
      description:
        "Ant Design Table. Use renderType for predefined renders (tag/tags/link/badge/avatar/image), or render array for action buttons. Supports {{value}} and {{record.field}} templates in props.",
    },
  },
  validation: "strict",
});
