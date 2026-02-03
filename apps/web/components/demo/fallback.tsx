"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

export function Fallback({ element }: ComponentRenderProps) {
  const customClass = getCustomClass(element.props);
  return (
    <Text type="secondary" className={customClass} style={{ fontSize: 10 }}>
      [{element.type}]
    </Text>
  );
}
