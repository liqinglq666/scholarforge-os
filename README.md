# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS 标志" width="440" />
</p>

<p align="center">
  <strong>支持 DOCX/PDF 章节导入、云端论文项目与阿里云百炼多 Agent 审校的科研写作工作台</strong>
</p>

<p align="center">
  科研中译英、英文保守润色、投稿前预检与审稿回复，<br />
  共用术语锁、科学事实保护、问题证据、作者决策和用户隔离的项目链路。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 注册</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="docs/technical.md">技术文档</a> ·
  <a href="docs/cloud-workspace.md">云端项目部署</a>
</p>

<p align="center">
  <img alt="应用版本 v1.1.0" src="https://img.shields.io/badge/app-v1.1.0-17233d" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Model qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <img alt="Four parallel agents" src="https://img.shields.io/badge/workflow-4%20parallel%20agents-0f766e" />
  <img alt="DOCX and PDF ingestion" src="https://img.shields.io/badge/import-DOCX%20%2B%20PDF-b56836" />
  <img alt="Supabase Auth and RLS" src="https://img.shields.io/badge/cloud-Supabase%20Auth%20%2B%20RLS-3ecf8e" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

---

## 项目定位

ScholarForge OS｜研语工坊面向硕士生、博士生、科研人员和学术编辑。它不是一个只负责“把英文改流畅”的输入框，而是一套可导入、可追踪、可核对、可决策、可交付的科研写作系统。

> **模型负责专业判断，代码负责规则、保护、评分和最终状态。**

当前系统覆盖：

- DOCX 和文字型 PDF 本地解析；
- Abstract、Introduction、Methods、Results、Discussion、Conclusion 自动识别；
- 科研中文到学术英文翻译；
- 英文论文保守润色；
- Reviewer-style 投稿前预检；
- 审稿意见回复草稿；
- 用户术语锁；
- 数值和科学含义保护；
- 作者逐条接受、暂缓或忽略建议；
- 本地任务历史、JSON 备份与结构化导出；
- Supabase 云端项目迁移、跨设备恢复与 RLS 数据隔离。

## v1.1 文档导入

点击应用左下角的 **导入论文**，可以直接选择：

- `.docx`；
- 可复制文字的 `.pdf`；
- 单个文件最大 20 MB。

导入流程：

```text
选择 DOCX / PDF
  ↓
浏览器本地解析
  ↓
识别章节与页面范围
  ↓
预览提取结果与风险提示
  ↓
选择一个章节或片段
  ↓
导入 PaperLens 工作台
  ↓
作者核对后启动 4 个百炼 Agent
```

### 解析边界

- DOCX 使用 Mammoth 读取语义标题和正文；
- PDF 使用 Mozilla PDF.js 逐页提取可选择文本；
- 超过 12,000 字符的章节会按段落拆分成多个可审校片段；
- 原始文件不会作为附件保存到 ScholarForge 服务器；
- 只有用户选中的文本，在主动启动工作流后才进入现有审校请求；
- 扫描图片型 PDF 暂不执行 OCR；
- 公式、表格、双栏阅读顺序、页眉页脚和修订痕迹需要作者人工核对。

详细说明：[`docs/releases/v1.1-document-ingestion.md`](docs/releases/v1.1-document-ingestion.md)

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

## 技术链路

```text
DOCX / PDF
  ↓ browser-side parsing
Mammoth / PDF.js
  ↓ selected section
PaperLens Workspace
  ↓ POST /api/review
4 × qwen-plus via Alibaba Cloud Model Studio
  ↓
Deterministic Aggregator
  ↓
主输出 + 问题证据 + 术语库 + 事实保护 + 作者决策 + 交付物
```

核心实现：

- [`lib/document-ingestion.ts`](lib/document-ingestion.ts)：DOCX/PDF 抽取、章节识别和超长章节拆分；
- [`components/document-import-dock.tsx`](components/document-import-dock.tsx)：拖拽上传、预览、章节选择和导入；
- [`lib/bailian.ts`](lib/bailian.ts)：任务路由、四 Agent 提示词、并行请求与聚合；
- [`app/api/review/route.ts`](app/api/review/route.ts)：输入校验、实时/演示模式和错误隔离；
- [`lib/cloud-workspace.ts`](lib/cloud-workspace.ts)：本地项目与 Supabase 云端项目同步；
- [`supabase/migrations/20260730_cloud_workspace.sql`](supabase/migrations/20260730_cloud_workspace.sql)：云端项目表与 RLS。

## 云端项目与数据隔离

Supabase 邮箱账户可以明确点击：

- **同步当前项目**；
- **迁移全部本机项目**；
- **恢复到工作台**；
- **删除云端项目**。

数据库表 `public.scholarforge_projects` 启用 Row Level Security，所有操作要求：

```sql
auth.uid() = owner_id
```

首次登录不会自动上传浏览器中的论文文本。访客、本地演示账户、Supabase 未配置和数据表未部署时，系统继续使用浏览器本地模式。

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

## 快速开始

### 环境要求

- Node.js `>= 22.12`
- 阿里云百炼 API Key
- 可选：Supabase 项目

### 安装

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
```

### 环境变量

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

启用云端项目时，在 Supabase SQL Editor 中运行：

```text
supabase/migrations/20260730_cloud_workspace.sql
```

### 启动与验证

```bash
npm run dev
npm run typecheck
npm run build
```

## 当前边界

- PDF 仅支持可提取文字的文档，扫描版尚无 OCR；
- DOCX/PDF 导入只保留可编辑正文，不重建原始页面版式；
- 云端项目保存最近 8 次任务，尚未支持无限版本和附件；
- 接受建议会记录作者决策，但不会自动修改正文；
- 暂无 Word Track Changes；
- Agent 状态在一次 API 响应结束后统一返回，尚未使用 SSE。

## 下一阶段

- 逐条应用修改、撤销和冲突处理；
- DOCX Track Changes 导出；
- SSE 多 Agent 实时进度；
- 扫描版 PDF 的可选 OCR；
- 无限版本历史与文件附件；
- 导师、学生和共同作者协作；
- DOI、参考文献和跨章节数值一致性核验。

## License

Copyright © ScholarForge OS contributors. See repository licensing information before reuse.
