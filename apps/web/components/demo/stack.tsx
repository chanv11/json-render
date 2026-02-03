"use client";

import { Flex } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Stack({ element, children }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const isHorizontal = props.direction === "horizontal";

  const gap =
    props.gap === "lg"
      ? 24
      : props.gap === "md"
        ? 16
        : props.gap === "sm"
          ? 8
          : props.gap === "none"
            ? 0
            : 16;

  const align =
    props.align === "center"
      ? "center"
      : props.align === "end"
        ? "flex-end"
        : props.align === "stretch"
          ? "stretch"
          : "flex-start";

  const justify =
    props.justify === "center"
      ? "center"
      : props.justify === "end"
        ? "flex-end"
        : props.justify === "between"
          ? "space-between"
          : props.justify === "around"
            ? "space-around"
            : "flex-start";

  return (
    <Flex
      vertical={!isHorizontal}
      gap={gap}
      align={align}
      justify={justify}
      wrap={isHorizontal ? "wrap" : undefined}
      className={customClass}
    >
      {children}
    </Flex>
  );
}
