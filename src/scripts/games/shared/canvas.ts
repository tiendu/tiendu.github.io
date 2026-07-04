export function configureFixedCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxPixelRatio = 2,
): number {
  const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ratio;
}
