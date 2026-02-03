"use client";

import { Progress as AntProgress, Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

export function Progress({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const value = Math.min(100, Math.max(0, (props.value as number) || 0));
  const max = (props.max as number) || 100;
  const percent = Math.round((value / max) * 100);
  const label = props.label as string | undefined;

  return (
    <div className={customClass}>
      {label && (
        <Text
          type="secondary"
          style={{ fontSize: 12, display: "block", marginBottom: 4 }}
        >
          {label}
        </Text>
      )}
      <AntProgress percent={percent} size="small" />
    </div>
  );
}
