# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS 标志" width="440" />
</p>

<p align="center">
  <strong>基于阿里云百炼的多智能体科研英语工作台</strong>
</p>

<p align="center">
  科研中译英、英文保守润色、投稿前预检与审稿意见回复，<br />
  共用一套术语锁、科学事实保护、问题证据和作者决策工作流。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 注册</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">产品文档</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">技术文档</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a>
</p>

<p align="center">
  <img alt="应用版本 v0.8.0" src="https://img.shields.io/badge/app-v0.8.0-2563eb" />
  <img alt="工作流版本 v0.8.0" src="https://img.shields.io/badge/workflow-v0.8.0-0f766e" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Model qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <img alt="Supabase Auth" src="https://img.shields.io/badge/auth-Supabase-3ecf8e" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

---

## 项目简介

ScholarForge OS｜研语工坊是一套面向硕士生、博士生、科研人员和学术编辑的科研英语工作系统。

它继承了早期秒哒项目「研语｜科研英语 Agent / PaperLens」中最实用的产品能力，并将其重构为公开、可复现、可追踪的多 Agent 工程：

- 科研中文到学术英文翻译；
- 英文论文保守润色；
- 投稿前 Reviewer-style 预检；
- 审稿意见回复草稿；
- 用户术语锁定；
- 科学事实与数值保护；
- 修改差异解释；
- 作者逐条接受、暂缓或忽略建议；
- 本地任务历史和结构化导出。

项目的核心原则是：

> **模型负责专业判断，代码负责规则、保护、评分和最终状态。**

## 为什么不是普通润色工具

普通科研英语工具通常把整个任务简化为一次“输入—改写”。用户能获得更流畅的文字，却很难回答：

- 这次任务究竟是翻译、润色、预检还是返修信？
- 某个专业术语是否被稳定使用？
- AI 是否新增了原文没有的数值或实验事实？
- 因果关系是否超过了已有证据？
- Reviewer Comment 是否被真正回答？
- 哪些建议需要作者补充实验、数据或位置？
- 用户最终接受、暂缓或忽略了哪些问题？

ScholarForge OS 将这些问题组织为一条可追踪的专业工作链。

## 四种科研英语工作流

| 工作流 | 输入 | 核心任务 | 主要输出 |
| --- | --- | --- | --- |
| **科研中译英** | 中文科研段落 | 保留数据、术语和科学语气，生成学术英文 | Academic English Translation |
| **英文保守润色** | 英文论文段落 | 改善语法、搭配、时态、语态和学术表达 | Conservative Revision |
| **投稿前预检** | 待投稿英文稿件 | 像预审编辑一样检查术语、语言、逻辑和方法 | Precheck Revision + Evidence |
| **审稿回复助手** | Reviewer Comment + 作者依据 | 生成不虚构事实的正式回应和修改说明 | Response to Reviewer Draft |

四种任务共用：

- 七种论文章节类型；
- 保守、平衡和深度三种处理模式；
- 四个独立百炼 Agent；
- 用户术语锁；
- 数值与科学含义保护；
- 作者问题决策；
- 本地历史与导出。

## 四个专业 Agent

| Agent | 职责 | 在不同任务中的作用 |
| --- | --- | --- |
| **Terminology Guardian** | 术语、缩写、单位、符号与命名 | 检查中英术语映射、团队规范与用户术语锁 |
| **Academic Editor** | 主输出生成与语言质量 | 完整翻译、完整润色稿、预检修改稿或返修信草稿 |
| **Logic Auditor** | 论证、因果和证据边界 | 防止结论扩大，检查返修信是否真正回应审稿意见 |
| **Method Auditor** | 方法完整性与作者依据 | 检查样本、设备、统计、实验依据和返修证据是否充分 |

每个 Agent 都拥有独立的 System Prompt、模型请求、响应、耗时和失败状态。系统不是通过一次提示词模拟四个角色。

## 阿里云百炼集成

ScholarForge OS 的核心 AI 能力由阿里云百炼 Model Studio 提供。

- 默认模型：`qwen-plus`；
- 接口：DashScope OpenAI 兼容 API；
- 调用位置：Next.js 服务端；
- 单次任务：正常情况下发起 4 次独立模型请求；
- 调度方式：`Promise.all` 并行执行；
- API Key：仅从服务端环境变量读取，不进入浏览器。

