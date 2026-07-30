# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS 标志" width="440" />
</p>

<p align="center">
  <strong>面向科研人员的多智能体学术英语审校、作者决策与投稿准备工作台</strong>
</p>

<p align="center">
  先定义论文项目、章节与审校强度，<br />
  再由四个百炼 Agent 并行审查，并由作者逐条做出最终决定。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 注册</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">产品文档</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">技术文档</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a>
</p>

<p align="center">
  <img alt="应用版本 v0.7.0" src="https://img.shields.io/badge/app-v0.7.0-2563eb" />
  <img alt="工作流版本 v0.7.0" src="https://img.shields.io/badge/workflow-v0.7.0-0f766e" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Supabase Auth" src="https://img.shields.io/badge/auth-Supabase-3ecf8e" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111827" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

## 项目简介

ScholarForge OS 将传统的“一次性整段润色”升级为一条可追踪、可决策的科研写作工作流：

```text
论文项目
→ 选择章节与审校强度
→ 四个专业 Agent 并行审查
→ 确定性聚合与科学保护
→ 作者接受 / 暂缓 / 忽略每条建议
→ 保存审校历史
→ 导出修改稿、报告和决策日志
```

项目的目标不是让句子看起来更华丽，而是让科研英文审校同时具备：

- **专业分工**：术语、语言、逻辑和方法由独立 Agent 审查；
- **章节意识**：摘要、引言、方法、结果、讨论和结论采用不同审查重点；
- **科学保护**：不虚构实验、数值、标准、文献或方法细节；
- **作者控制**：每条建议均可接受、暂缓、忽略或保留待处理；
- **证据定位**：问题保留原文、建议、理由、位置和来源 Agent；
- **结果一致**：评分与 Reviewer Decision 由代码规则生成；
- **历史追踪**：浏览器本地保存最近八次审校快照；
- **真实交付**：生成 TXT、Markdown 和 JSON 文件。

> 核心原则：**模型负责专业判断，代码负责最终规则，作者负责最终决定。**

## 为什么需要 ScholarForge OS

| 科研写作风险 | ScholarForge OS 的处理方式 |
| --- | --- |
| 缩写、单位、材料或试件命名前后不一致 | Terminology Guardian 建立术语问题与统一规则 |
| 语法正确但不符合学术表达习惯 | Academic Editor 生成保守修改稿 |
| 因果、绝对化表述或结论超过证据 | Logic Auditor 标记证据边界与逻辑跳跃 |
| 样本数、设备参数或数据处理信息缺失 | Method Auditor 提出可复现性作者待办 |
| 摘要、方法和讨论需要相同的审查标准 | 章节感知 Prompt 为不同章节提供独立审查重点 |
| AI 建议无法管理 | 作者逐条标记接受、暂缓、忽略或待处理 |
| 多轮审校结果丢失 | 浏览器保存最近八次本地审校快照 |
| 修改结果无法解释或评分相互冲突 | 聚合器统一问题结构、权重、评分和 Decision |

## v0.7 核心能力

### 1. 论文任务配置

每次审校包含：

- 项目名称
- 目标期刊
- 论文章节
- 审校强度
- 科研英文原文

支持七种章节：

`通用段落` · `摘要` · `引言` · `方法` · `结果` · `讨论` · `结论`

支持三种审校模式：

| 模式 | 适用场景 |
| --- | --- |
| **保守审校** | 最小改动，优先保持作者声音和原句结构 |
| **平衡审校** | 兼顾语言质量、逻辑风险和科学谨慎 |
| **深度审校** | 发现更多术语、逻辑、方法和报告完整性问题 |

### 2. 四个真实百炼 Agent

