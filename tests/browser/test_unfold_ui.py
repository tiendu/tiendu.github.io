"""Real Chromium UI regressions for UNFOLD's production Astro build.

Run via `make check-ui` after installing the Python Playwright requirement
and its Chromium browser. These tests do not require the live room backend.
"""

from __future__ import annotations

import functools
import http.server
import json
import os
import re
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"
ARTIFACTS = Path(os.environ.get("UNFOLD_UI_ARTIFACTS", str(Path(__file__).parent / "artifacts")))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class UnfoldBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not DIST.exists():
            raise RuntimeError("Missing dist/: run `npm run build` or `make check-ui` first")
        if (DIST / "games/unfold/index.html").is_file():
            route = "/games/unfold/"
        elif (DIST / "games/unfold.html").is_file():
            route = "/games/unfold.html"
        else:
            raise RuntimeError("UNFOLD's built HTML route was not found under dist/games/")
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(DIST))
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}{route}"
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except Exception:
            cls.playwright.stop()
            cls.server.shutdown()
            cls.server.server_close()
            cls.thread.join(timeout=3)
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def setUp(self):
        self.contexts = []

    def tearDown(self):
        for context in reversed(self.contexts):
            context.close()

    def page(self, width=1280, height=800, *, mobile=False):
        context = self.browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
            is_mobile=mobile,
            has_touch=mobile,
            reduced_motion="reduce",
            color_scheme="dark",
        )
        self.contexts.append(context)
        page = context.new_page()
        page.set_default_timeout(12000)
        page_errors = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.goto(self.url, wait_until="domcontentloaded")
        page.locator("#play:not([disabled])").wait_for()
        self.assertEqual(page_errors, [], "Uncaught browser JavaScript errors on load")
        return page

    def shot(self, page, label):
        page.screenshot(path=str(ARTIFACTS / f"{label}.png"), full_page=True, animations="disabled")

    def assert_no_horizontal_overflow(self, page):
        dims = page.evaluate("""() => ({
            client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth
        })""")
        self.assertLessEqual(dims["scroll"], dims["client"] + 3, f"Horizontal overflow: {dims}")

    def start_local(self, page, *, mode="solo", level="open", players=2, seed=271828):
        page.locator("#mode").select_option(mode)
        if mode == "solo":
            page.locator("#level").select_option(level)
        else:
            page.locator("#players").select_option(str(players))
        page.locator(".advanced summary").click()
        page.locator("#seed").fill(str(seed))
        page.locator("#play").click()
        page.locator("#game").wait_for(state="visible")
        page.wait_for_function("""() => {
            const el = document.querySelector('#frame-command');
            return el && el.dataset.state !== 'rolling';
        }""", timeout=14000)

    def resume_fixture(self, page, state="reclaim"):
        # Use the shipped engine to create a valid v5 saved game. Only the UI
        # state under test is modified: no test-only hooks in production code.
        page.evaluate("""async kind => {
            const {newGame} = await import('/games/unfold/engine.mjs');
            const game = newGame({mode:'solo', level:'open', seed:71});
            game.acted = false;
            game.winner = null;
            if (kind === 'reclaim') game.die = {face:4, action:'reclaim', net:null};
            if (kind === 'deploy') game.die = {face:1, action:'deploy', net:0};
            if (kind === 'finished') {
                game.die = {face:1, action:'deploy', net:0};
                game.winner = {kind:'stuck', players:[]};
                game.announcement = 'No legal placement for the rolled construction cube.';
            }
            localStorage.setItem('unfold-v05', JSON.stringify(game));
        }""", state)
        page.reload(wait_until="domcontentloaded")
        page.locator("#resume").wait_for(state="visible")
        page.locator("#resume").click()
        page.locator("#game").wait_for(state="visible")

    def test_menu_and_keyboard_tabs(self):
        for width, height in [(375, 812), (430, 932), (768, 1024), (1280, 800), (1920, 1080)]:
            with self.subTest(viewport=width):
                page = self.page(width, height, mobile=width < 768)
                self.assertTrue(page.locator("#setup").is_visible())
                self.assertEqual(page.locator(".masthead .back:visible").count(), 1)
                self.assertFalse(page.locator("#new-game").is_visible())
                self.assertEqual(page.locator(".entry-tabs [role=tab]").count(), 3)
                self.assert_no_horizontal_overflow(page)
                if width in (375, 1280):
                    self.shot(page, f"menu-{width}")
                if width == 1280:
                    page.locator("#tab-solo").focus()
                    page.keyboard.press("ArrowRight")
                    self.assertEqual(page.locator("#tab-create").get_attribute("aria-selected"), "true")
                    self.assertTrue(page.locator("#room-create-fields").is_visible())
                    page.keyboard.press("ArrowRight")
                    self.assertEqual(page.locator("#tab-join").get_attribute("aria-selected"), "true")
                    self.assertTrue(page.locator("#room-join-fields").is_visible())
                    page.keyboard.press("Home")
                    self.assertEqual(page.locator("#tab-solo").get_attribute("aria-selected"), "true")

    def test_responsive_board_and_desktop_rail(self):
        for width, height in [(375, 812), (430, 932), (768, 1024), (1280, 800), (1920, 1080)]:
            with self.subTest(viewport=width):
                page = self.page(width, height, mobile=width < 768)
                self.start_local(page)
                self.assertEqual(page.locator("#board .tile").count(), 11 * 11)
                self.assertEqual(page.locator(".masthead .back:visible").count(), 1)
                self.assertEqual(page.locator(".frame-games").count(), 0)
                self.assertTrue(page.locator("#new-game").is_visible())
                board = page.locator("#board-frame").bounding_box()
                rail = page.locator(".command-rail .frame-command").bounding_box()
                self.assertIsNotNone(board)
                self.assertIsNotNone(rail)
                if width >= 1100:
                    gap = rail["x"] - (board["x"] + board["width"])
                    self.assertGreater(gap, 0, f"Rail overlaps board at {width}px")
                    self.assertLess(gap, 45, f"Rail separated from board by {gap}px at {width}px")
                    self.assertLessEqual(board["x"] + board["width"], width + 1)
                else:
                    self.assertGreater(board["y"], rail["y"], "Mobile controls should precede the board")
                self.assert_no_horizontal_overflow(page)
                self.shot(page, f"solo-{width}")

    def test_local_multiplayer_labels(self):
        for mode, size in (("coop", 15), ("competitive", 13)):
            with self.subTest(mode=mode):
                page = self.page(1280, 850)
                self.start_local(page, mode=mode, players=2, seed=17)
                self.assertEqual(page.locator("#board .tile").count(), size * size)
                self.assertIn("CYAN", page.locator("#turn-player").inner_text().upper())
                self.assertTrue(page.locator("#clock-box").is_visible())
                self.assert_no_horizontal_overflow(page)
                self.shot(page, f"local-{mode}")

    def test_unavailable_action_and_finished_result(self):
        for scenario in ("reclaim", "finished"):
            with self.subTest(state=scenario):
                page = self.page(390, 844, mobile=True)
                self.resume_fixture(page, scenario)
                if scenario == "reclaim":
                    self.assertEqual(page.locator("#frame-command").get_attribute("data-state"), "unavailable")
                    self.assertIn("No adjacent obstacle", page.locator("#action-tip").inner_text())
                    self.assertIn("No adjacent obstacle", page.locator("#instruction").inner_text())
                    self.assertNotIn("Select one", page.locator("#action-tip").inner_text())
                    self.assertTrue(page.locator("#frame-skip").is_enabled())
                    self.assertFalse(page.locator("#result").is_visible())
                else:
                    self.assertTrue(page.locator("#result").is_visible())
                    self.assertIn("No legal placement", page.locator("#result-title").inner_text())
                    self.assertNotIn("Skip this roll", page.locator("#instruction").inner_text())
                    page.wait_for_timeout(150)  # scrollIntoView is scheduled on the next animation frame
                    result = page.locator("#result").bounding_box()
                    self.assertIsNotNone(result)
                    viewport = page.viewport_size
                    self.assertGreaterEqual(result["y"], -2)
                    self.assertLess(result["y"], viewport["height"] + 2)
                self.shot(page, scenario)

    def test_grid_keyboard_and_responsive_placement(self):
        page = self.page(1280, 850)
        self.resume_fixture(page, "deploy")
        self.assertEqual(page.locator("#board .tile[tabindex='0']").count(), 1)
        tile = page.locator("#board .tile[tabindex='0']")
        tile.focus()
        coords = (int(tile.get_attribute("data-x")), int(tile.get_attribute("data-y")))
        page.keyboard.press("ArrowUp")
        new = page.locator("#board .tile:focus")
        self.assertEqual(new.count(), 1)
        self.assertEqual(int(new.get_attribute("data-x")), coords[0])
        self.assertEqual(int(new.get_attribute("data-y")), max(0, coords[1] - 1))
        self.assertEqual(page.locator("#board .tile[tabindex='0']").count(), 1)
        tools = page.locator("#placement-tools")
        self.assertTrue(tools.is_visible())
        self.assertEqual(tools.evaluate("el => el.parentElement.id"), "desktop-placement-slot")
        page.locator("#confirm").focus()
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_function("document.querySelector('#placement-tools').parentElement.id === 'board-viewport'")
        self.assertTrue(tools.is_visible())
        self.assertTrue(page.locator("#confirm").evaluate("el => document.activeElement === el"))
        self.assert_no_horizontal_overflow(page)
        self.shot(page, "placement-mobile")
        page.set_viewport_size({"width": 1280, "height": 850})
        page.wait_for_function("document.querySelector('#placement-tools').parentElement.id === 'desktop-placement-slot'")
        self.assertEqual(page.locator("#placement-tools").count(), 1)
        self.assertTrue(page.locator("#confirm").evaluate("el => document.activeElement === el"))

    def test_hard_board_gates_and_zoom(self):
        page = self.page(1280, 850)
        self.start_local(page, level="hard", seed=17)
        self.assertEqual(page.locator("#board .tile").count(), 19 * 19)
        self.assertGreater(page.locator("#board .tile.gate").count(), 0)
        self.assertGreater(page.locator("#board .gate-terminal").count(), 0)
        page.locator(".game-options summary").click()
        page.locator("#zoom-in").click()
        self.assertEqual(page.locator("#zoom-level").inner_text(), "125%")
        page.locator("#zoom-fit").click()
        self.assertEqual(page.locator("#zoom-level").inner_text(), "100%")
        self.shot(page, "hard-gates")

    def test_online_lobby_with_mocked_transport(self):
        page = self.page(1280, 850)

        def mock_room(route):
            if route.request.method == "OPTIONS":
                route.fulfill(status=204, headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                })
                return
            snapshot = {
                "now": 1_800_000_000_000,
                "revision": 1,
                "mode": "coop",
                "host": True,
                "seats": [{"name": "Alice", "connected": True}],
                "code": "123456",
                "game": None,
            }
            payload = {"code": "123456", "token": "mock-seat", "snapshot": snapshot} \
                if route.request.url.endswith("/create") else snapshot
            route.fulfill(status=200, content_type="application/json", body=json.dumps(payload),
                headers={"Access-Control-Allow-Origin": "*"})

        page.route(re.compile(r"^http://127\.0\.0\.1:8787/api/unfold/"), mock_room)
        page.locator("#tab-create").click()
        page.locator("#room-name").fill("Alice")
        page.locator("#create-room").click()
        page.locator("#room-lobby").wait_for(state="visible")
        self.assertEqual(page.locator("#lobby-code").inner_text(), "123456")
        self.assertIn("Alice", page.locator("#lobby-seats").inner_text())
        self.assertFalse(page.locator("#start-room").is_enabled())
        self.assertEqual(page.locator(".masthead .back:visible").count(), 1)
        self.shot(page, "room-lobby")


if __name__ == "__main__":
    unittest.main(verbosity=2)
