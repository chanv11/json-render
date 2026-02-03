"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Paragraph, Text: AntText } = Typography;

export function Text({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const textVariant = props.variant as string;
  const content = (props.text ?? props.content) as string;

  if (textVariant === "caption") {
    return (
      <AntText
        type="secondary"
        className={customClass}
        style={{ fontSize: 12 }}
      >
        {content}
      </AntText>
    );
  }

  if (textVariant === "muted") {
    return (
      <AntText type="secondary" className={customClass}>
        {content}
      </AntText>
    );
  }

  return (
    <Paragraph className={customClass} style={{ marginBottom: 0 }}>
      {content}
    </Paragraph>
  );
}
