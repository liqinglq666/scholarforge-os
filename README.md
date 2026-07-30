# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-mark.svg" alt="ScholarForge OS 标志" width="148" />
</p>

<p align="center">
  <strong>面向科研人员的多智能体学术英语审校与投稿准备工作台</strong>
</p>

<p align="center">
  四个专业 Agent 并行审查术语、语言、逻辑与方法，<br />
  再由确定性代码完成聚合、科学保护、评分与交付。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 注册</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">产品文档</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">技术文档</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a>
</p>

<p align="center">
  <img alt="应用版本 v0.5.0" src="https://img.shields.io/badge/app-v0.5.0-2563eb" />
  <img alt="工作流版本 v0.2.0" src="https://img.shields.io/badge/workflow-v0.2.0-0f766e" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="Supabase Auth" src="https://img.shields.io/badge/auth-Supabase-3ecf8e" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111827" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

## 项目简介

ScholarForge OS 把传统的“一次性整段润色”拆成一条可追踪的专业审校链路：四个独立的阿里云百炼 Agent 并行识别术语、学术语言、科学逻辑和方法报告问题，随后由代码统一规范化结果、合并重复问题、执行科学保护规则、计算投稿准备度，并生成可下载的修改稿与审校报告。

项目的目标不是让句子看起来更华丽，而是让科研英文审校同时具备：

- **专业分工**：每类问题由职责明确的 Agent 独立审查；
- **证据定位**：每条问题保留原文、建议、理由和来源；
- **科学保护**：不虚构实验、数值、标准、文献或方法细节；
- **结果一致**：评分与 Reviewer Decision 由同一套代码规则生成；
- **可复核交付**：界面可检查，结果可导出，运行过程可追踪；
- **低门槛体验**：比赛评审可直接以访客身份进入，不被强制注册阻断。

> 核心原则：**模型负责专业判断，代码负责最终规则。**

## 为什么需要 ScholarForge OS

通用写作工具擅长改善语法与流畅度，但科研论文还需要处理术语一致性、证据边界、方法可复现性和事实保护。单一提示词很难同时完成这些目标，也很难解释一次修改究竟来自哪一种专业判断。

| 科研写作风险 | ScholarForge OS 的处理方式 |
| --- | --- |
| 缩写、单位、材料或试件命名前后不一致 | Terminology Guardian 建立问题清单与术语建议 |
| 语法正确但不符合学术表达习惯 | Academic Editor 生成保守的全文修改稿 |
| 因果、绝对化表述或结论超过证据 | Logic Auditor 标记证据边界与逻辑跳跃 |
| 样本数、设备参数或数据处理信息缺失 | Method Auditor 提出可复现性补充项 |
| 修改结果无法解释或评分相互冲突 | 聚合器统一问题结构、权重、评分和 Decision |
| 强制注册影响公开 Demo 体验 | 账户登录与访客模式并存，公开审校入口保持可用 |

## 产品结构

![ScholarForge OS 产品结构](docs/readme-assets/product-structure.svg)

产品围绕一条完整工作链路组织：

1. **Account Access**：可选择 Supabase 云端账户、本地演示账户或访客模式；
2. **Review Input**：接收目标期刊与 40–12,000 字符的科研英文文本；
3. **Parallel Agent Team**：四个专业 Agent 发起四次独立模型请求；
4. **Evidence Aggregator**：规范化结果、去重、执行保护检查与确定性评分；
5. **Review Workspace**：集中呈现原文对照、作者待办、问题、术语与运行轨迹；
6. **Submission Readiness**：统一输出分数、Reviewer Decision 及其理由；
7. **Deliverables**：生成修改稿、Markdown 审校报告和结构化 JSON。

## 四个专业 Agent

| Agent | 主要职责 | 关键产出 |
| --- | --- | --- |
| **Terminology Guardian** | 检查缩写、术语、单位、符号与命名一致性 | 术语问题与规范化建议 |
| **Academic Editor** | 检查语法、搭配、学术语气、清晰度与可读性 | 保守全文修改稿与语言问题 |
| **Logic Auditor** | 检查因果关系、证据边界、逻辑跳跃与过度表述 | 逻辑风险与修改建议 |
| **Method Auditor** | 检查实验报告完整性与方法可复现性 | 缺失信息与作者补充项 |

