const DEFAULT_PNG_SCALE = 2;

export function svgToPngDataUrl(svg: string, scale: number = DEFAULT_PNG_SCALE): Promise<string> {
  return new Promise((resolve, reject) => {
    const viewBoxMatch = svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
    const image = new Image();
    image.onload = () => {
      const width = viewBoxMatch?.[1] ? parseFloat(viewBoxMatch[1]) : image.width;
      const height = viewBoxMatch?.[2] ? parseFloat(viewBoxMatch[2]) : image.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not create a 2D canvas context"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not rasterize the SVG diagram"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
