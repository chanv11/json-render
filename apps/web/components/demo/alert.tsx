"use client";

import { Alert as AntAlert } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Alert({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const alertType = props.type as string;

  const type =
    alertType === "success"
      ? "success"
      : alertType === "warning"
        ? "warning"
        : alertType === "error"
          ? "error"
          : "info";

  return (
    <AntAlert
      title={props.title as string}
      description={props.message as string | undefined}
      type={type}
      showIcon
      className={customClass}
    />
  );
}