每个 Agent 都有独立的 System Prompt、请求、响应、耗时和失败状态。系统不是用一个提示词模拟四个角色。

## 使用流程

1. 直接进入工作台，或先在 `/login` 注册 / 登录；
2. 输入目标期刊并粘贴科研英文段落；
3. 启动全面审校；系统使用 `Promise.all` 并行调度四个 Agent；
4. 各 Agent 返回独立的结构化问题与建议；
5. 聚合器统一字段、合并重复问题，并保留来源 Agent；
6. 科学保护规则检查新增数字、意义漂移和方法缺失处理；
7. 代码根据严重程度与问题类型计算修改前后评分和 Decision；
8. 在工作台复核结果、查看作者待办并下载 TXT、Markdown 或 JSON 交付物。

单个 Agent 默认最多等待 46 秒；其失败不会抹除其他 Agent 的成功结果。只有四个 Agent 全部失败时，本次审校才整体失败。

## 审校工作台

![ScholarForge OS 审校工作台](docs/readme-assets/workspace-preview.svg)

- **左侧**：当前项目、草稿状态、Agent 团队状态和科学保护规则；
- **中间**：文本输入、原文对照、作者待办、问题中心、术语库和执行轨迹；
- **右侧**：投稿准备度、Decision 理由、风险分布和交付物；
- **移动端**：输入、结果、问题和导出使用页面级导航，不直接堆叠三栏。

界面同时支持：

- **真实模式**：调用已配置的阿里云百炼模型；
- **演示模式**：使用明确标记的本地安全样例，不调用外部模型；
- **局部失败状态**：保留成功 Agent 的结果并显示失败原因；
- **草稿自动保存**：目标期刊和论文文本保存在当前浏览器；
- **问题管理**：支持搜索、Agent / 严重程度筛选、展开与收起；
- **作者待办**：自动整理重大逻辑、方法和 `[Please provide ...]` 事项。

## 账户与登录

v0.5 增加了独立的登录 / 注册界面和全局账户入口，同时保留公开访客体验。

| 账户模式 | 说明 | 当前存储位置 |
| --- | --- | --- |
| **Supabase 云端账户** | 配置 Supabase 后支持真实邮箱注册、登录、邮箱确认、密码重置和会话保持 | Supabase Auth |
| **本地演示账户** | 未配置 Supabase 时用于验证账户 UX；不会上传或保存密码 | 当前浏览器 |
| **访客模式** | 无需注册即可进入比赛 Demo | 当前浏览器 |

当前账户系统只负责身份和会话，**尚未实现按用户隔离的云端论文项目**。论文草稿仍保存在浏览器本地，`/api/review` 为了公开比赛体验仍可匿名调用。

详细说明见：[账户与认证架构](docs/authentication.md)。

## 阿里云百炼能力使用

ScholarForge OS 的核心审校能力由阿里云百炼 Model Studio 提供。

- 默认模型：`qwen-plus`；
- 接口：DashScope OpenAI 兼容 API；
- 位置：Next.js 服务端；
- 单次全面审校：正常情况下发起四次独立模型请求；
- API Key：仅由服务端环境变量读取，不进入浏览器。

运行链路：

```text
Browser
  ↓
Next.js POST /api/review
  ↓
4 independent specialist requests
  ↓
Alibaba Cloud Model Studio · qwen-plus
  ↓
Deterministic Aggregator
  ↓
Review workspace + downloadable artifacts
```

核心代码：

- [`lib/bailian.ts`](lib/bailian.ts)：四个 Agent 的 Prompt、百炼调用、结果规范化、去重和评分；
- [`app/api/review/route.ts`](app/api/review/route.ts)：输入校验、演示 / 真实模式切换和错误边界；
- [`app/api/health/route.ts`](app/api/health/route.ts)：百炼与认证配置健康状态；
- [`.env.example`](.env.example)：百炼和 Supabase 环境变量模板。

## 科学保护机制

ScholarForge OS 把科学含义的完整性放在语言流畅度之前：

- 不虚构实验、样本数量、设备参数、标准、结果或参考文献；
- 不在修改稿中新增原文不存在的数值 token；
- 对缺失信息使用 `[Please provide ...]` 作者占位符；
- 不把语言润色伪装成科学结论修改；
- 不让模型直接决定最终评分和 Reviewer Decision；
- 不因英文变流畅而自动消除重大的逻辑或方法问题。

