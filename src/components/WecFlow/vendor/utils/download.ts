export function triggerDownload(content: Blob | string, filename: string): void {
  const blob = typeof content === "string" ? new Blob([content], { type: "text/plain" }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
