# 🧩 沟通翻译助手：系统架构与技术规格

## 1. 核心技术栈 (Tech Stack)

| 层级 | 选型 | 理由 |
| --- | --- | --- |
| **后端** | **Golang + Gin** | 高性能、轻量，适合做 API 转发和 Prompt 组装。 |
| **前端** | **Next.js + Tailwind CSS + shadcn/ui** | 利用现成的高级组件库，快速搭建极简且具专业感的双栏界面。 |
| **LLM 连接** | **sashabaranov/go-openai** | 兼容所有 OpenAI 格式的 API（DeepSeek, GPT-4, Claude 等）。 |
| **配置管理** | **Godotenv** | 通过 `.env` 动态配置 API 地址、Key 和业务 Context。 |

---

## 2. 目录结构规划 (Project Structure)

要求 AI 按照以下结构初始化项目：

```text
.
├── backend/
│   ├── main.go             # Gin 路由与启动
│   ├── internal/
│   │   ├── config/         # 环境变量与 Prompt 加载
│   │   ├── handler/        # 接口处理逻辑
│   │   └── service/        # LLM 调用逻辑 (OpenAI SDK)
│   ├── prompts/            # 核心 Prompt 模板 (JSON/Text)
│   └── .env.example        # 环境变量模板
└── frontend/
    ├── components/         # shadcn UI 组件
    ├── lib/                # API 请求封装
    └── app/                # Next.js 页面逻辑 (双栏布局)

```

---

## 3. 核心接口定义 (API Contract)

### `POST /api/v1/translate`

**请求体：**

```json
{
  "content": "我们需要一个智能推荐功能",
  "direction": "pm2rd" // 或 "rd2pm"
}

```

**响应体：**

```json
{
  "status": "success",
  "data": {
    "original": "...",
    "translated": "### 技术规格建议\n1. 算法选型: ...",
    "meta": { "model": "gpt-4o", "tokens": 450 }
  }
}

```

---

## 4. 关键实现逻辑 (Logic Workflow)

### A. 后端：Prompt 动态组装

后端不只是转发请求，必须在调用 LLM 前注入环境变量中的 `TEAM_CONTEXT`。

* **输入**：用户文本
* **处理**：从 `prompts/` 加载对应方向的模板 -> 替换 `{{CONTENT}}` -> 注入 `{{TECH_STACK}}`（来自环境变量）。

### B. 前端：对比视图设计

* **左侧输入框**：支持粘贴长文本。
* **中间转换按钮**：带 Loading 状态。
* **右侧输出框**：**必须支持 Markdown 渲染**（使用 `react-markdown`），因为 AI 输出包含大量列表和代码块。

---

## 5. 环境变量配置 (.env)

AI Coding 工具需要根据此文件生成配置类：

```bash
PORT=8080
# LLM 配置
LLM_API_KEY=your_key_here
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# 团队上下文注入 (关键！)
TEAM_TECH_STACK="Golang, Gin, PostgreSQL, Redis"
TEAM_BUSINESS_DOMAIN="企业协作/协同办公"

```