这些机制用于降低明显风险，不等同于完整的事实核验、统计审查或同行评议。

## 技术架构

![ScholarForge OS 系统架构](docs/readme-assets/arch-system.svg)

| 层级 | 职责 |
| --- | --- |
| **Identity Layer** | Supabase Auth、访客模式、本地演示会话和账户状态展示 |
| **Client Layer** | 响应式工作台、草稿保存、问题管理、结果视图与浏览器端导出 |
| **Application Layer** | Next.js Route Handlers、输入校验、健康检查与错误响应 |
| **Orchestration Layer** | 并行调度、规范化、去重、保护规则、评分与 Decision |
| **Agent Layer** | 四个独立的百炼 OpenAI 兼容接口请求 |
| **Artifact Layer** | TXT、Markdown 与 JSON 文件生成 |

### 并行运行时

![ScholarForge OS 并行工作流](docs/readme-assets/workflow-runtime.svg)

- `POST /api/review`：执行演示或真实审校；路由最大执行时间为 60 秒；
- `GET /api/health`：返回应用版本、模型配置、认证配置和当前模型；
- 正文长度：40–12,000 字符；
- 目标期刊名称：最多 160 字符；
- 单 Agent 超时：46 秒；
- 默认模型：`qwen-plus`。

### 评分与 Reviewer Decision

模型负责识别问题，代码负责最终评分。重大逻辑 / 方法问题的权重高于语言 / 术语问题，修改后仍未解决的问题继续计入惩罚。

| Decision | 确定性条件 |
| --- | --- |
| `Major Revision` | 修改后分数低于 80，或仍有至少 2 个重大 Logic / Method 问题 |
| `Minor Revision` | 修改后分数低于 92，或仍有任意重大问题 |
| `Ready for Submission` | 修改后分数至少 92，且没有重大问题 |

评分是产品内的辅助判断，不代表目标期刊的官方结论。

## 当前交付物

| 文件 | 内容 |
| --- | --- |
| `Revised_Manuscript.txt` | Academic Editor 生成的保守修改稿 |
| `Audit_Report.md` | 审校摘要、问题、术语、运行轨迹与 Decision |
| `Review_Result.json` | 完整结构化结果、Agent 运行信息与保护状态 |

文件通过浏览器 `Blob` 与 Object URL 在本地生成；当前版本不提供云端项目存储。

## 技术栈

| 领域 | 技术 |
| --- | --- |
| 前端 | Next.js 16、React 19、TypeScript、原生 CSS |
| 账户 | Supabase Auth（可选）、浏览器本地访客 / 演示会话 |
| 服务端 | Next.js Route Handlers、Node.js Runtime |
| 模型平台 | 阿里云百炼 Model Studio OpenAI 兼容接口 |
| 多 Agent 调度 | `Promise.all` 并行执行 |
| 文件导出 | Browser Blob、Object URL |
| 部署 | Vercel |
| CI | GitHub Actions、Node.js 22 |

## 快速开始

### 环境要求

- Node.js 22.12+；
- npm；
- 阿里云百炼 API Key（可选；未配置时进入审校演示模式）；
- Supabase 项目（可选；未配置时使用明确标记的本地演示账户）。

### 1. 克隆并安装

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

### 2. 配置环境变量

Windows CMD：

```bat
copy .env.example .env.local
```

macOS、Linux 或 PowerShell：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
DASHSCOPE_API_KEY=你的百炼_API_Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | 否 | 未配置时使用审校演示模式；真实百炼模式必填 |
| `DASHSCOPE_BASE_URL` | 否 | 百炼 OpenAI 兼容接口基础地址 |
| `DASHSCOPE_MODEL` | 否 | 模型名称，默认 `qwen-plus` |
| `NEXT_PUBLIC_SUPABASE_URL` | 否 | Supabase 项目 URL；真实账户模式需要 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 否 | Supabase Publishable Key；可以公开到浏览器，但必须配合 Auth / RLS 设计 |

不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则百炼密钥会被打包到浏览器端。

### 3. 启动与验证

```bash
npm run dev
```

