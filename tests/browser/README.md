# UNFOLD browser UI checks

These tests use **real headless Chromium** against the built Astro website. They do
not rely on the online room server. The lobby test intercepts room requests in
the browser. Existing engine and Node tests are unchanged.

One-time setup on macOS/Linux (from the repository root):

```sh
python3 -m pip install -r tests/browser/requirements.txt
python3 -m playwright install chromium
```

Use a Python virtual environment if your Python installation is externally managed:

```sh
python3 -m venv .venv-unfold-ui
. .venv-unfold-ui/bin/activate
python -m pip install -r tests/browser/requirements.txt
python -m playwright install chromium
make check-ui PYTHON=python
```

Run:

```sh
make check-ui
```

The command builds the site, starts an ephemeral local static server, opens
Chromium, and verifies the **real DOM geometry, navigation, focus, actions and
room lobby** at 375, 430, 768, 1280 and 1920 pixel viewport widths. It writes
screenshots to `tests/browser/artifacts/` (gitignored) for visual inspection.
The GitHub Actions `UNFOLD browser UI` workflow also uploads these screenshots.

**Scope:** screenshots are review artifacts, not pixel-perfect goldens. The tests
assert structural/functional invariants to avoid brittle platform font rendering.
They do not replace human visual review or full multiplayer end-to-end tests.

The browser test is deliberately separate from `make check` so routine unit and
static checks remain fast and require no Chromium installation.
