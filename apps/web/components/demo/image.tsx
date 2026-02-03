"use client";

import { Image as AntImage } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Image({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const width = (props.width as number) || 80;
  const height = (props.height as number) || 60;

  // Since we don't have actual images, show a placeholder
  return (
    <div
      className={customClass}
      style={{
        width,
        height,
        backgroundColor: "#f5f5f5",
        border: "1px solid #d9d9d9",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        color: "rgba(0, 0, 0, 0.45)",
      }}
    >
      {(props.alt as string) || "img"}
    </div>
  );
}