- 应用：`http://localhost:3000`；
- 登录页：`http://localhost:3000/login`；
- 健康检查：`http://localhost:3000/api/health`。

```bash
npm run typecheck
npm run build
```

## Vercel 部署

1. 在 Vercel 导入 `liqinglq666/scholarforge-os`；
2. 保持 Next.js Framework Preset 与根目录 `./`；
3. 配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 和 `DASHSCOPE_MODEL`；
4. 需要真实登录时，再配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；
5. 在 Supabase Redirect URLs 中加入 `https://scholarforge-os.vercel.app/login`；
6. 部署后打开 `/api/health`，确认：
   - `modelStudioConfigured: true`；
   - `authConfigured: true`（仅在已配置 Supabase 时）；
7. 从首页执行一次真实审校，并测试登录、退出和访客入口。

## 仓库结构

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts       # 百炼与认证配置健康检查
│   │   └── review/route.ts       # 多 Agent 审校 API
│   ├── login/page.tsx            # 登录、注册和访客入口
│   ├── auth.css                  # 认证界面视觉系统
│   ├── globals.css               # 基础界面视觉系统
│   ├── v04.css                   # v0.4 工作台增强样式
│   ├── layout.tsx
│   └── page.tsx                  # 审校工作台
├── components/
│   ├── auth-provider.tsx         # 认证状态和操作
│   └── account-dock.tsx          # 全局账户入口与退出菜单
├── lib/
│   ├── supabase/client.ts        # 可选 Supabase 浏览器客户端
│   ├── bailian.ts                # Agent 调用、聚合、评分与保护规则
│   ├── demo-review.ts            # 演示模式固定结果
│   └── types.ts                  # 核心数据契约
├── docs/
│   ├── authentication.md         # 账户架构、配置和安全边界
│   └── readme-assets/            # README 架构与界面图
├── public/scholarforge-mark.svg
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── README.md
└── README.en.md
```

## 版本说明

- **应用版本 `v0.5.0`**：账户入口、登录 / 注册 UI、访客模式和 v0.4 工作台能力；
- **工作流契约 `v0.2.0`**：`/api/review` 返回的审校数据结构；
- **演示工作流 `v0.2.0-demo`**：演示模式固定结果的契约标识。

应用版本和工作流版本承担不同职责，因此不会强制保持相同编号。

## 当前边界

- 仅支持纯文本输入，暂不解析 PDF 或 DOCX；
- 已有账户登录与会话，但暂无按用户隔离的云端论文项目；
- 论文草稿仍保存在浏览器 localStorage；
- `/api/review` 为公开比赛 Demo 保持匿名可调用，尚未做服务端登录鉴权；
- 暂不支持逐条接受或拒绝修改；
- 完整修改稿仅由 Academic Editor 生成；
- Logic 与 Method 建议保留在问题中心，不会被自动编造成论文事实；
- 数值保护为 token 级检测，不等同于完整事实核验；
- 多 Agent 运行受单次 Vercel 函数生命周期限制；
- 真实模式会把输入文本发送到阿里云百炼模型服务。

## 路线图

### v0.6 · 云端论文项目

- Supabase `profiles`、`projects`、`manuscript_versions` 与 `review_runs`；
- Row Level Security 与按用户数据隔离；
- 匿名草稿迁移到登录账户；
- 审校历史与版本历史；
- 服务端 JWT 验证和用户调用配额。

### v0.7 · 文档审校与决策

- PDF / DOCX 上传与章节解析；
- 逐条接受、拒绝或稍后处理；
- DOCX Track Changes 导出；
- 术语记忆和跨版本一致性。

### v0.8 · 投稿材料与证据链

- Response to Reviewers；
- Cover Letter、Highlights 与 Author Contributions；
- 期刊指南知识库；
- 引用、DOI 和跨章节一致性检查。

## 文档

- [ScholarForge OS 产品文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe)
- [ScholarForge OS 技术文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c)
- [账户与认证说明](docs/authentication.md)

两份飞书文档均设置为“互联网获得链接的人可阅读”。产品文档包含产品定位、场景、机制、边界与演示附录；技术文档包含架构、数据契约、运行时、规则、部署与测试边界。

## License

仓库当前未包含开源许可证。除非获得版权所有者明确许可，否则不默认授予复制、修改、分发或商业使用权。
