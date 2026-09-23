import type { FlowPage } from "../types/flow.types";
import { exportPageToSVG } from "./svgExport";

function parseDimensions(svg: string): { width: number; height: number } {
  const widthMatch = /width="([\d.]+)"/.exec(svg);
  const heightMatch = /height="([\d.]+)"/.exec(svg);
  return {
    width: widthMatch ? Number(widthMatch[1]) : 800,
    height: heightMatch ? Number(heightMatch[1]) : 600,
  };
}

export function exportPageToPNG(page: FlowPage): Promise<Blob> {
  const svg = exportPageToSVG(page);
  const { width, height } = parseDimensions(svg);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("2D canvas context unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("PNG encoding failed"));
          return;
        }
        resolve(blob);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("SVG rasterization failed"));
    };
    image.src = svgUrl;
  });
}
