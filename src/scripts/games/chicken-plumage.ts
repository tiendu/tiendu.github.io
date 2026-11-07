// Two world pixels per cell. All bodies are anchored at the top of the legs.
const plumage = {
  rooster: {
    colors: ["#e8a345", "#c34d35", "#185355", "#328079", "#ff5942"],
    rows: [
      "..............r.r....",
      ".............rrrrr...",
      ".............aaaar...",
      "............aawaia...",
      ".tt.........aaaaaabb.",
      "ttttt.......aaaaar...",
      "t..ttt.....aaaaarr...",
      "..uuuutt..aaacaa.r...",
      ".uu..uut.cccacaa.....",
      ".u....ttccccccca.....",
      "...tttttccaaaccc.....",
      "....tttccccacccc.....",
      "......tcccccccc......",
      ".......tcccccc.......",
      "........ccccc........",
    ],
  },
  hen: {
    colors: ["#5a5765", "#393944", "#252634", "#e5d4b4", "#c46d62"],
    rows: [
      "..............rr.....",
      ".............aaaar...",
      "............aawica...",
      "............caaaacbb.",
      ".tt........ccauac....",
      ".ttt......ccaacca....",
      "..ttttcccccccacc.....",
      "...ttcccccuccucc.....",
      "....tccaucccccccc....",
      "....cccccauccccc.....",
      ".....tccccccuccc.....",
      "......ttccccccc......",
      "........ttcccc.......",
    ],
  },
  round: {
    colors: ["#fff1d2", "#e1ceae", "#ada093", "#ffffff", "#d47c69"],
    rows: [
      "..........uuu........",
      ".........uauuu.......",
      ".......uuuauaaur.....",
      "......uaaaaaaaiau....",
      "....uuuaaaaaaaaaabb..",
      "...uuauaaaaaaacaa....",
      "..cuuaaaaauaaaacc....",
      ".ccauaaaaauuaaacc....",
      ".cauaaacaaaauaaacc...",
      "..caaaaccaaaaaaaac...",
      "..ccaaaaaccaaaaac....",
      "...ccaaaaaaaaaac.....",
      "....cccaaaaaaccc.....",
      "......cccccccc.......",
    ],
  },
  chick: {
    colors: ["#ffda55", "#efa839", "#b97d36", "#fff397", "#ffe683"],
    rows: [
      "..........uu.........",
      "...........uu.u......",
      ".........uuuuuua.....",
      "........uaaaaaaaa....",
      "........uaaawiaa....",
      "........uaaaaaaaabb..",
      "........uaaaaccaa....",
      "......uuuaaaaaaa.....",
      ".....uaaaaaaaac......",
      ".....uaauuaaaac......",
      "......caaacccc.......",
      ".......cccccc........",
    ],
  },
  bantam: {
    colors: ["#aaa4ee", "#6465aa", "#34335f", "#d8b7f3", "#e08d83"],
    rows: [
      "....tu........rr.....",
      "...tuut......raar....",
      "..ttuutt.....awia...",
      "..tuttu.....aaaaabb..",
      ".ttutt......auaa.....",
      ".ttutt.....auuac.....",
      "..ttutc...auuacc.....",
      "...ttutccccaccc......",
      "....tttccaacccc......",
      ".....tccaauaccc......",
      "......ccauaccc.......",
      ".......ccaccc........",
    ],
  },
} as const;

export function drawPlumage(ctx: CanvasRenderingContext2D, shape: string, bob: number, shocked: boolean) {
  const key = shape as keyof typeof plumage;
  const { colors, rows } = plumage[key] ?? plumage.round;
  const [a, c, t, u, r] = colors;
  const ink: Record<string, string> = { a, c, t, u, r, i: "#211d26", w: "#fffae5", b: "#f4ac44" };
  const top = 36 - rows.length * 2 + bob;
  for (const [row, pixels] of rows.entries()) {
    for (let x = 0; x < pixels.length;) {
      const pixel = pixels[x];
      let end = x + 1;
      while (pixels[end] === pixel) end++;
      if (pixel !== ".") {
        ctx.fillStyle = ink[pixel];
        ctx.fillRect(x * 2, top + row * 2, (end - x) * 2, pixel === "i" && shocked ? 4 : 2);
      }
      x = end;
    }
  }
}
