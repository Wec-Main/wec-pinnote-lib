import type { ReactNode } from "react";

const FORMAT_TAGS: Record<string, "b" | "i" | "u"> = {
  B: "b",
  STRONG: "b",
  I: "i",
  EM: "i",
  U: "u",
};

function walk(node: ChildNode, key: { current: number }): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const el = node as Element;
  const children = Array.from(el.childNodes).map((child) => (
    <span key={key.current++}>{walk(child, key)}</span>
  ));
  const tag = FORMAT_TAGS[el.tagName];
  if (tag === "b") {
    return <b key={key.current++}>{children}</b>;
  }
  if (tag === "i") {
    return <i key={key.current++}>{children}</i>;
  }
  if (tag === "u") {
    return <u key={key.current++}>{children}</u>;
  }
  if (el.tagName === "BR") {
    return <br key={key.current++} />;
  }
  if (el.tagName === "DIV" || el.tagName === "P") {
    return (
      <span key={key.current++}>
        {children}
        <br />
      </span>
    );
  }
  return <>{children}</>;
}

/** Renders note content that may contain bold/italic/underline markup (from the note editor) as React nodes, without using dangerouslySetInnerHTML. */
export function parseRichText(html: string): ReactNode {
  if (!html) {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const key = { current: 0 };
  return Array.from(doc.body.childNodes).map((node) => (
    <span key={key.current++}>{walk(node, key)}</span>
  ));
}
