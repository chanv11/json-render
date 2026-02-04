"use client";

import { Button as AntButton } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass, isActionValue } from "./utils";

export function Button({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const variant = (props.variant as string) || (props.type as string);
  const label = props.label as string;
  const actionText = (props.actionText as string) || label;
  const action = props.action;
  const actionName = props.actionName;
  const isActionLoading = props.loading as boolean | undefined;

  const type =
    variant === "primary"
      ? "primary"
      : variant === "danger"
        ? "primary"
        : "default";

  const danger = variant === "danger";

  return (
    <AntButton
      type={type}
      danger={danger}
      block={Boolean(props.block)}
      size="small"
      disabled={Boolean(props.disabled)}
      loading={isActionLoading}
      className={customClass}
      onClick={() => {
        if (isActionValue(action)) {
          void onAction?.(action);
          return;
        }
        if (typeof actionName === "string" && actionName.length > 0) {
          void onAction?.({ name: actionName });
          return;
        }
        (
          window as unknown as { __demoAction?: (text: string) => void }
        ).__demoAction?.(actionText);
      }}
    >
      {label}
    </AntButton>
  );
}
