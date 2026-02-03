"use client";

import { Divider as AntDivider } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Divider({ element }: ComponentRenderProps) {
  const customClass = getCustomClass(element.props);
  return <AntDivider className={customClass} style={{ margin: "8px 0" }} />;
}
