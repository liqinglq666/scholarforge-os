# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS 标志" width="440" />
</p>

<p align="center">
  <strong>基于阿里云百炼的多智能体科研英语与云端论文项目工作台</strong>
</p>

<p align="center">
  科研中译英、英文保守润色、投稿前预检与审稿回复，<br />
  共用术语锁、科学事实保护、问题证据、作者决策和用户隔离的项目链路。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 注册</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="docs/product.md">产品文档</a> ·
  <a href="docs/technical.md">技术文档</a> ·
  <a href="docs/cloud-workspace.md">云端项目部署</a>
</p>

<p align="center">
  <img alt="应用版本 v1.0.0" src="https://img.shields.io/badge/app-v1.0.0-17233d" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Model qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <img alt="Four parallel agents" src="https://img.shields.io/badge/workflow-4%20parallel%20agents-0f766e" />
  <img alt="Supabase Auth and RLS" src="https://img.shields.io/badge/cloud-Supabase%20Auth%20%2B%20RLS-3ecf8e" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

---

## 项目简介

ScholarForge OS｜研语工坊面向硕士生、博士生、科研人员和学术编辑。它不是一个只负责“把英文改流畅”的输入框，而是一套可追踪、可核对、可决策、可交付的科研写作系统。

产品核心原则：

> **模型负责专业判断，代码负责规则、保护、评分和最终状态。**

当前系统覆盖：

- 科研中文到学术英文翻译；
- 英文论文保守润色；
- Reviewer-style 投稿前预检；
- 审稿意见回复草稿；
- 用户术语锁；
- 数值和科学含义保护；
- 修改差异解释；
- 作者逐条接受、暂缓或忽略建议；
- 本地项目中心、任务历史和结构化导出；
- Supabase 云端项目迁移与跨设备恢复。

## 四种科研英语工作流

| 工作流 | 输入 | 核心任务 | 主要输出 |
| --- | --- | --- | --- |
| **科研中译英** | 中文科研段落 | 保留数值、术语、证据强度和科学语气 | Academic English Translation |
| **英文保守润色** | 英文论文段落 | 改善语法、搭配和学术表达，不新增事实 | Conservative Revision |
| **投稿前预检** | 待投稿英文稿件 | 检查术语、语言、逻辑、方法与准备度 | Precheck Revision + Evidence |
| **审稿回复助手** | Reviewer Comment + 作者依据 | 生成不虚构实验和位置的正式回应 | Response to Reviewer Draft |

四种任务共用七种论文章节、三种处理强度、术语锁、问题决策、事实保护和四个独立百炼 Agent。

## 四个独立 Agent

| Agent | 职责 |
| --- | --- |
| **Terminology Guardian** | 术语、缩写、单位、符号、命名与用户术语锁 |
| **Academic Editor** | 翻译、润色、预检修改稿或返修信主输出 |
| **Logic Auditor** | 因果、证据边界、结论强度和回应完整性 |
| **Method Auditor** | 样本、设备、参数、统计、可重复性与作者依据 |

每次任务正常情况下会向阿里云百炼发起 4 次独立 `qwen-plus` 请求，并通过 `Promise.all` 并行执行。每个 Agent 都有独立提示词、结果、耗时和失败状态。

## 阿里云百炼如何参与

```text
Browser
  ↓
Next.js POST /api/review
  ↓
Task Router
  ├─ Terminology Guardian
  ├─ Academic Editor
  ├─ Logic Auditor
  └─ Method Auditor
  ↓
Alibaba Cloud Model Studio · qwen-plus
  ↓
Deterministic Aggregator
  ↓
主输出 + 问题证据 + 术语库 + 事实保护 + 作者决策 + 交付物
```

- 接口：DashScope OpenAI 兼容 API；
- 调用位置：Next.js 服务端；
- 默认模型：`qwen-plus`；
- API Key：只从服务端环境变量读取，不进入浏览器；
- 最终评分和 Reviewer Decision：由代码根据规范化问题集确定，不由模型自由生成。

核心实现：

- [`lib/bailian.ts`](lib/bailian.ts)：任务路由、四 Agent 提示词、并行请求与聚合；
- [`app/api/review/route.ts`](app/api/review/route.ts)：输入校验、实时/演示模式和错误隔离；
- [`lib/types.ts`](lib/types.ts)：工作流、问题、运行轨迹和保护规则的数据结构。

## v1.0 云端论文项目

登录账户现在可以真正产生价值。

