import { access, readFile } from "node:fs/promises";
const expected = {
  blackjack: "../../games/blackjack/Game.astro",
  mines: "../../games/mines/Game.astro",
  number: "../../games/number/Game.astro",
  six: "../../games/six/Game.astro",
};
for (const [name, importPath] of Object.entries(expected)) {
  const route = `../src/pages/games/${name}.astro`;
  const source = await readFile(new URL(route, import.meta.url), "utf8");
  if (!source.includes(importPath)) throw new Error(`Missing ${name} game module in ${route}`);
}
for (const name of Object.keys(expected)) {
  await access(new URL(`../src/games/${name}/Game.astro`, import.meta.url));
}
console.log("Game architecture OK: Blackjack, Mines, Number, SIX.");
