"use client";

import { Typography } from "antd";
import type { ComponentRenderProps } from "./types";
import { getCustomClass, isActionValue } from "./utils";

const { Link: AntLink } = Typography;

export function Link({ element, onAction }: ComponentRenderProps) {
  const { props } = element;
  const customClass = getCustomClass(props);
  const action = props.action;

  return (
    <AntLink
      href={props.href as string}
      target={(props.target as "_blank" | "_self" | undefined) ?? "_blank"}
      className={customClass}
      onClick={(event) => {
        if (!isActionValue(action)) {
          return;
        }
        event.preventDefault();
        void onAction?.(action, {
          $event: {
            href: props.href,
          },
        });
      }}
    >
      {props.label as string}
    </AntLink>
  );
}
