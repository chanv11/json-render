"use client";

import { Input, Form } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import {
  getCustomClass,
  isActionValue,
  isPathBinding,
  resolveBoundValue,
} from "./utils";

const { TextArea: AntTextArea } = Input;

export function Textarea({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get, set } = useData();
  const customClass = getCustomClass(props);
  const rows = (props.rows as number) || 3;
  const action = props.onChangeAction;
  const explicitValuePath =
    typeof props.valuePath === "string" ? props.valuePath : undefined;
  const binding = isPathBinding(props.value) ? props.value.path : undefined;
  const valuePath = explicitValuePath ?? binding;
  const boundValue =
    valuePath !== undefined
      ? (get(valuePath) as string | undefined)
      : resolveBoundValue<string>(props.value, get);
  const isControlledByData =
    valuePath !== undefined || isPathBinding(props.value);

  const textarea = (
    <AntTextArea
      placeholder={(props.placeholder as string) || undefined}
      rows={rows}
      maxLength={props.maxLength as number | undefined}
      showCount={Boolean(props.showCount)}
      disabled={Boolean(props.disabled)}
      value={isControlledByData ? (boundValue ?? "") : undefined}
      defaultValue={
        isControlledByData
          ? undefined
          : (props.defaultValue as string | undefined)
      }
      onChange={(event) => {
        const nextValue = event.target.value;
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
        {textarea}
      </Form.Item>
    );
  }

  return textarea;
}
