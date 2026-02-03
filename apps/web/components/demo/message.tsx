"use client";

import { useEffect, useRef } from "react";
import { message } from "antd";
import type { ComponentRenderProps } from "./types";

type MessageType = "success" | "error" | "info" | "warning" | "loading";

export function Message({ element }: ComponentRenderProps) {
  const { props } = element;
  const hasShown = useRef(false);

  const content = (props.content as string) || (props.children as string) || "";
  const type = (props.type as MessageType) || "info";
  const duration = (props.duration as number) ?? 3;

  useEffect(() => {
    // Only show message once per render cycle
    if (hasShown.current || !content) return;
    hasShown.current = true;

    // Use static message API
    switch (type) {
      case "success":
        message.success(content, duration);
        break;
      case "error":
        message.error(content, duration);
        break;
      case "warning":
        message.warning(content, duration);
        break;
      case "loading":
        message.loading(content, duration);
        break;
      case "info":
      default:
        message.info(content, duration);
        break;
    }
  }, [content, type, duration]);

  // Message component renders nothing visible
  return null;
}
