// One sprite pixel is two course units. The origin is between the planted paws.
const fur: Record<string, string> = {
  k: "#342d34", s: "#64565a", r: "#b47e55", h: "#d5a477", c: "#f1d5a2", e: "#ffc34d",
};

const profile = [
  "               k    k",
  "               rk  ks",
  "               rhkksk",
  "              krrrssk",
  "            kksrrrrrrk",
  "    kkkkkkkkssrrrrksrrk",
  "  kkrrsssssssrrrrrekrrrkk",
  " krrrrrssssrrrrrrhhhccrrrkk",
  "krrhrrrrrrrrrrrhhhccccccckk",
  "krrhhrrrrrrrhhrrcccskkkkk",
  "krrrhsrrhhccckrrcck    ck",
  " krrkkskkk    krck",
  "  kk           kk",
];
const brush = [
  "           kkk",
  "       kkkkrrk",
  "    kkksrrrhhk",
  " kkksrrrhhkk",
  "kkssshhkkk",
  " kkkkkk",
];
const front = [
  "  k     k", "  rk   kr", "  rhkkkhr", " krrssrrrk", " kserrresk",
  " krhrrrhrk", "  kcckcck", " krrckcrrk", " ksrcccrsk", "  kscccrk",
  "  krrcrrk", "  ksrrsrk", "  ksk ksk", "  krk ksk", "  ksk  kk",
  "  kkk  kkk",
];

// Knee, hock and paw locations relative to the hip in each gallop drawing.
type Limb = readonly [number, number, number, number, number, number];
const hind: Limb[] = [
  [2,3,-3,5,-8,6], [3,2,-2,4,-5,4], [4,2,1,4,0,5], [5,3,4,5,6,7],
  [4,3,2,6,3,8], [2,4,-1,6,0,8], [1,3,-3,6,-3,8], [-1,3,-5,5,-6,8],
];
const fore: Limb[] = [
  [0,3,4,5,6,8], [-1,3,2,5,3,8], [-2,4,0,6,0,8], [-3,3,-3,6,-3,8],
  [-3,3,-5,5,-6,6], [-2,3,-1,4,-3,4], [-1,2,3,3,2,4], [1,2,5,4,7,6],
];

function stamp(c: CanvasRenderingContext2D, rows: string[], x: number, y: number) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = fur[row[i]];
      if (!color) continue;
      c.fillStyle = color;
      c.fillRect(x + i, y + j, 1, 1);
    }
  });
}

// Rasterize the limb into square pixels, including the bent ankle and toes.
function leg(c: CanvasRenderingContext2D, x: number, y: number, pose: Limb, far: boolean) {
  function segment(ax: number, ay: number, bx: number, by: number, width: number, color: string) {
    const steps = Math.max(1, Math.abs(bx - ax), Math.abs(by - ay));
    c.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      c.fillRect(x + Math.round(ax + (bx - ax) * i / steps),
        y + Math.round(ay + (by - ay) * i / steps), width, 1);
    }
  }
  const [kx, ky, hx, hy, px, py] = pose;
  segment(0, 0, kx, ky, 3, far ? fur.s : fur.r);
  segment(kx, ky, hx, hy, 2, far ? fur.s : fur.h);
  segment(hx, hy, px, py, 1, fur.k);
  c.fillRect(x + px, y + py, 3, 1);
}

const frames = new Map<number, HTMLCanvasElement>();
function sprite(index: number) {
  const cached = frames.get(index);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 43;
  canvas.height = 23;
  const c = canvas.getContext("2d")!;
  if (index === 9) {
    stamp(c, front, 16, 4);
  } else {
    const jumping = index === 8;
    const i = jumping ? 0 : index;
    const ahead = (i + 1) % 8;
    const bob = i === 1 || i === 2 || jumping ? -1 : 0;
    const rearLeap: Limb = [3,2,-2,4,-7,4];
    const frontLeap: Limb = [1,2,5,3,8,4];
    leg(c, 14, 11, jumping ? rearLeap : hind[ahead], true);
    leg(c, 23, 11, jumping ? frontLeap : fore[ahead], true);
    stamp(c, brush, 0, 11 + bob + (i >= 5 ? 1 : 0));
    stamp(c, profile, 10, 2 + bob);
    leg(c, 13, 12, jumping ? rearLeap : hind[i], false);
    leg(c, 24, 12, jumping ? frontLeap : fore[i], false);
  }
  frames.set(index, canvas);
  return canvas;
}

export function paintCoyote(c: CanvasRenderingContext2D, x: number, floor: number,
  turn: number, distance: number, hop: number) {
  const retreating = turn > 0.5;
  const travel = retreating ? -distance : distance;
  const stride = ((Math.floor(travel / 6) % 8) + 8) % 8;
  const pivot = turn >= 0.34 && turn <= 0.66;
  const frame = sprite(pivot ? 9 : hop > 2 ? 8 : stride);
  c.save();
  c.translate(Math.round(x), Math.round(floor));
  c.scale(retreating ? -2 : 2, 2);
  c.imageSmoothingEnabled = false;
  c.drawImage(frame, -20, -21);
  c.restore();
}
