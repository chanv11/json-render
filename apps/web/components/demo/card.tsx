"use client";

import { Card as AntCard } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Card({ element, children }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);

  const maxWidthStyle =
    props.maxWidth === "sm"
      ? { maxWidth: 280, minWidth: 280 }
      : props.maxWidth === "md"
        ? { maxWidth: 320, minWidth: 320 }
        : props.maxWidth === "lg"
          ? { maxWidth: 360, minWidth: 360 }
          : { width: "100%" };

  const centeredStyle = props.centered ? { margin: "0 auto" } : {};

  const description = props.description as string | undefined;

  return (
    <AntCard
      title={props.title as string | undefined}
      size="small"
      className={customClass}
      style={{ ...maxWidthStyle, ...centeredStyle }}
    >
      {description && (
        <div
          style={{
            marginBottom: 8,
            color: "rgba(0, 0, 0, 0.45)",
            fontSize: 12,
          }}
        >
          {description}
        </div>
      )}
      {children}
    </AntCard>
  );
}
