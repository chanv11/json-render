"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Title } = Typography;

export function Heading({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const level = ((props.level as number) || 2) as 1 | 2 | 3 | 4 | 5;

  return (
    <Title level={level} className={customClass} style={{ margin: 0 }}>
      {props.text as string}
    </Title>
  );
}