| Agent | 主要职责 | 关键产出 |
| --- | --- | --- |
| **Terminology Guardian** | 缩写、术语、单位、符号与命名一致性 | 术语问题与规范化规则 |
| **Academic Editor** | 语法、搭配、学术语气、清晰度与可读性 | 保守完整修改稿 |
| **Logic Auditor** | 因果关系、证据边界、逻辑跳跃与过度表述 | 逻辑风险与谨慎替代表达 |
| **Method Auditor** | 方法完整性、实验报告和可重复性 | 缺失信息与作者补充项 |

四个 Agent 各自拥有独立 System Prompt、请求、响应、耗时和失败状态，并通过 `Promise.all` 并行执行。系统不是使用一个提示词模拟四个角色。

### 3. 作者问题决策

审校完成后，每条问题支持：

- **待处理**
- **接受建议**
- **暂缓处理**
- **忽略建议**

问题中心可以按严重程度、来源 Agent、作者决策和关键词筛选。作者决策会写入 Markdown 报告和 JSON 证据文件。

### 4. 本地审校历史

系统在当前浏览器保存最近八次成功审校：

- 项目名称
- 原始文本
- 目标期刊
- 章节和审校模式
- 分数与 Reviewer Decision
- 全部 Agent 结果
- 作者问题决策

可以恢复或删除历史快照。该功能目前是浏览器本地历史，不是云端论文项目。

### 5. 科学保护机制

ScholarForge OS 把科学含义完整性放在语言流畅度之前：

- 不虚构实验、样本数量、设备参数、标准、结果或参考文献；
- 不在修改稿中新增原文不存在的数值 token；
- 缺失信息使用 `[Please provide ...]` 作者占位符；
- 不把语言润色伪装为科学结论修改；
- 不让模型直接决定最终评分和 Reviewer Decision；
- 不因英文变流畅而自动消除重大逻辑或方法问题。

这些机制用于降低明显风险，不等同于完整事实核验、统计审查或同行评议。

## 使用流程

1. 在 `/login` 登录、注册或创建访客会话；
2. 输入论文项目名称和目标期刊；
3. 选择论文章节与审校强度；
4. 粘贴 40—12,000 字符的科研英文；
5. 启动审校，四个 Agent 并行调用百炼；
6. 查看原文与修改稿对照、作者待办、问题、术语和运行轨迹；
7. 对每条问题标记接受、暂缓、忽略或待处理；
8. 保存本地审校历史；
9. 下载修改稿、完整报告、作者决策日志或 JSON 证据。

## 当前交付物

| 文件 | 内容 |
| --- | --- |
| `Revised_Manuscript.txt` | Academic Editor 生成的保守修改稿 |
| `Audit_Report.md` | 项目、章节、模式、摘要、问题、术语、轨迹和作者决策 |
| `Author_Decisions.md` | 每条问题的作者处理状态与证据 |
| `Review_Result.json` | 完整结构化结果、运行信息、保护状态和作者决策 |

所有文件通过浏览器 `Blob` 和 Object URL 即时生成。

## 阿里云百炼能力使用

- 默认模型：`qwen-plus`；
- 接口：DashScope OpenAI 兼容 API；
- 调用位置：Next.js 服务端；
- 单次全面审校：正常情况下四次独立模型请求；
- API Key：仅服务端读取，不进入浏览器。

```text
Browser
  ↓
POST /api/review
  ↓
section + review mode context
  ↓
4 independent specialist requests
  ↓
Alibaba Cloud Model Studio · qwen-plus
  ↓
Deterministic Aggregator
  ↓
Author decisions + local history + downloadable evidence
```

核心代码：

- [`components/pro-workspace.tsx`](components/pro-workspace.tsx)：任务配置、结果阅读、作者决策和本地历史；
- [`lib/bailian.ts`](lib/bailian.ts)：章节感知 Prompt、百炼调用、规范化、去重和评分；
- [`app/api/review/route.ts`](app/api/review/route.ts)：请求验证、章节与模式枚举、真实 / 演示切换；
- [`lib/types.ts`](lib/types.ts)：审校 Profile、Agent、问题和作者决策数据契约；
- [`app/api/health/route.ts`](app/api/health/route.ts)：百炼、认证和工作流健康状态。

