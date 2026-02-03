"use client";

import { Select as AntSelect, Form } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass, getSelectValue, setSelectValueForKey } from "./utils";

export function Select({ element }: ComponentRenderProps) {
  const { props, key } = element;
  const customClass = getCustomClass(props);
  const options = (props.options as string[]) || [];
  const selectedValue = getSelectValue(key);

  const selectOptions = options.map((opt) => ({
    value: opt,
    label: opt,
  }));

  const select = (
    <AntSelect
      value={selectedValue}
      onChange={(value) => setSelectValueForKey(key, value)}
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
