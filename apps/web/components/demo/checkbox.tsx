"use client";

import { useState } from "react";
import { Checkbox as AntCheckbox } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Checkbox({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const [checked, setChecked] = useState(!!props.checked);

  return (
    <AntCheckbox
      checked={checked}
      onChange={(e) => setChecked(e.target.checked)}
      className={customClass}
    >
      {props.label as string}
    </AntCheckbox>
  );
}
