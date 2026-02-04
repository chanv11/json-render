"use client";

import { Input as AntInput, Form } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import {
  getCustomClass,
  isActionValue,
  isPathBinding,
  resolveBoundValue,
} from "./utils";

function coerceInputValue(type: string, rawValue: string): string | number {
  if (type !== "number") {
    return rawValue;
  }
  if (rawValue.length === 0) {
    return "";
  }
  const numeric = Number(rawValue);
  return Number.isNaN(numeric) ? rawValue : numeric;
}

export function Input({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get, set } = useData();
  const customClass = getCustomClass(props);
  const inputType = (props.type as string) || "text";
  const action = props.onChangeAction;
  const explicitValuePath =
    typeof props.valuePath === "string" ? props.valuePath : undefined;
  const binding = isPathBinding(props.value) ? props.value.path : undefined;
  const valuePath = explicitValuePath ?? binding;
  const boundValue =
    valuePath !== undefined
      ? (get(valuePath) as string | number | undefined)
      : resolveBoundValue<string | number>(props.value, get);
  const isControlledByData =
    valuePath !== undefined || isPathBinding(props.value);

  const InputComponent =
    inputType === "password" ? AntInput.Password : AntInput;

  const input = (
    <InputComponent
      type={inputType === "password" ? undefined : inputType}
      placeholder={(props.placeholder as string) || undefined}
      allowClear={Boolean(props.allowClear)}
      disabled={Boolean(props.disabled)}
      maxLength={props.maxLength as number | undefined}
      size="small"
      value={
        isControlledByData
          ? ((boundValue as string | undefined) ?? "")
          : undefined
      }
      defaultValue={
        isControlledByData
          ? undefined
          : (props.defaultValue as string | undefined)
      }
      onChange={(event) => {
        const nextValue = coerceInputValue(inputType, event.target.value);
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
    />
  );

  if (props.label) {
    return (
      <Form.Item label={props.label as string} style={{ marginBottom: 8 }}>
        {input}
      </Form.Item>
    );
  }

  return input;
}
