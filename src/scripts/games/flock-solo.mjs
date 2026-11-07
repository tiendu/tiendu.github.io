// Solo replays the same 50 ms simulation and inputs as the room server.
import { birds, course, input, newRace, step } from "../../../multiplayer/src/chicken/race.mjs";
import { readStoredSession, writeStoredSession, removeStoredSession } from "./shared/storage";

const key = "tiendu-chicken-solo-race";
export const tickMs = 50;
export function createSolo(bird, seed = crypto.getRandomValues(new Uint32Array(1))[0], version) {
  const players = [{ id: "solo", bird, name: birds[bird].name, online: true }];
  return { players, race: newRace(players, seed, version), track: course(seed, version), ticks: 0, inputs: [] };
}
export function advanceSolo(local) {
  step(local.race, local.track, tickMs / 1000);
  local.ticks++;
}
export function soloInput(local, action) {
  const bird = local.race.runners[0];
  if (action === "jump" && bird.jumps >= 2) return;
  if (action === "down" && bird.burstLeft) return;
  local.inputs.push([local.ticks, action]);
  input(bird, action);
}
export function saveSolo(local) {
  if (local.race.over) return removeStoredSession(key);
  const { ticks, inputs } = local;
  writeStoredSession(key, 1, { bird: local.players[0].bird, seed: local.race.seed, version: local.race.courseVersion, ticks, inputs });
}
export function readSolo() {
  return readStoredSession(key, 1, s => s && Number.isInteger(s.bird) && birds[s.bird] &&
    Number.isInteger(s.seed) && Number.isInteger(s.ticks) && s.ticks >= 0 && s.ticks < 3000 &&
    Array.isArray(s.inputs) && s.inputs.length <= 9000 && s.inputs.every((entry, i) =>
      Array.isArray(entry) && Number.isInteger(entry[0]) && entry[0] >= (i ? s.inputs[i-1][0] : 0) &&
      entry[0] <= s.ticks && ["jump", "down"].includes(entry[1])))?.state;
}
export function restoreSolo(saved) {
  const local = createSolo(saved.bird, saved.seed, saved.version ?? 1);
  let i = 0;
  while (true) {
    while (saved.inputs[i]?.[0] === local.ticks) soloInput(local, saved.inputs[i++][1]);
    if (local.ticks === saved.ticks || local.race.over) return local;
    advanceSolo(local);
  }
}