```text
Browser
  ↓
POST /api/review
  ↓
Task Router
  ├─ Scientific Translation
  ├─ Conservative Polishing
  ├─ Pre-submission Precheck
  └─ Response to Reviewers
  ↓
4 independent qwen-plus specialists
  ↓
Deterministic Aggregator + Guardrails
  ↓
Primary output + Evidence + Decisions + Downloads
```

核心实现：

- [`lib/bailian.ts`](lib/bailian.ts)：任务路由、四 Agent Prompt、百炼调用、聚合、评分和保护；
- [`app/api/review/route.ts`](app/api/review/route.ts)：输入校验、术语锁清洗、真实 / 演示模式切换；
- [`components/paperlens-workspace.tsx`](components/paperlens-workspace.tsx)：四任务工作台、差异、事实保护和作者决策；
- [`lib/types.ts`](lib/types.ts)：任务、术语锁、Agent、问题和结果数据契约；
- [`app/api/health/route.ts`](app/api/health/route.ts)：百炼、认证和工作流状态。

## 用户术语锁

用户可以为当前任务配置最多 12 条术语规则：

```text
来源词 / 触发词
→ 必须采用的英文表达
→ 可选说明
```

示例：

```text
应变硬化水泥基复合材料
→ strain-hardening cementitious composite (SHCC)
```

术语锁会发送给四个 Agent，并进入确定性检查：

- 当输入中出现触发词时，主输出应包含指定表达；
- 锁定术语会合并进术语库；
- 事实保护页面会显示每一条术语锁是否被执行；
- 术语规则随本地任务快照保存。

## 科学事实保护

系统优先保护科学含义，而不是追求“看起来更高级”的文字。

当前保护规则包括：

1. 不虚构实验、样本数量、设备参数、标准、结果或参考文献；
2. 不新增来源和作者依据之外的数字 token；
3. 不把相关性自动改写为因果关系；
4. 不把语言润色伪装成科学结论修改；
5. 缺失信息必须显示为 `[Please provide ...]`；
6. 用户锁定术语必须在主输出中保留；
7. 返修信只能使用作者提供的证据和拟修改内容；
8. 页码、行号和已完成实验不得由模型猜测。

这些规则用于降低明显风险，不等同于完整的文献核验、统计审查或正式同行评议。

## 输出阅读方式

主输出支持三种视图：

- **双栏**：输入与输出并排核对；
- **清洁稿**：只阅读和复制最终主输出；
- **变更高亮**：显示新增、替换和删除内容。

长文本会采用整体区块高亮，避免浏览器执行超大规模词级差异计算。

## 作者决策

每条问题支持：

```text
Pending
├─ Accepted
├─ Deferred
└─ Dismissed
```

作者决策会进入：

- 右侧处理进度；
- 问题筛选；
- 本地任务快照；
- Markdown Decision Log；
- Markdown Evidence Report；
- JSON 结构化结果。

当前“接受建议”用于记录作者选择，尚不会自动把局部建议应用到工作稿。文本定位、冲突处理、撤销和重做属于下一阶段能力。

## 账户与访问

工作台采用登录优先流程：

```text
访问网站
→ 登录 / 注册 / 访客入口
→ 会话验证
→ 进入科研写作工作台
```

支持：

| 模式 | 说明 |
| --- | --- |
| **Supabase Auth** | 配置后支持邮箱注册、登录、确认、重置密码和会话保持 |
| **本地演示账户** | 未配置 Supabase 时验证账户 UX，不上传密码 |
| **访客模式** | 评委和首次用户无需注册即可体验公开 Demo |

当前账户系统只负责身份和会话。论文项目、任务历史和术语锁仍保存在当前浏览器，尚未实现按用户隔离的云端同步。

## 当前交付物

| 文件 | 内容 |
| --- | --- |
| `*-translation.txt` / `*-revision.txt` / `*-reviewer-response.txt` | 当前任务主输出 |
| `*-evidence-report.md` | 工作流、问题、保护、Agent 轨迹与作者决策 |
| `*-author-decisions.md` | 作者逐条决策日志 |
| `*-workflow-result.json` | 完整结构化任务数据 |

