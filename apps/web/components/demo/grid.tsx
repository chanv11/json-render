"use client";

import { Row, Col } from "antd";
import React from "react";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

export function Grid({ element, children }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const columns = (props.columns as number) || 1;

  const gutter = props.gap === "lg" ? 24 : props.gap === "sm" ? 8 : 16;

  const span = Math.floor(24 / columns);

  // Wrap each child in a Col
  const childArray = React.Children.toArray(children);

  return (
    <Row gutter={[gutter, gutter]} className={customClass}>
      {childArray.map((child, index) => (
        <Col key={index} span={span}>
          {child}
        </Col>
      ))}
    </Row>
  );
}
