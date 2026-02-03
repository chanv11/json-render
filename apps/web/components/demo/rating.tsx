"use client";

import { Rate, Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

export function Rating({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const ratingValue = (props.value as number) || 0;
  const maxRating = (props.max as number) || 5;
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
      <Rate disabled value={ratingValue} count={maxRating} />
    </div>
  );
}
