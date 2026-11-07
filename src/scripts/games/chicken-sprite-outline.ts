// Composite the complete pose so overlapping limbs share a single silhouette.
// Both layers are reused by successive birds and predators in a frame.
function layer() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  return canvas.getContext("2d")!;
}

let layers: [CanvasRenderingContext2D, CanvasRenderingContext2D] | undefined;
export function outlinedSprite(dest: CanvasRenderingContext2D, x: number, y: number,
  draw: (sprite: CanvasRenderingContext2D) => void) {
  const [sprite, outline] = layers ??= [layer(), layer()];
  sprite.clearRect(0, 0, 96, 96);
  sprite.save();
  sprite.translate(48, 48);
  draw(sprite);
  sprite.restore();

  outline.clearRect(0, 0, 96, 96);
  outline.drawImage(sprite.canvas, -1, 0);
  outline.drawImage(sprite.canvas, 1, 0);
  outline.drawImage(sprite.canvas, 0, -1);
  outline.drawImage(sprite.canvas, 0, 1);
  outline.globalCompositeOperation = "source-in";
  outline.fillStyle = "#29252b";
  outline.fillRect(0, 0, 96, 96);
  outline.globalCompositeOperation = "source-over";
  outline.drawImage(sprite.canvas, 0, 0);
  dest.save();
  dest.imageSmoothingEnabled = false;
  dest.drawImage(outline.canvas, x - 48, y - 48);
  dest.restore();
}
