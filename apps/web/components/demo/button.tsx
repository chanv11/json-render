"use client";

import { Button as AntButton } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Button({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const variant = props.variant as string;
  const label = props.label as string;
  const actionText = (props.actionText as string) || label;

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
      size="small"
      className={customClass}
      onClick={() =>
        (
          window as unknown as { __demoAction?: (text: string) => void }
        ).__demoAction?.(actionText)
      }
    >
      {label}
    </AntButton>
  );
}
