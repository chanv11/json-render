"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Link: AntLink } = Typography;

export function Link({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);

  return (
    <AntLink
      href={props.href as string}
      target="_blank"
      className={customClass}
    >
      {props.label as string}
    </AntLink>
  );
}
