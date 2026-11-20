export function mountAllGames(
  selector: string,
  initializedKey: string,
  mount: (root: HTMLElement) => void,
): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((root) => {
    if (root.dataset[initializedKey] === "true") {
      return;
    }

    root.dataset[initializedKey] = "true";
    mount(root);
  });
}
