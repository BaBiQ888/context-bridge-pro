# ContextBridge Pro

> **PM ↔ 工程师 双向沟通翻译助手** — 用 AI 消除跨职能沟通障碍

将产品经理的需求描述自动转化为技术规格，或将工程师的技术方案反向还原为产品语言。基于 **Server-Sent Events** 实现逐字流式输出，体验类 ChatGPT。

![Architecture](./design.md)

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **PM → RD** | 产品需求 → 技术规格（数据模型、接口设计、工时评估） |
| **RD → PM** | 技术描述 → 产品文档（功能说明、使用场景、影响评估） |
| **流式输出** | SSE 逐字输出，无需等待全量结果 |
| **团队上下文注入** | 自动将团队技术栈、业务域注入 Prompt，输出更贴合实际 |
| **Markdown 渲染** | 右侧输出支持表格、代码块、列表完整渲染 |
| **错误提示** | API Key 失效、Token 超限、频率限制等均有友好 Toast 提示 |

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Go 1.22 · Gin · `sashabaranov/go-openai` · Godotenv |
| 前端 | Next.js 15 · TypeScript · Tailwind CSS · `react-markdown` · `react-hot-toast` |
| 部署 | Docker（多阶段构建） |
| LLM | 兼容所有 OpenAI 格式 API（DeepSeek / GPT-4o / Claude 等） |

---

## 📁 项目结构

```
context-bridge-pro/
├── backend/
│   ├── main.go                    # Gin 路由与启动
│   ├── internal/
│   │   ├── config/config.go       # 环境变量加载
│   │   ├── handler/translate.go   # HTTP 处理（同步 + SSE）
│   │   └── service/llm.go         # LLM 调用 + 错误分类
│   ├── prompts/
│   │   ├── pm2rd.txt              # PM→RD Prompt 模板
│   │   └── rd2pm.txt              # RD→PM Prompt 模板
│   ├── .env.example
│   └── go.mod
├── frontend/
│   ├── app/
│   │   ├── page.tsx               # 主界面（双栏布局）
│   │   ├── layout.tsx             # 根布局 + Toast Provider
│   │   └── globals.css            # 暗色主题 + Markdown 样式
│   └── lib/
│       └── api.ts                 # translateSync / translateStream
├── Dockerfile                     # 多阶段构建
├── docker-entrypoint.sh
├── Makefile
└── .gitignore
```

---

## 🚀 快速开始

### 1. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

```bash
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.deepseek.com/v1   # 或 OpenAI / 其他兼容地址
LLM_MODEL=deepseek-chat

TEAM_TECH_STACK="Golang, Gin, PostgreSQL, Redis"
TEAM_BUSINESS_DOMAIN="企业协作/协同办公"
```

### 2. 安装依赖

```bash
make install
```

### 3. 启动开发服务

```bash
make dev
```

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:8080 |
| 前端界面 | http://localhost:3000 |

---

## 🐳 Docker 部署

```bash
# 构建镜像
make docker-build

# 运行
make docker-run
```

---

## 🔌 API 参考

### `POST /api/v1/translate`

```json
// 请求体
{
  "content": "我们需要一个智能推荐功能",
  "direction": "pm2rd",   // 或 "rd2pm"
  "stream": true          // false = 同步响应，true = SSE 流式
}
```

**同步响应：**
```json
{
  "status": "success",
  "data": {
    "original": "...",
    "translated": "### 技术规格\\n...",
    "meta": { "model": "deepseek-chat", "tokens": 450, "direction": "pm2rd" }
  }
}
```

**SSE 流式（`stream: true`）：**
```
event: chunk
data: ### 技术规格

event: chunk
data: \n1. 算法选型...

event: done
data: {"direction":"pm2rd"}
```

**错误结构：**
```json
{
  "status": "error",
  "error": { "code": "token_limit_exceeded", "message": "Your input is too long..." }
}
```

| 错误码 | HTTP 状态 | 含义 |
|--------|-----------|------|
| `token_limit_exceeded` | 413 | 输入过长 |
| `invalid_api_key` | 401 | Key 无效或过期 |
| `rate_limit_exceeded` | 429 | 请求频率过高 |
| `quota_exceeded` | 500 | 额度耗尽 |

---

## ⚙️ Makefile 命令

```bash
make dev           # 同时启动前端 + 后端
make backend       # 仅启动 Go 后端
make frontend      # 仅启动 Next.js
make install       # 安装所有依赖
make build         # 编译生产构建
make docker-build  # 构建 Docker 镜像
make docker-run    # 运行 Docker 容器
```

---

## 📝 自定义 Prompt

编辑 `backend/prompts/pm2rd.txt` 或 `backend/prompts/rd2pm.txt`，支持三个占位符：

| 占位符 | 来源 | 说明 |
|--------|------|------|
| `{{TECH_STACK}}` | `TEAM_TECH_STACK` 环境变量 | 团队技术栈 |
| `{{BUSINESS_DOMAIN}}` | `TEAM_BUSINESS_DOMAIN` 环境变量 | 业务领域 |
| `{{CONTENT}}` | 用户输入 | 原始文本 |
