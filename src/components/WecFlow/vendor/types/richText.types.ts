export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
}

export type RichTextAlign = "left" | "center" | "right";
export type RichTextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export interface RichText {
  runs: RichTextRun[];
  align?: RichTextAlign;
  lineHeight?: number;
  letterSpacing?: number;
  transform?: RichTextTransform;
  spacing?: number;
}
