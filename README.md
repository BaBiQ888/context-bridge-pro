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

---

## 🧪 测试用例

以下两个用例可直接粘贴进界面输入框验证输出质量。

---

### 用例一：RD → PM（技术优化翻译为产品语言）

**方向：** RD → PM  
**输入：**

```
我们把首页推荐接口的缓存策略从 no-cache 改成了 Cache-Control: max-age=300。
同时把 Redis 的 key 过期时间从 60s 调整到 300s，并在 CDN 层增加了边缘缓存。
改完后 P99 响应时间从 820ms 降到了 190ms，服务端 QPS 下降了约 65%（大量请求命中边缘缓存不再打到源站）。
代价是用户看到的推荐内容最多有 5 分钟的延迟更新。
```

**预期输出要点：**
- 一句话总结应包含具体数字（820ms → 190ms）及代价（5 分钟数据延迟）
- 业务层面变化表格应有 ✅ 标注（来自实测）
- 典型场景不应出现"某用户"，应结合业务领域构建具体角色
- 不应出现"大幅提升"、"显著优化"等表述

---

### 用例二：PM → RD（产品需求转化为技术规格）

**方向：** PM → RD  
**输入：**

```
我们希望在用户下单成功页增加一个"猜你喜欢"模块，展示 6 个商品推荐。
要个性化，基于用户历史购买记录。要快，不能影响下单成功页的加载速度。
需求很紧，下周上线。
```

**预期输出要点：**
- 需求还原应将"要快"量化为具体延迟指标（如独立异步加载，不阻塞主流程）
- 技术方案应说明推荐算法选型依据（协同过滤 vs 规则 vs 向量召回），而非泛泛列举
- ❓ 章节应至少提出：冷启动用户如何处理、6 个商品的排序逻辑是什么、接口超时的降级策略
- 工作量拆解应细化到子任务粒度，并标注合计人·天

---

## 🧠 提示词设计思路

两个提示词模板（`pm2rd.txt` / `rd2pm.txt`）遵循以下设计原则：

### 1. 行为定义优于角色扮演

不让模型扮演"资深产品经理"，而是直接定义输出行为：**接收什么 → 输出什么 → 转换什么**。角色扮演容易触发模型的附和倾向（把描述说得好听），行为定义更易触发准确性优先的模式。

### 2. Few-shot 示例驱动格式

在最关键的章节（一句话总结、需求还原）各嵌入一个正例 + 一个反例。模型从示例中学习格式的效率高于从规则描述中学习——规则告诉模型"不要写什么"，示例告诉模型"写成什么样"。

### 3. 约束前置 + 约束末置双层结构

关键约束（"有数字用数字，没数字标 ⚠️"）放在章节模板**之前**，利用模型对前置信息的注意力权重；完整约束列表放在**末尾**，作为兜底规则。

### 4. 数据可信度三级标注

输出中的数字分三级：✅ 实测值 / ⚠️ 估算值（需注明逻辑）/ ❌ 无依据（拒绝填写）。这一机制的目的是让读者知道哪些数据可以直接引用，哪些需要验证，而不是把估算值和实测值混在一起呈现。

### 5. 变量降级处理

`{{TECH_STACK}}` 和 `{{BUSINESS_DOMAIN}}` 为空时，提示词明确定义降级行为（自行推断 / 省略对应章节），避免模型在变量缺失时生成不可控输出。

