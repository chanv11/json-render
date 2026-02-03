"use client";

import { Avatar as AntAvatar } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Avatar({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const name = (props.name as string) || "?";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const size = props.size === "lg" ? 40 : props.size === "sm" ? 24 : 32;

  return (
    <AntAvatar
      src={props.src as string | undefined}
      size={size}
      className={customClass}
    >
      {initials}
    </AntAvatar>
  );
}