### Supabase 邮箱账户

用户可以明确点击：

- **同步当前项目**：上传当前草稿及相关任务快照；
- **迁移全部本机项目**：按项目分组迁移浏览器历史；
- **恢复到工作台**：在另一台设备继续编辑；
- **删除云端项目**：只删除云端记录，不删除本机副本。

每个云端项目保存：

- 项目名称、工作流、章节、模式和目标期刊；
- 当前文本、作者依据和修改位置；
- 用户术语锁；
- 最近 8 次多 Agent 结果；
- 问题证据和作者决策；
- 最新准备度与待处理数量。

### 数据隔离

数据库表 `public.scholarforge_projects` 启用 Row Level Security。所有操作都要求：

```sql
auth.uid() = owner_id
```

浏览器使用 Supabase Publishable Key。**禁止**将 `service_role` Key 放入 `NEXT_PUBLIC_*` 环境变量或提交到 GitHub。

### 不自动上传旧论文

首次登录不会偷偷上传浏览器中的文本。用户必须主动点击同步或迁移按钮。访客、本地演示账户、Supabase 未配置和数据表未部署时，系统继续使用浏览器本地模式。

部署说明：[`docs/cloud-workspace.md`](docs/cloud-workspace.md)

## 科研安全规则

系统当前执行：

- 不新增来源和作者依据之外的新数值；
- 不虚构实验、样本、设备、标准和参考文献；
- 不把相关性擅自改成因果关系；
- 缺失方法信息使用 `[Please provide ...]`；
- 重大逻辑和方法风险不会因语言变流畅而自动消失；
- 用户锁定术语会进入四个 Agent 和最终保护检查。

这些规则不能替代正式同行评议、统计审查或文献事实核验。

## 技术架构

```text
Next.js 16 + React 19 + TypeScript
├─ Project Hub
│  ├─ 本地草稿与最近任务
│  ├─ 工作流模板
│  ├─ JSON 备份 / 恢复
│  └─ Supabase 云端项目 Dock
├─ PaperLens Workspace
│  ├─ 四种科研英语任务
│  ├─ 术语锁与章节感知
│  ├─ 双栏 / 清洁稿 / 变更高亮
│  ├─ 问题决策与作者待办
│  └─ TXT / Markdown / JSON 导出
├─ Review API
│  └─ Alibaba Cloud Model Studio · 4 × qwen-plus
└─ Account & Cloud
   ├─ Supabase Auth
   ├─ RLS user isolation
   └─ browser-local fallback
```

## 快速开始

### 1. 环境要求

- Node.js `>= 22.12`
- 阿里云百炼 API Key
- 可选：Supabase 项目

### 2. 安装

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
```

### 3. 百炼环境变量

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

### 4. 可选 Supabase 账户与云端项目

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

然后在 Supabase SQL Editor 中运行：

```text
supabase/migrations/20260730_cloud_workspace.sql
```

### 5. 启动与验证

```bash
npm run dev
npm run typecheck
npm run build
```

访问：

- 应用：`http://localhost:3000`
- 登录：`http://localhost:3000/login`
- 健康检查：`http://localhost:3000/api/health`

## 仓库结构

```text
app/
  api/review/route.ts
  api/health/route.ts
  login/page.tsx
components/
  workspace-hub.tsx
  paperlens-workspace.tsx
  cloud-workspace-dock.tsx
  auth-provider.tsx
lib/
  bailian.ts
  cloud-workspace.ts
  supabase/client.ts
supabase/migrations/
  20260730_cloud_workspace.sql
docs/
  PRD.md
  product.md
  technical.md
  cloud-workspace.md
```

## 当前边界

- 输入仍以粘贴文本为主，尚未实现 DOCX/PDF 解析；
- 云端项目保存最近 8 次任务，尚未支持无限版本和附件；
- 接受建议会记录决策，但不会自动修改正文；
- 暂无 Word Track Changes；
- Agent 的真实状态在一次 API 响应结束后统一返回，尚未使用 SSE；
- 访客和本地演示账户不会拥有云端项目。

## 路线图

- DOCX/PDF 上传与章节解析；
- 逐条应用修改、撤销和冲突处理；
- DOCX Track Changes 导出；
- SSE 多 Agent 实时进度；
- 无限版本历史与文件附件；
- 导师、学生和共同作者协作；
- DOI、参考文献和跨章节数值一致性核验。

## License

Copyright © ScholarForge OS contributors. See repository licensing information before reuse.
