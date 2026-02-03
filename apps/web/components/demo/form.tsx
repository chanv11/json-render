"use client";

import { Card } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Form({ element, children }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);

  return (
    <Card
      title={props.title as string | undefined}
      size="small"
      className={customClass}
    >
      {children}
    </Card>
  );
}
