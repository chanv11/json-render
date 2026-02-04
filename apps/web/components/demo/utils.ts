"use client";

import { useState } from "react";
import type { Action } from "@json-render/core";

// Helper to get custom classes (for backward compatibility)
export function getCustomClass(props: Record<string, unknown>): string {
  return Array.isArray(props.className)
    ? (props.className as string[]).join(" ")
    : "";
}

// State for interactive components (Select dropdown state)
let openSelect: string | null = null;
let setOpenSelect: (v: string | null) => void = () => {};
let selectValues: Record<string, string> = {};
let setSelectValues: (
  fn: (prev: Record<string, string>) => Record<string, string>,
) => void = () => {};

export function useInteractiveState() {
  const [_openSelect, _setOpenSelect] = useState<string | null>(null);
  const [_selectValues, _setSelectValues] = useState<Record<string, string>>(
    {},
  );

  openSelect = _openSelect;
  setOpenSelect = _setOpenSelect;
  selectValues = _selectValues;
  setSelectValues = _setSelectValues;

  return { openSelect, selectValues };
}

export function getOpenSelect() {
  return openSelect;
}

export function setOpenSelectValue(v: string | null) {
  setOpenSelect(v);
}

export function getSelectValue(key: string) {
  return selectValues[key];
}

export function setSelectValueForKey(key: string, value: string) {
  setSelectValues((prev) => ({ ...prev, [key]: value }));
}

export function isPathBinding(value: unknown): value is { path: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof (value as { path: unknown }).path === "string"
  );
}

export function resolveBoundValue<T>(
  value: unknown,
  get: (path: string) => unknown,
): T | undefined {
  if (isPathBinding(value)) {
    return get(value.path) as T | undefined;
  }
  return value as T | undefined;
}

export function resolvePathOrValue<T>(
  pathOrValue: unknown,
  get: (path: string) => unknown,
): T | undefined {
  if (typeof pathOrValue === "string" && pathOrValue.length > 0) {
    return get(pathOrValue) as T | undefined;
  }
  return resolveBoundValue<T>(pathOrValue, get);
}

export function isActionValue(value: unknown): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}