文件由浏览器 `Blob` 和 Object URL 即时生成，不展示无法真正下载的虚假 DOCX / PDF 卡片。

## 技术架构

| 层级 | 职责 |
| --- | --- |
| **Identity Layer** | Supabase Auth、访客模式、本地演示会话 |
| **Workflow UI** | 四任务选择、动态输入、术语锁、输出视图和作者决策 |
| **Application Layer** | Next.js Route Handlers、校验、错误边界与健康检查 |
| **Task Router** | 翻译、润色、预检和返修信任务上下文 |
| **Agent Layer** | 四个独立 qwen-plus 请求 |
| **Safety Layer** | 数值、含义、缺失信息和术语锁保护 |
| **Artifact Layer** | TXT、Markdown 和 JSON 浏览器端导出 |

## 技术栈

| 领域 | 技术 |
| --- | --- |
| 前端 | Next.js 16、React 19、TypeScript、原生 CSS |
| 账户 | Supabase Auth（可选）、浏览器访客 / 演示会话 |
| 服务端 | Next.js Route Handlers、Node.js Runtime |
| 模型平台 | 阿里云百炼 Model Studio OpenAI 兼容接口 |
| 多 Agent 调度 | `Promise.all` |
| 本地状态 | `localStorage` |
| 文件导出 | Browser Blob、Object URL |
| 部署 | Vercel |
| CI | GitHub Actions、Node.js 22 |

## 快速开始

### 环境要求

- Node.js 22.12+；
- npm；
- 阿里云百炼 API Key（可选，未配置时使用明确标记的演示模式）；
- Supabase 项目（可选，未配置时使用访客或本地演示账户）。

### 安装

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

### 配置环境变量

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
DASHSCOPE_API_KEY=your_model_studio_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则百炼密钥会被打包到浏览器端。

### 启动与验证

```bash
npm run dev
npm run typecheck
npm run build
```

- 应用：`http://localhost:3000`；
- 登录：`http://localhost:3000/login`；
- 健康检查：`http://localhost:3000/api/health`。

## 仓库结构

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts
│   │   └── review/route.ts
│   ├── login/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── v08.css
├── components/
│   ├── paperlens-workspace.tsx
│   ├── auth-provider.tsx
│   ├── auth-gate.tsx
│   └── account-dock.tsx
├── lib/
│   ├── bailian.ts
│   ├── demo-review.ts
│   ├── types.ts
│   └── supabase/client.ts
├── public/
│   ├── scholarforge-lockup.svg
│   └── icon.svg
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── README.md
└── README.en.md
```

## 当前边界

- 仅支持文本输入，暂不解析 PDF 或 DOCX；
- 返修信按单条 Reviewer Comment 处理，暂不自动拆分完整审稿信；
- “接受建议”尚未自动应用到正文；
- 词级差异对超长文本采用整体区块模式；
- 本地任务历史不会跨设备同步；
- 账户已实现，但暂无按用户隔离的云端论文项目；
- `/api/review` 为公开比赛 Demo 保持可调用，尚未做用户配额；
- 数值保护为 token 级检查，不等同于完整事实核验；
- 真实模式会把输入和作者依据发送到阿里云百炼模型服务；
- 当前不提供 DOCX Track Changes 和正式 PDF 报告。

## 路线图

### P0 · 真实论文工作流

- DOCX / PDF 上传与章节解析；
- Supabase 云端论文项目和 Row Level Security；
- 逐条应用建议、撤销和重做；
- 版本历史；
- DOCX Track Changes；
- SSE Agent 实时进度。

### P1 · 完整投稿与返修

- Reviewer Comment 自动拆分；
- 多 Reviewer Response 工作台；
- Cover Letter；
- Highlights；
- Author Contributions；
- Data Availability Statement；
- 投稿文件检查清单。

### P2 · 科研证据中心

- 期刊指南知识库；
- DOI 与引用核验；
- 跨章节术语和数字一致性；
- 主张—数据—图表—文献映射；
- 团队自定义术语库。

## 文档

- [ScholarForge OS 产品文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe)
- [ScholarForge OS 技术文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c)
- [产品需求与路线图](docs/PRD.md)

## License

仓库当前未包含开源许可证。除非获得版权所有者明确许可，否则不默认授予复制、修改、分发或商业使用权。
