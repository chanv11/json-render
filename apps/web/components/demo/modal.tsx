"use client";

import { Modal as AntModal } from "antd";
import { useData } from "@json-render/react";
import type { ComponentRenderProps } from "./types";
import { getCustomClass, isActionValue, resolveBoundValue } from "./utils";

function resolveWidth(value: unknown): number | string | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (value === "sm") {
    return 420;
  }
  if (value === "md") {
    return 560;
  }
  if (value === "lg") {
    return 760;
  }
  if (value === "full") {
    return "90vw";
  }
  return undefined;
}

export function Modal({ element, children, onAction }: ComponentRenderProps) {
  const { props } = element;
  const { get } = useData();
  const customClass = getCustomClass(props);
  const open = resolveBoundValue<boolean>(props.open, get) ?? true;
  const width = resolveWidth(props.width);
  const onCancelAction = props.onCancelAction;

  return (
    <AntModal
      open={open}
      title={props.title as string | undefined}
      centered={Boolean(props.centered)}
      destroyOnClose={Boolean(props.destroyOnClose)}
      maskClosable={props.maskClosable !== false}
      footer={null}
      width={width}
      className={customClass}
      onCancel={() => {
        if (isActionValue(onCancelAction)) {
          void onAction?.(onCancelAction);
          return;
        }
        if (typeof props.onCancelActionName === "string") {
          void onAction?.({ name: props.onCancelActionName });
        }
      }}
    >
      {children}
    </AntModal>
  );
}