## 技术架构

| 层级 | 职责 |
| --- | --- |
| **Identity Layer** | Supabase Auth、访客模式和本地演示会话 |
| **Client Workspace** | 项目配置、草稿、本地历史、作者决策和文件导出 |
| **Application Layer** | Next.js Route Handlers、输入验证和健康检查 |
| **Orchestration Layer** | 并行调度、规范化、去重、保护规则、评分与 Decision |
| **Agent Layer** | 四个独立阿里云百炼请求 |
| **Artifact Layer** | TXT、Markdown 与 JSON 生成 |

## 评分与 Reviewer Decision

模型负责识别问题，代码负责最终评分。

| Decision | 确定性条件 |
| --- | --- |
| `Major Revision` | 修改后分数低于 80，或至少有 2 个重大 Logic / Method 问题 |
| `Minor Revision` | 修改后分数低于 92，或仍有任意重大问题 |
| `Ready for Submission` | 修改后分数至少 92，且没有重大问题 |

评分仅用于产品内辅助判断，不代表目标期刊官方意见。

## 账户与数据边界

| 账户模式 | 当前能力 | 存储位置 |
| --- | --- | --- |
| **Supabase 云端账户** | 邮箱注册、登录、确认、重置和会话保持 | Supabase Auth |
| **本地演示账户** | 验证账户 UX，不上传密码 | 当前浏览器 |
| **访客模式** | 无需注册进入比赛 Demo | 当前浏览器 |

当前账户只负责身份和会话。论文草稿、作者决策和审校历史仍保存在浏览器 `localStorage`，尚未按用户同步到云端。

## 快速开始

### 环境要求

- Node.js 22.12+
- npm
- 阿里云百炼 API Key（可选；未配置时使用演示审校）
- Supabase 项目（可选；未配置时使用本地演示账户）

### 安装

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

Windows CMD：

```bat
copy .env.example .env.local
```

macOS、Linux 或 PowerShell：

```bash
cp .env.example .env.local
```

`.env.local`：

```env
DASHSCOPE_API_KEY=你的百炼_API_Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则百炼密钥会进入浏览器构建产物。

### 启动与验证

```bash
npm run dev
npm run typecheck
npm run build
```

- 应用：`http://localhost:3000`
- 登录页：`http://localhost:3000/login`
- 健康检查：`http://localhost:3000/api/health`

## 当前边界

- 仅支持纯文本，暂不解析 PDF 或 DOCX；
- 本地历史尚未同步至用户云端账户；
- 作者“接受建议”目前记录决策，但不会自动将局部建议应用到正文；
- 暂不支持 DOCX Track Changes；
- `/api/review` 为比赛 Demo 保持匿名调用；
- 数值保护为 token 级检测，不等同于完整事实核验；
- 真实模式会将输入文本发送到阿里云百炼模型服务。

## 路线图

### v0.8 · 云端论文项目

- Supabase `projects`、`manuscript_versions`、`review_runs` 和 `issue_decisions`；
- Row Level Security；
- 按用户隔离论文项目；
- 本地历史迁移；
- 版本对比。

### v0.9 · 文档审校

- DOCX / PDF 上传；
- 自动章节解析；
- 逐条应用修改；
- 撤销和重做；
- 论文级术语记忆。

### v1.0 · 正式投稿交付

- DOCX Track Changes；
- SSE Agent 实时进度；
- 正式 PDF 审校报告；
- 用户配额与任务队列。

### v1.1 · 投稿与返修

- Reviewer Comment Parser；
- Response to Reviewers；
- Cover Letter、Highlights 和声明材料；
- 投稿检查清单。

完整规划见 [`docs/PRD.md`](docs/PRD.md)。

## License

仓库当前未包含开源许可证。除非获得版权所有者明确许可，否则不默认授予复制、修改、分发或商业使用权。
