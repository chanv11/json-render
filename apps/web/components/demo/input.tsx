"use client";

import { Input as AntInput, Form } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Input({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const inputType = (props.type as string) || "text";

  const InputComponent =
    inputType === "password" ? AntInput.Password : AntInput;

  const input = (
    <InputComponent
      type={inputType === "password" ? undefined : inputType}
      placeholder={(props.placeholder as string) || undefined}
      size="small"
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
