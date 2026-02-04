"use client";

import { Switch as AntSwitch, Flex, Typography } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import {
  getCustomClass,
  isActionValue,
  isPathBinding,
  resolveBoundValue,
} from "./utils";

const { Text } = Typography;

export function Switch({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get, set } = useData();
  const customClass = getCustomClass(props);
  const action = props.onChangeAction;
  const explicitCheckedPath =
    typeof props.checkedPath === "string" ? props.checkedPath : undefined;
  const binding = isPathBinding(props.checked) ? props.checked.path : undefined;
  const checkedPath = explicitCheckedPath ?? binding;
  const checked =
    checkedPath !== undefined
      ? Boolean(get(checkedPath))
      : Boolean(resolveBoundValue<boolean>(props.checked, get));

  return (
    <Flex justify="space-between" align="center" className={customClass}>
      <Text>{props.label as string}</Text>
      <AntSwitch
        checked={checked}
        size={(props.size as "default" | "small") ?? "small"}
        disabled={Boolean(props.disabled)}
        onChange={(nextChecked) => {
          if (checkedPath) {
            set(checkedPath, nextChecked);
          }
          if (isActionValue(action)) {
            void onAction?.(action, {
              $event: {
                checked: nextChecked,
                name: props.name,
              },
            });
          }
        }}
      />
    </Flex>
  );
}
