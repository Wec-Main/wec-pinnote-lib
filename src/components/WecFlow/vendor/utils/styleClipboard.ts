import type { FlowNodeStyle } from "../types/flow.types";

const STYLE_CLIPBOARD_KEY = "wpn-ui:wecFlowStyleClipboard";
const DEFAULT_STYLE_KEY = "wpn-ui:wecFlowDefaultNodeStyle";

function readStoredStyle(key: string): Partial<FlowNodeStyle> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<FlowNodeStyle>) : null;
  } catch {
    return null;
  }
}

function writeStoredStyle(key: string, style: Partial<FlowNodeStyle>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(style));
  } catch {
    return;
  }
}

export function readStyleClipboard(): Partial<FlowNodeStyle> | null {
  return readStoredStyle(STYLE_CLIPBOARD_KEY);
}

export function writeStyleClipboard(style: Partial<FlowNodeStyle>): void {
  writeStoredStyle(STYLE_CLIPBOARD_KEY, style);
}

export function readDefaultNodeStyle(): Partial<FlowNodeStyle> | null {
  return readStoredStyle(DEFAULT_STYLE_KEY);
}

export function writeDefaultNodeStyle(style: Partial<FlowNodeStyle>): void {
  writeStoredStyle(DEFAULT_STYLE_KEY, style);
}
