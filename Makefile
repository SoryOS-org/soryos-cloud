.DEFAULT_GOAL := help

.PHONY: help dev setup install build lint typecheck

help: ## Show available commands
	@echo "CodeForge"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: install ## First-time setup (install deps + create .env)
	@test -f .env || cp .env.example .env
	@echo "Setup complete."

install: ## Install dependencies (npm)
	npm install

dev: ## Run web (:3000)
	npm run dev

build: ## Build apps
	npm run build

lint: ## Lint apps
	npm run lint

typecheck: ## Typecheck apps
	npm run typecheck
