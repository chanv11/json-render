"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass } from "./utils";

const { Text } = Typography;

interface DataPoint {
  label: string;
  value: number;
}

export function LineGraph({ element }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const data = (props.data as DataPoint[]) || [];
  const title = props.title as string | undefined;
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  // SVG dimensions with padding
  const width = 300;
  const height = 100;
  const padding = { top: 10, right: 10, bottom: 10, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points for the SVG path
  const points = data.map((d, i) => {
    const x =
      padding.left +
      (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2);
    const y =
      padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;
    return { x, y, ...d };
  });

  const pathD =
    points.length > 0
      ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`
      : "";

  return (
    <div className={customClass}>
      {title && (
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          {title}
        </Text>
      )}
      <div style={{ position: "relative", height: 96 }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight / 2}
            x2={width - padding.right}
            y2={padding.top + chartHeight / 2}
            stroke="#d9d9d9"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#d9d9d9"
            strokeWidth="1"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#d9d9d9"
            strokeWidth="1"
          />
          {/* Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#1677ff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* Points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#1677ff" />
          ))}
        </svg>
      </div>
      {data.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          {data.map((d, i) => (
            <Text
              key={i}
              type="secondary"
              style={{
                fontSize: 10,
                textAlign: "center",
                width: `${100 / data.length}%`,
              }}
            >
              {d.label}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}
