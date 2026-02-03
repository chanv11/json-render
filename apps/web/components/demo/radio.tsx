"use client";

import { useState } from "react";
import { Radio as AntRadio, Form, Space } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Radio({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const options = (props.options as string[]) || [];
  const [selected, setSelected] = useState(options[0] || "");

  const radioGroup = (
    <AntRadio.Group
      value={selected}
      onChange={(e) => setSelected(e.target.value)}
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
