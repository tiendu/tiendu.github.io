import { createArcadeController } from "./games/arcade-controller";

export function mountHomeTerminal(): void {
  document
    .querySelectorAll<HTMLElement>(".landing-wrapper")
    .forEach((wrapper) => {
      if (wrapper.dataset.animationStarted === "true") return;
      wrapper.dataset.animationStarted = "true";
      mountTerminal(wrapper);
    });
}

function mountTerminal(wrapper: HTMLElement): void {
  const sessionCounter = wrapper.querySelector<HTMLElement>(
    "[data-session-count]",
  );
  const SESSION_STORAGE_KEY = "tiendu-home-session";
  const INTRO_STORAGE_KEY = "tiendu-home-intro-seen";
  const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  const updateSessionCounter = () => {
    const now = Date.now();
    let count = 1;

    try {
      const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const storedSession = storedValue ? JSON.parse(storedValue) : null;
      const sessionIsValid =
        storedSession &&
        Number.isInteger(storedSession.count) &&
        typeof storedSession.expiresAt === "number" &&
        storedSession.expiresAt > now;

      const nextSession = sessionIsValid
        ? {
            count: storedSession.count + 1,
            expiresAt: storedSession.expiresAt,
          }
        : {
            count: 1,
            expiresAt: now + SESSION_TTL_MS,
          };

      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(nextSession),
      );

      count = nextSession.count;
    } catch {
      // Keep SESSION 01 when browser storage is unavailable.
    }

    if (sessionCounter) {
      sessionCounter.textContent = String(count).padStart(2, "0");
    }
  };

  updateSessionCounter();

  const greetings = [
    "Hey there! Thanks for stopping by!",
    "Hallo! Danke, dass du vorbeischaust!",
    "Bonjour ! Merci de votre visite !",
    "¡Hola! ¡Gracias por visitar!",
    "Olá! Obrigado pela visita!",
    "Ciao! Grazie della visita!",
    "Merhaba! Ziyaretiniz için teşekkürler!",
    "Привет! Спасибо за визит!",
    "Selamat datang! Terima kasih telah berkunjung!",
    "สวัสดี! ขอบคุณที่แวะมาเยี่ยมชม!",
    "नमस्ते! आने के लिए धन्यवाद!",
    "مرحبًا! شكرًا لزيارتك!",
    "안녕하세요! 방문해 주셔서 감사합니다!",
    "こんにちは！ご訪問ありがとうございます！",
    "你好！感谢你的到访！",
    "Xin chào! Cảm ơn bạn đã ghé thăm!",
  ];

  const output = wrapper.querySelector<HTMLElement>(".output");
  const profileView = wrapper.querySelector<HTMLElement>("[data-profile-view]");
  const profileCopy = wrapper.querySelector<HTMLElement>("[data-profile-copy]");
  const commandCursor = wrapper.querySelector<HTMLElement>(".block-cursor");
  const footer = wrapper.querySelector<HTMLElement>("[data-terminal-footer]");
  const footerState = wrapper.querySelector<HTMLElement>("[data-footer-state]");
  const shell = wrapper.querySelector<HTMLFormElement>("[data-terminal-shell]");
  const terminalInput = wrapper.querySelector<HTMLInputElement>(
    "[data-terminal-input]",
  );
  const inputWarning = wrapper.querySelector<HTMLElement>(
    "[data-terminal-input-warning]",
  );
  const response = wrapper.querySelector<HTMLElement>(
    "[data-terminal-response]",
  );
  const terminalActions = wrapper.querySelector<HTMLElement>(
    "[data-terminal-actions]",
  );
  const skipButton = wrapper.querySelector<HTMLButtonElement>(
    "[data-terminal-skip]",
  );
  const terminalScreen = wrapper.querySelector<HTMLElement>(
    "[data-terminal-screen]",
  );

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  const COMMAND_LENGTH_LIMIT = 16;

  let introFinished = false;
  let introSkipRequested = false;
  let wakeIntroSleep: () => void = () => {};
  let introLines: HTMLElement[] = [];
  let introTextByLine: string[] = [];

  const setText = (element: Element | null, value: string): void => {
    if (element) {
      element.textContent = value;
    }
  };

  const sleep = (milliseconds: number): Promise<void> =>
    new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        wakeIntroSleep = () => {};
        resolve();
      }, milliseconds);

      wakeIntroSleep = () => {
        window.clearTimeout(timer);
        wakeIntroSleep = () => {};
        resolve();
      };
    });

  const showResponse = (message: string): void => {
    if (!response) {
      return;
    }

    response.textContent = message;
    response.hidden = false;
  };

  const clearResponse = (): void => {
    if (response) {
      response.textContent = "";
      response.hidden = true;
    }
  };

  const hideInputWarning = (): void => {
    inputWarning?.setAttribute("hidden", "");
    shell?.classList.remove("is-at-limit");
  };

  const showInputWarning = (): void => {
    inputWarning?.removeAttribute("hidden");
    shell?.classList.add("is-at-limit");
  };

  const resizeTerminalInput = (): void => {
    if (!(terminalInput instanceof HTMLInputElement)) {
      return;
    }

    const visibleCharacters = Math.min(
      terminalInput.value.length,
      COMMAND_LENGTH_LIMIT,
    );

    /*
     * Keep a little spare width for the final glyph. This prevents the
     * native input from horizontally scrolling its text and appearing
     * to jump left as the command approaches the limit.
     */
    const measuredWidth = Math.max(visibleCharacters + 1.25, 1.25);

    terminalInput.style.width = `${measuredWidth}ch`;
  };

  const revealShell = (): void => {
    if (introFinished) {
      return;
    }

    introFinished = true;
    commandCursor?.classList.add("cursor-hidden");
    terminalActions?.classList.add("is-visible");
    skipButton?.setAttribute("hidden", "");

    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // The homepage remains usable when session storage is unavailable.
    }

    if (shell) {
      shell.hidden = false;
    }

    resizeTerminalInput();
    footer?.classList.add("terminal-footer-visible");
    setText(footerState, "READY · TYPE HELP");

    if (finePointer.matches && terminalInput instanceof HTMLElement) {
      window.setTimeout(() => terminalInput.focus(), 0);
    }
  };

  let greetingIndex = Math.floor(Math.random() * greetings.length);

  const getNextGreeting = (): string => {
    const message = greetings[greetingIndex];
    greetingIndex = (greetingIndex + 1) % greetings.length;
    return message ?? greetings[0]!;
  };

  const typeLine = async (
    element: HTMLElement,
    text: string,
  ): Promise<void> => {
    const speed = Number(element.dataset.speed ?? 24);

    element.style.visibility = "visible";
    element.classList.add("is-typing");

    for (const character of text) {
      if (introSkipRequested) {
        element.classList.remove("is-typing");
        return;
      }

      element.textContent += character;

      if (character === "." || character === "?" || character === "!") {
        await sleep(speed * 5);
      } else if (character === "," || character === ":" || character === ";") {
        await sleep(speed * 2.5);
      } else {
        await sleep(speed);
      }
    }

    element.classList.remove("is-typing");
  };

  const restoreIntroText = (): void => {
    introLines.forEach((line, index) => {
      line.textContent = introTextByLine[index] ?? "";
      line.style.visibility = "visible";
      line.classList.remove("is-typing");
    });
  };

  const requestIntroSkip = (): void => {
    if (introFinished) {
      return;
    }

    introSkipRequested = true;
    wakeIntroSleep();
    restoreIntroText();
    output?.setAttribute("aria-busy", "false");
    wrapper.classList.remove("terminal-typing-enabled");
    revealShell();
  };

  const startTerminalOutput = async (): Promise<void> => {
    if (!output) {
      wrapper.classList.remove("terminal-typing-enabled");
      revealShell();
      return;
    }

    introLines = Array.from(
      output.querySelectorAll<HTMLElement>("[data-terminal-line]"),
    );
    introTextByLine = introLines.map((line) =>
      (line.textContent ?? "").replace(/\s+/g, " ").trim(),
    );

    let introSeen = false;
    try {
      introSeen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true";
    } catch {
      // Play the intro when session storage is unavailable.
    }

    if (reducedMotion.matches || introSeen) {
      restoreIntroText();
      wrapper.classList.remove("terminal-typing-enabled");
      output.setAttribute("aria-busy", "false");
      revealShell();
      return;
    }

    output.setAttribute("aria-busy", "true");

    introLines.forEach((line) => {
      line.textContent = "";
      line.style.visibility = "hidden";
    });

    await sleep(1200);
    if (introSkipRequested) return;
    commandCursor?.classList.add("cursor-dimmed");

    for (let index = 0; index < introLines.length; index += 1) {
      const line = introLines[index];
      const text = introTextByLine[index];
      if (!line || text === undefined) continue;
      await typeLine(line, text);
      if (introSkipRequested) return;
      await sleep(index === 0 ? 320 : 480);
      if (introSkipRequested) return;
    }

    output.setAttribute("aria-busy", "false");
    wrapper.classList.remove("terminal-typing-enabled");
    revealShell();
  };

  const arcade = createArcadeController({
    wrapper,
    profileView,
    profileCopy,
    shell,
    terminalInput,
    footerState,
    finePointer,
    clearResponse,
    showResponse,
    resizeTerminalInput,
  });

  const runCommand = (rawCommand: string): void => {
    const command = rawCommand.trim().toLowerCase();

    if (!command) {
      return;
    }

    if (command === "help") {
      showResponse(
        "COMMANDS: PROFILE · HELLO · POSTS · PROJECTS · TOPICS · ABOUT · SNAKE · INVADERS · BREAKOUT · CHICKEN · CLEAR",
      );
      return;
    }

    if (command === "hello" || command === "hi") {
      showResponse(getNextGreeting());
      return;
    }

    if (command === "profile" || command === "home") {
      if (profileCopy) {
        profileCopy.hidden = false;
      }
      showResponse("PROFILE DISPLAYED.");
      return;
    }

    if (command === "clear") {
      if (profileCopy) {
        profileCopy.hidden = true;
      }
      clearResponse();
      return;
    }

    if (arcade.openCommand(command)) {
      return;
    }

    const routes: Record<string, string> = {
      posts: "/posts/",
      projects: "/projects/",
      topics: "/topics/",
      about: "/about/",
    };

    if (routes[command]) {
      window.location.assign(routes[command]);
      return;
    }

    showResponse(`COMMAND NOT FOUND: ${command.toUpperCase()} · TYPE HELP`);
  };

  terminalInput?.addEventListener("beforeinput", (event) => {
    if (
      !(terminalInput instanceof HTMLInputElement) ||
      !(event instanceof InputEvent) ||
      !event.inputType.startsWith("insert")
    ) {
      return;
    }

    const selectionStart =
      terminalInput.selectionStart ?? terminalInput.value.length;
    const selectionEnd =
      terminalInput.selectionEnd ?? terminalInput.value.length;
    const selectedCharacters = selectionEnd - selectionStart;
    const insertedCharacters = event.data?.length ?? 1;
    const resultingLength =
      terminalInput.value.length - selectedCharacters + insertedCharacters;

    if (resultingLength > COMMAND_LENGTH_LIMIT) {
      event.preventDefault();
      showInputWarning();
    }
  });

  terminalInput?.addEventListener("paste", (event) => {
    if (!(terminalInput instanceof HTMLInputElement)) {
      return;
    }

    const pastedText = event.clipboardData?.getData("text") ?? "";
    const selectionStart =
      terminalInput.selectionStart ?? terminalInput.value.length;
    const selectionEnd =
      terminalInput.selectionEnd ?? terminalInput.value.length;
    const selectedCharacters = selectionEnd - selectionStart;
    const resultingLength =
      terminalInput.value.length - selectedCharacters + pastedText.length;

    if (resultingLength > COMMAND_LENGTH_LIMIT) {
      event.preventDefault();
      showInputWarning();
    }
  });

  terminalInput?.addEventListener("keydown", (event) => {
    if (!(terminalInput instanceof HTMLInputElement)) {
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      hideInputWarning();
      return;
    }

    const hasSelection =
      terminalInput.selectionStart !== terminalInput.selectionEnd;
    const isPrintableCharacter =
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey;

    if (
      isPrintableCharacter &&
      !hasSelection &&
      terminalInput.value.length >= COMMAND_LENGTH_LIMIT
    ) {
      event.preventDefault();
      showInputWarning();
    }
  });

  terminalInput?.addEventListener("input", () => {
    if (!(terminalInput instanceof HTMLInputElement)) {
      return;
    }

    if (terminalInput.value.length < COMMAND_LENGTH_LIMIT) {
      hideInputWarning();
    }

    resizeTerminalInput();
  });

  shell?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!(terminalInput instanceof HTMLInputElement)) {
      return;
    }

    const command = terminalInput.value;
    terminalInput.value = "";
    hideInputWarning();
    resizeTerminalInput();
    runCommand(command);
  });

  terminalScreen?.addEventListener("click", (event) => {
    if (
      arcade.isActive() ||
      !shell ||
      shell.hidden ||
      !(terminalInput instanceof HTMLInputElement)
    ) {
      return;
    }

    if (event.target instanceof HTMLButtonElement) {
      return;
    }

    terminalInput.focus();
  });

  skipButton?.addEventListener("click", requestIntroSkip);

  terminalScreen?.addEventListener(
    "pointerdown",
    () => {
      if (!introFinished) requestIntroSkip();
    },
    { passive: true },
  );

  window.addEventListener("keydown", (event) => {
    if (
      !introFinished &&
      (event.key === "Enter" || event.key === " " || event.key === "Escape")
    ) {
      event.preventDefault();
      requestIntroSkip();
    }
  });

  startTerminalOutput().catch(() => {
    wrapper.classList.remove("terminal-typing-enabled");

    if (output) {
      output.setAttribute("aria-busy", "false");
    }

    revealShell();
  });
}
