SHELL := /bin/bash

ROOT_DIR := $(CURDIR)
BACKEND_DIR := $(ROOT_DIR)/second-brain/backend
TMA_DIR := $(ROOT_DIR)/second-brain/telegram-miniapp
RUN_DIR := $(ROOT_DIR)/.run
LOG_DIR := $(ROOT_DIR)/logs

BACKEND_HOST ?= 0.0.0.0
BACKEND_PORT ?= 8000
TMA_HOST ?= 0.0.0.0
TMA_PORT ?= 5174

BACKEND_PID := $(RUN_DIR)/backend.pid
TMA_PID := $(RUN_DIR)/telegram-miniapp.pid
BACKEND_LOG := $(LOG_DIR)/backend.log
TMA_LOG := $(LOG_DIR)/telegram-miniapp.log
BACKEND_SCREEN := second-brain-backend
TMA_SCREEN := second-brain-tma

.PHONY: start stop restart status logs logs-backend logs-tma health open

start:
	@mkdir -p "$(RUN_DIR)" "$(LOG_DIR)"
	@if lsof -tiTCP:$(BACKEND_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Backend already running on http://localhost:$(BACKEND_PORT)"; \
	else \
		echo "Starting backend on http://localhost:$(BACKEND_PORT)"; \
		screen -dmS "$(BACKEND_SCREEN)" bash -lc 'cd "$(BACKEND_DIR)" && exec .venv/bin/uvicorn main:app --host "$(BACKEND_HOST)" --port "$(BACKEND_PORT)" >> "$(BACKEND_LOG)" 2>&1'; \
		sleep 1; \
		lsof -tiTCP:$(BACKEND_PORT) -sTCP:LISTEN > "$(BACKEND_PID)" 2>/dev/null || true; \
	fi
	@if lsof -tiTCP:$(TMA_PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Telegram Mini App already running on http://localhost:$(TMA_PORT)"; \
	else \
		echo "Starting Telegram Mini App on http://localhost:$(TMA_PORT)"; \
		screen -dmS "$(TMA_SCREEN)" bash -lc 'cd "$(TMA_DIR)" && exec npm run dev -- --host "$(TMA_HOST)" --port "$(TMA_PORT)" >> "$(TMA_LOG)" 2>&1'; \
		sleep 1; \
		lsof -tiTCP:$(TMA_PORT) -sTCP:LISTEN > "$(TMA_PID)" 2>/dev/null || true; \
	fi
	@echo "Health page: http://localhost:$(TMA_PORT)/health"

stop:
	@screen -S "$(TMA_SCREEN)" -X quit >/dev/null 2>&1 || true
	@screen -S "$(BACKEND_SCREEN)" -X quit >/dev/null 2>&1 || true
	@if [ -f "$(TMA_PID)" ]; then \
		if kill -0 "$$(cat "$(TMA_PID)")" 2>/dev/null; then echo "Stopping Telegram Mini App"; kill "$$(cat "$(TMA_PID)")"; fi; \
		rm -f "$(TMA_PID)"; \
	fi
	@if [ -f "$(BACKEND_PID)" ]; then \
		if kill -0 "$$(cat "$(BACKEND_PID)")" 2>/dev/null; then echo "Stopping backend"; kill "$$(cat "$(BACKEND_PID)")"; fi; \
		rm -f "$(BACKEND_PID)"; \
	fi
	@for port in "$(TMA_PORT)" "$(BACKEND_PORT)"; do \
		pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true)"; \
		if [ -n "$$pids" ]; then echo "Stopping listeners on port $$port"; kill $$pids 2>/dev/null || true; fi; \
	done
	@for port in "$(TMA_PORT)" "$(BACKEND_PORT)"; do \
		for i in 1 2 3 4 5; do \
			if ! lsof -tiTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then break; fi; \
			sleep 1; \
		done; \
		pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true)"; \
		if [ -n "$$pids" ]; then echo "Force stopping listeners on port $$port"; kill -9 $$pids 2>/dev/null || true; fi; \
	done

restart: stop start

status:
	@echo "Backend:"
	@backend_pid="$$(lsof -tiTCP:$(BACKEND_PORT) -sTCP:LISTEN 2>/dev/null || true)"; \
	if [ -n "$$backend_pid" ]; then \
		echo "  running: http://localhost:$(BACKEND_PORT) pid=$$backend_pid"; \
	else \
		echo "  stopped"; \
	fi
	@echo "Telegram Mini App:"
	@tma_pid="$$(lsof -tiTCP:$(TMA_PORT) -sTCP:LISTEN 2>/dev/null || true)"; \
	if [ -n "$$tma_pid" ]; then \
		echo "  running: http://localhost:$(TMA_PORT) pid=$$tma_pid"; \
	else \
		echo "  stopped"; \
	fi

logs:
	@tail -n 80 "$(BACKEND_LOG)" "$(TMA_LOG)" 2>/dev/null || true

logs-backend:
	@tail -n 120 -f "$(BACKEND_LOG)"

logs-tma:
	@tail -n 120 -f "$(TMA_LOG)"

health:
	@curl -fsS "http://localhost:$(BACKEND_PORT)/health" && echo
	@curl -fsSI "http://localhost:$(TMA_PORT)/health" | head -n 1

open:
	@open "http://localhost:$(TMA_PORT)/health"
