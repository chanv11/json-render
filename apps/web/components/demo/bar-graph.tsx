"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

interface DataPoint {
  label: string;
  value: number;
}

export function BarGraph({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const data = (props.data as DataPoint[]) || [];
  const title = props.title as string | undefined;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={customClass}>
      {title && (
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {title}
        </Text>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text type="secondary" style={{ fontSize: 10 }}>
              {d.value}
            </Text>
            <div
              style={{
                width: "100%",
                height: 80,
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#1677ff",
                  borderRadius: "4px 4px 0 0",
                  height: `${(d.value / maxValue) * 100}%`,
                  minHeight: 2,
                }}
              />
            </div>
            <Text
              type="secondary"
              style={{
                fontSize: 10,
                textAlign: "center",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
              }}
            >
              {d.label}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
