SHELL := /bin/sh
.DEFAULT_GOAL := help

NPM ?= npm

.PHONY: install dev hot run host check build verify preview clean distclean reinstall ci help

install:
	$(NPM) ci

dev hot run:
	$(NPM) run dev

host:
	$(NPM) run dev:host

check:
	$(NPM) run check

build:
	$(NPM) run build

verify: check build

preview: build
	$(NPM) run preview

clean:
	rm -rf dist .astro

distclean: clean
	rm -rf node_modules

reinstall: distclean install

ci: install verify

help:
	@printf '%s\n' \
		'Usage: make <target>' \
		'' \
		'Targets:' \
		'  install    Install exact dependencies with npm ci' \
		'  dev        Start Astro with hot reload' \
		'  hot        Alias for dev' \
		'  run        Alias for dev' \
		'  host       Start Astro on the local network' \
		'  check      Run Astro and TypeScript checks' \
		'  build      Build the production site' \
		'  verify     Run check and build' \
		'  preview    Build and preview production locally' \
		'  clean      Remove dist/ and .astro/' \
		'  distclean  Also remove node_modules/' \
		'  reinstall  Clean everything and reinstall' \
		'  ci         Install dependencies, check, and build'
