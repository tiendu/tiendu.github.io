import { createNumberRound, guessNumber, restoreNumberSession } from "./number-rules";
import { mountNumberOnline } from "./number-online";
import { mountAllGames } from "./shared/mount";

export function mountNumberGames(): void {
  mountAllGames("[data-number-game]", "numberInitialized", (root) => {
    const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const range = get("[data-number-range]");
    const count = get("[data-number-count]");
    const status = get("[data-number-status]");
    const entry = get("[data-number-entry]");
    const controls = get("[data-number-controls]");
    const result = get("[data-number-result]");
    const hit = get("[data-number-hit]");
    const outcome = get("[data-number-outcome]");
    const summary = get("[data-number-summary]");
    const again = get<HTMLButtonElement>("[data-number-again]");
    const canvas = get<HTMLCanvasElement>("[data-number-explosion]");
    const bar = get("[data-number-bar]");
    const cells = [...root.querySelectorAll<HTMLElement>("[data-number-cell]")];
    const keys = [...root.querySelectorAll<HTMLButtonElement>("[data-number-key]")];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resetButton = get<HTMLButtonElement>("[data-number-new]");
    const soundButton = get<HTMLButtonElement>("[data-number-sound]");
    const dialog = get<HTMLDialogElement>("[data-number-dialog]");
    // Keep quick taps visible after release, including physical keyboard input.
    const pressTimers = new WeakMap<HTMLButtonElement, number>();
    const flashButton = (button?: HTMLButtonElement) => {
      if (!button || button.disabled) return;
      clearTimeout(pressTimers.get(button));
      button.classList.add("number-pressed");
      pressTimers.set(button, window.setTimeout(() => {
        button.classList.remove("number-pressed");
        pressTimers.delete(button);
      }, 160));
    };
    root.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (button && !button.hasAttribute("data-number-key")) flashButton(button);
    }, true);
    const storageKey = "tiendu-number-session";
    let restored: ReturnType<typeof restoreNumberSession> = null;
    try { restored = restoreNumberSession(JSON.parse(localStorage.getItem(storageKey) || "null")); } catch { /* Storage is optional. */ }
    let round = restored?.round ?? createNumberRound();
    let input = restored?.input ?? "";
    let timer = 0;
    let sound = false;
    let audio: AudioContext | undefined;
    let online: ReturnType<typeof mountNumberOnline> | undefined;
    let localRound = round;
    let localInput = input;
    let onlineRound = 0;
    const save = () => {
      if (online?.isActive()) return;
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 2, round, input })); } catch { /* Private mode / full storage: keep playing. */ }
    };
    const boom = () => {
      if (!sound || !audio || audio.state !== "running") return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(110, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(25, audio.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.35);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.36);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    };
    let busy = false;
    let frame = 0;

    const render = () => {
      root.setAttribute("aria-busy", String(busy));
      range.textContent = `${round.low} — ${round.high}`;
      const remaining = round.high - round.low - 1;
      count.textContent = round.over ? "ROUND OVER" : `${remaining} ${remaining === 1 ? "NUMBER" : "NUMBERS"} LEFT`;
      resetButton.hidden = !!online?.isActive();
      resetButton.disabled = busy;
      const state = online?.state();
      again.disabled = !!online?.isActive() && !online.canStart();
      again.textContent = online?.isActive() ? (state?.host === state?.player ? "NEXT ROUND ↵" : "WAITING FOR HOST") : "PLAY AGAIN ↵";
      entry.textContent = input || "_";
      keys.forEach((key) => {
        key.disabled = round.over || busy || (online?.isActive() && !online.canPlay()) ||
          (key.dataset.numberKey === "enter" && !input) ||
          (key.dataset.numberKey === "delete" && !input);
      });
      cells.forEach((cell, n) => cell.classList.toggle("number-cell-out", n <= round.low || n >= round.high));
    };

    const reveal = (focus = true) => {
      busy = false;
      canvas.hidden = true;
      controls.hidden = true;
      result.hidden = false;
      hit.textContent = String(round.target);
      const match = online?.isActive() ? online.state() : undefined;
      outcome.textContent = match && match.loser !== match.player ? `${match.loserName} HIT IT` : "YOU HIT IT";
      summary.textContent = `${round.guesses} ${round.guesses === 1 ? "GUESS" : "GUESSES"} · ROUND OVER`;
      status.textContent = `${round.target}! ${online?.isActive() ? "Round over." : "You hit the hidden number. Round over."}`;
      cells[round.target].classList.add("number-cell-hit");
      render();
      if (focus) again.focus({ preventScroll: true });
    };

    const explode = () => {
      boom();
      const context = canvas.getContext("2d");
      if (reducedMotion.matches || !context) { reveal(); return; }
      busy = true;
      render();
      canvas.hidden = false;
      // Low-resolution canvas gives real square pixels, without image assets.
      const rect = canvas.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width / 3));
      canvas.height = Math.max(1, Math.round(rect.height / 3));
      const x = (barRect.left - rect.left + barRect.width * (round.target + 0.5) / 101) / rect.width * canvas.width;
      const y = (barRect.top - rect.top + barRect.height / 2) / rect.height * canvas.height;
      const particles = Array.from({ length: 90 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 120;
        return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: 2 + Math.floor(Math.random() * 5), color: ["#fff3a3", "#ffd34e", "#ff8a32", "#f34b37"][i % 4] };
      });
      const start = performance.now();
      const draw = (now: number) => {
        const t = (now - start) / 1000;
        if (t >= 1.05 || reducedMotion.matches) { reveal(); return; }
        context.clearRect(0, 0, canvas.width, canvas.height);
        // A stepped fireball expands once, then fades into drifting square smoke.
        if (t < 0.5) {
          const radius = Math.round(8 + 64 * t);
          context.globalAlpha = 1 - t * 1.5;
          context.fillStyle = "#ff8a32";
          context.fillRect(x - radius, y - radius / 2, radius * 2, radius);
          context.fillRect(x - radius / 2, y - radius, radius, radius * 2);
          context.fillStyle = "#fff3a3";
          context.fillRect(x - radius / 2, y - radius / 2, radius, radius);
        }
        for (const p of particles) {
          context.globalAlpha = Math.max(0, 1 - t / 1.05);
          context.fillStyle = t > 0.65 ? "#77716a" : p.color;
          context.fillRect(Math.round(x + p.vx * t), Math.round(y + p.vy * t + 45 * t * t), p.size, p.size);
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    };

    const press = (key: string) => {
      if (round.over || busy || dialog.open || (online?.isActive() && !online.canPlay())) return;
      flashButton(keys.find((button) => button.dataset.numberKey === key));
      if (key === "delete") input = input.slice(0, -1);
      else if (key === "enter") {
        if (!input) return;
        const guess = Number(input);
        if (online?.isActive()) {
          if (guess <= round.low || guess >= round.high) {
            status.textContent = `Choose a number from ${round.low + 1} to ${round.high - 1}.`;
            return;
          }
          online.guess(guess);
          return;
        }
        const next = guessNumber(round, guess);
        if (next === round) {
          status.textContent = `Choose a whole number from ${round.low + 1} to ${round.high - 1}.`;
          return;
        }
        round = next;
        input = "";
        cells.forEach((cell) => cell.classList.remove("number-cell-last"));
        cells[guess].classList.add("number-cell-last");
        save();
        busy = true;
        root.setAttribute("aria-busy", "true");
        // Mark the guess first, then dim the eliminated pixels and update bounds.
        keys.forEach((button) => { button.disabled = true; });
        resetButton.disabled = true;
        status.textContent = `${guess}…`;
        timer = window.setTimeout(() => {
          render();
          if (round.over) {
            controls.hidden = true;
            explode();
          } else {
            status.textContent = `${guess} is safe. Next player: ${round.low + 1} to ${round.high - 1}.`;
            timer = window.setTimeout(() => { busy = false; render(); }, reducedMotion.matches ? 0 : 250);
          }
        }, reducedMotion.matches ? 0 : 150);
        return;
      } else if (/^\d$/.test(key)) {
        if (input === "0") input = key;
        else if (input.length < 3) input += key;
      }
      save();
      render();
    };

    keys.forEach((key) => key.addEventListener("click", () => press(key.dataset.numberKey!)));
    const newRound = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      round = createNumberRound();
      input = "";
      busy = false;
      canvas.hidden = true;
      result.hidden = true;
      controls.hidden = false;
      cells.forEach((cell) => cell.classList.remove("number-cell-hit", "number-cell-last"));
      status.textContent = "New round. Pick a number from 1 to 99.";
      save();
      render();
      keys[0].focus({ preventScroll: true });
    };
    again.addEventListener("click", () => { if (online?.isActive()) online.rematch(); else newRound(); });
    resetButton.addEventListener("click", () => {
      if (round.over) newRound();
      else { dialog.returnValue = "cancel"; dialog.showModal(); }
    });
    dialog.addEventListener("close", () => { if (dialog.returnValue === "reset") newRound(); });
    soundButton.disabled = false;
    soundButton.addEventListener("click", async () => {
      sound = !sound;
      try {
        if (sound) { audio ??= new AudioContext(); await audio.resume(); }
      } catch { sound = false; }
      soundButton.textContent = sound ? "SOUND ON" : "SOUND OFF";
      soundButton.setAttribute("aria-pressed", String(sound));
    });
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
      if (round.over || busy || dialog.open || (online?.isActive() && !online.canPlay())) return;
      const key = event.key === "Backspace" || event.key === "Delete" ? "delete" : event.key === "Enter" ? "enter" : event.key;
      // Enter confirms the typed guess even if a digit button retains focus.
      if (/^\d$/.test(key) || key === "delete" || key === "enter") {
        if (event.target instanceof HTMLAnchorElement || (event.target instanceof HTMLElement && event.target.matches(".number-option"))) return;
        event.preventDefault();
        press(key);
      }
    });
    const settle = () => {
      save();
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      busy = false;
      if (round.over) reveal(false);
      else {
        status.textContent = `Pick a number from ${round.low + 1} to ${round.high - 1}.`;
        render();
      }
    };
    window.addEventListener("pagehide", settle);
    document.addEventListener("visibilitychange", () => { if (document.hidden) settle(); });
    status.textContent = `${restored ? "Round restored. " : ""}Pick a number from ${round.low + 1} to ${round.high - 1}.`;
    render();
    if (round.over) reveal(false);
    save();
    online = mountNumberOnline(root, {
      mode(active) {
        clearTimeout(timer); cancelAnimationFrame(frame); busy = false;
        canvas.hidden = true; result.hidden = true; controls.hidden = false;
        cells.forEach(cell => cell.classList.remove("number-cell-last", "number-cell-hit"));
        if (active) { localRound = round; localInput = input; input = ""; onlineRound = 0;
          round = { target: -1, low: 0, high: 100, guesses: 0, over: false };
          status.textContent = "Waiting for the room…";
        } else { round = localRound; input = localInput; status.textContent = `Pick a number from ${round.low + 1} to ${round.high - 1}.`; }
        render();
        if (round.over) reveal(false);
      },
      connection() { render(); },
      state(state) {
        const fresh = onlineRound !== state.round;
        const wasOver = round.over;
        const changed = fresh || state.guesses !== round.guesses;
        if (fresh) {
          clearTimeout(timer); cancelAnimationFrame(frame); busy = false;
          canvas.hidden = true; result.hidden = false; controls.hidden = false;
          cells.forEach(cell => cell.classList.remove("number-cell-last", "number-cell-hit"));
        }
        onlineRound = state.round;
        round = { target: state.target ?? -1, low: state.low, high: state.high, guesses: state.guesses, over: state.over };
        if (changed) input = "";
        if (!round.over) {
          result.hidden = true; controls.hidden = false;
          status.textContent = state.lastGuess === null ? `Pick a number from ${round.low + 1} to ${round.high - 1}.` : `${state.lastGuess} is safe. Range: ${round.low + 1} to ${round.high - 1}.`;
        }
        if (changed && state.lastGuess !== null) {
          cells.forEach(cell => cell.classList.remove("number-cell-last"));
          cells[state.lastGuess].classList.add("number-cell-last");
        }
        if (changed && !fresh && !round.over && !reducedMotion.matches) {
          busy = true;
          clearTimeout(timer);
          timer = window.setTimeout(() => { busy = false; render(); }, 250);
        }
        render();
        if (round.over && (fresh || !wasOver)) { controls.hidden = true; explode(); }
      },
    });
  });
}
