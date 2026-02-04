import type { ReactNode } from "react";
import type {
  UIElement,
  Action,
  ActionRuntimeContext,
} from "@json-render/core";

export interface ComponentRenderProps {
  element: UIElement;
  children?: ReactNode;
  onAction?: (action: Action, runtime?: ActionRuntimeContext) => void;
  loading?: boolean;
}

export type ComponentRegistry = Record<
  string,
  React.ComponentType<ComponentRenderProps>
>;
