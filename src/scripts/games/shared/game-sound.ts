import { createGameAudio } from "./game-audio";

export function mountGameSound(root: HTMLElement, game: string) {
  const audio = createGameAudio(`tiendu-${game}-sound`);
  const button = root.querySelector<HTMLButtonElement>("[data-game-sound]")!;
  const render = () => {
    button.textContent = audio.isEnabled() ? "SOUND ON" : "SOUND OFF";
    button.setAttribute("aria-pressed", String(audio.isEnabled()));
  };
  button.disabled = false;
  render();
  root.addEventListener("pointerdown", () => audio.unlock(), true);
  root.addEventListener("keydown", () => audio.unlock(), true);
  button.addEventListener("keydown", event => event.stopPropagation());
  button.addEventListener("click", event => {
    event.stopPropagation();
    audio.toggle();
    render();
  });
  return audio;
}
