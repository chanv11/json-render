"use client";

import { Select as AntSelect, Form } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import {
  getCustomClass,
  getSelectValue,
  isActionValue,
  isPathBinding,
  resolveBoundValue,
  setSelectValueForKey,
} from "./utils";

export function Select({ element, onAction }: ComponentRenderProps) {
  const { props, key } = element;
  const { get, set } = useData();
  const customClass = getCustomClass(props);
  const options = (props.options as string[]) || [];
  const action = props.onChangeAction;
  const explicitValuePath =
    typeof props.valuePath === "string" ? props.valuePath : undefined;
  const binding = isPathBinding(props.value) ? props.value.path : undefined;
  const valuePath = explicitValuePath ?? binding;
  const selectedValue =
    valuePath !== undefined
      ? resolveBoundValue<string | string[]>({ path: valuePath }, get)
      : (resolveBoundValue<string | string[]>(props.value, get) ??
        getSelectValue(key));

  const selectOptions = options.map((opt) => ({
    value: opt,
    label: opt,
  }));

  const select = (
    <AntSelect
      value={selectedValue}
      mode={props.mode as "multiple" | "tags" | undefined}
      allowClear={Boolean(props.allowClear)}
      disabled={Boolean(props.disabled)}
      onChange={(value) => {
        setSelectValueForKey(
          key,
          Array.isArray(value) ? value.join(",") : value,
        );
        if (valuePath) {
          set(valuePath, value);
        }
        if (isActionValue(action)) {
          void onAction?.(action, {
            $event: {
              value,
              name: props.name,
            },
          });
        }
      }}
      options={selectOptions}
      placeholder={(props.placeholder as string) || "Select..."}
      size="small"
      className={customClass}
      style={{ width: "100%" }}
    />
  );

  if (props.label) {
    return (
      <Form.Item label={props.label as string} style={{ marginBottom: 8 }}>
        {select}
      </Form.Item>
    );
  }

  return select;
}
