# OpenCode Build Agent - Makefile

install:
	bun install

dev:
	cd apps/web && bun run dev

build:
	bun run build

lint:
	cd apps/web && bun run lint

clean:
	rm -rf node_modules
	rm -rf apps/web/.next
	rm -rf apps/web/node_modules