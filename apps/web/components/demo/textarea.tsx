"use client";

import { Input, Form } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { TextArea: AntTextArea } = Input;

export function Textarea({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const rows = (props.rows as number) || 3;

  const textarea = (
    <AntTextArea
      placeholder={(props.placeholder as string) || undefined}
      rows={rows}
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
