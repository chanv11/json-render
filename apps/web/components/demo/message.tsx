"use client";

import { useEffect, useRef } from "react";
import { message } from "antd";
import type { ComponentRenderProps } from "./types";
import { isActionValue } from "./utils";

type MessageType = "success" | "error" | "info" | "warning" | "loading";

export function Message({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const hasShown = useRef(false);
  const hasTriggeredAction = useRef(false);

  const content = (props.content as string) || (props.children as string) || "";
  const type = (props.type as MessageType) || "info";
  const duration = (props.duration as number) ?? 3;
  const action = props.action;
  const actionName = props.actionName;

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

  useEffect(() => {
    if (hasTriggeredAction.current) return;
    hasTriggeredAction.current = true;

    if (isActionValue(action)) {
      void onAction?.(action);
      return;
    }

    if (typeof actionName === "string" && actionName.length > 0) {
      void onAction?.({ name: actionName });
      return;
    }

    if (typeof action === "string" && action.length > 0) {
      void onAction?.({ name: action });
    }
  }, [action, actionName, onAction]);

  // Message component renders nothing visible
  return null;
}
