"use client";

import { useState } from "react";
import { Switch as AntSwitch, Flex, Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

export function Switch({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const [checked, setChecked] = useState(!!props.checked);

  return (
    <Flex justify="space-between" align="center" className={customClass}>
      <Text>{props.label as string}</Text>
      <AntSwitch checked={checked} onChange={setChecked} size="small" />
    </Flex>
  );
}
