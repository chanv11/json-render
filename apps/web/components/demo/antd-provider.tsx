"use client";

import { ConfigProvider, theme } from "antd";
import type { ReactNode } from "react";

interface AntdProviderProps {
  children: ReactNode;
}

export function AntdProvider({ children }: AntdProviderProps) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 6,
          fontSize: 14,
        },
        components: {
          Card: {
            paddingLG: 16,
          },
          Button: {
            controlHeight: 32,
          },
          Input: {
            controlHeight: 32,
          },
          Select: {
            controlHeight: 32,
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
