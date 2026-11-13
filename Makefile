SHELL := /bin/sh
.DEFAULT_GOAL := help
NPM ?= npm

.PHONY: install dev hot host room-server check build verify preview clean help

install:
	$(NPM) ci

dev hot:
	$(NPM) run dev -- --host 127.0.0.1 --port 4321

host:
	$(NPM) run dev -- --host 0.0.0.0 --port 4321

room-server:
	node server/unfold/server.mjs

check:
	$(NPM) run check
	node --test scripts/test-unfold.mjs scripts/test-guided.mjs scripts/test-rooms.mjs scripts/test-room-http.mjs scripts/test-difficulty.mjs scripts/test-render.mjs scripts/test-maintenance.mjs scripts/test-unfold-worker.mjs

build:
	$(NPM) run build

verify: check build

preview: build
	$(NPM) run preview

clean:
	rm -rf dist .astro

help:
	@printf '%s\n' \
		'install   npm ci' \
		'dev       Start Astro on http://localhost:4321' \
		'hot       Same as dev' \
		'host      Share dev server on your LAN (port 4321)' \
		'room-server Start authoritative online room server (port 8787)' \
		'check     Existing npm checks + UNFOLD tests' \
		'build     Production build' \
		'verify    Check and build' \
		'preview   Preview production build' \
		'clean     Remove dist/ and .astro/'
