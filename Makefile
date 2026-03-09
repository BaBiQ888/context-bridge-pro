.PHONY: all backend frontend dev stop help

BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend
BACKEND_PID  := .backend.pid
FRONTEND_PID := .frontend.pid

## ── 默认目标 ──────────────────────────────────────────────
all: help

## ── 开发：同时启动前端 + 后端 ─────────────────────────────
dev:
	@echo "🚀  启动 ContextBridge Pro (后端 :8080 + 前端 :3000)"
	@$(MAKE) backend &
	@$(MAKE) frontend

## ── 仅启动后端 ────────────────────────────────────────────
backend:
	@echo "🔧  启动 Go 后端 (http://localhost:8080)..."
	@[ -f $(BACKEND_DIR)/.env ] || cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env
	@cd $(BACKEND_DIR) && go run main.go

## ── 仅启动前端 ────────────────────────────────────────────
frontend:
	@echo "🖥️   启动 Next.js 前端 (http://localhost:3000)..."
	@cd $(FRONTEND_DIR) && npm run dev

## ── 安装依赖 ──────────────────────────────────────────────
install:
	@echo "📦  安装 Go 依赖..."
	@cd $(BACKEND_DIR) && go mod tidy
	@echo "📦  安装 npm 依赖..."
	@cd $(FRONTEND_DIR) && npm install

## ── 构建 ──────────────────────────────────────────────────
build:
	@echo "🏗️   构建 Go 二进制..."
	@cd $(BACKEND_DIR) && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../dist/context-bridge-pro ./main.go
	@echo "🏗️   构建 Next.js..."
	@cd $(FRONTEND_DIR) && npm run build

## ── Docker ────────────────────────────────────────────────
docker-build:
	@echo "🐳  构建 Docker 镜像..."
	docker build -t context-bridge-pro:latest .

docker-run:
	@echo "🐳  运行 Docker 容器..."
	docker run --env-file backend/.env -p 8080:8080 -p 3000:3000 context-bridge-pro:latest

## ── 帮助 ──────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ContextBridge Pro — 快捷命令"
	@echo ""
	@echo "  make dev           同时启动后端和前端 (推荐)"
	@echo "  make backend       仅启动 Go 后端  (:8080)"
	@echo "  make frontend      仅启动 Next.js  (:3000)"
	@echo "  make install       安装所有依赖"
	@echo "  make build         编译生产构建"
	@echo "  make docker-build  构建 Docker 镜像"
	@echo "  make docker-run    运行 Docker 容器"
	@echo ""
