import { createGameAudio } from "./game-audio";

const channels = new Map<string, ReturnType<typeof createGameAudio>>();

export function mountGameSound(root: HTMLElement, game: string) {
  const audio = channels.get(game) ?? createGameAudio(`tiendu-${game}-sound`);
  channels.set(game, audio);
  const button = root.querySelector<HTMLButtonElement>("[data-game-sound]")!;
  const render = () => {
    button.textContent = audio.isEnabled() ? "SOUND ON" : "SOUND OFF";
    button.setAttribute("aria-pressed", String(audio.isEnabled()));
  };
  window.addEventListener(`arcade-sound-${game}`, render);
  button.disabled = false;
  render();
  root.addEventListener("pointerdown", () => audio.unlock(), true);
  root.addEventListener("keydown", () => audio.unlock(), true);
  button.addEventListener("keydown", event => event.stopPropagation());
  button.addEventListener("click", event => {
    event.stopPropagation();
    audio.toggle();
    window.dispatchEvent(new Event(`arcade-sound-${game}`));
  });
  return audio;
}
