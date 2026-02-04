"use client";

import { Radio as AntRadio, Form, Space } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import {
  getCustomClass,
  isActionValue,
  isPathBinding,
  resolveBoundValue,
} from "./utils";

export function Radio({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get, set } = useData();
  const customClass = getCustomClass(props);
  const options = (props.options as string[]) || [];
  const action = props.onChangeAction;
  const explicitValuePath =
    typeof props.valuePath === "string" ? props.valuePath : undefined;
  const binding = isPathBinding(props.value) ? props.value.path : undefined;
  const valuePath = explicitValuePath ?? binding;
  const selected =
    valuePath !== undefined
      ? ((get(valuePath) as string | undefined) ?? options[0] ?? "")
      : (resolveBoundValue<string>(props.value, get) ?? options[0] ?? "");

  const radioGroup = (
    <AntRadio.Group
      value={selected}
      onChange={(event) => {
        const nextValue = event.target.value as string;
        if (valuePath) {
          set(valuePath, nextValue);
        }
        if (isActionValue(action)) {
          void onAction?.(action, {
            $event: {
              value: nextValue,
              name: props.name,
            },
          });
        }
      }}
      className={customClass}
    >
      <Space direction="vertical">
        {options.map((opt, i) => (
          <AntRadio key={i} value={opt}>
            {opt}
          </AntRadio>
        ))}
      </Space>
    </AntRadio.Group>
  );

  if (props.label) {
    return (
      <Form.Item label={props.label as string} style={{ marginBottom: 8 }}>
        {radioGroup}
      </Form.Item>
    );
  }

  return radioGroup;
}
