"use client";

import { Tag } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Badge({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const badgeVariant = props.variant as string;

  const color =
    badgeVariant === "success"
      ? "success"
      : badgeVariant === "warning"
        ? "warning"
        : badgeVariant === "danger"
          ? "error"
          : "default";

  return (
    <Tag color={color} className={customClass}>
      {(props.text ?? props.label) as string}
    </Tag>
  );
}
