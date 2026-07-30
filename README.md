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
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe">产品文档</a> ·
  <a href="https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c">技术文档</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a>
</p>

<p align="center">
  <img alt="应用版本 v0.3.0" src="https://img.shields.io/badge/app-v0.3.0-2563eb" />
  <img alt="工作流版本 v0.2.0" src="https://img.shields.io/badge/workflow-v0.2.0-0f766e" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111827" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml">
    <img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" />
  </a>
</p>

## 项目简介

ScholarForge OS 把传统的“一次性整段润色”拆成一条可追踪的专业审校链路：四个独立的阿里云百炼 Agent 并行识别术语、学术语言、科学逻辑和方法报告问题，随后由代码统一规范化结果、合并重复问题、执行科学保护规则、计算投稿准备度，并生成可下载的修改稿与审校报告。

项目的目标不是让句子看起来更华丽，而是让科研英文审校同时具备：

- **专业分工**：每类问题由职责明确的 Agent 独立审查
- **证据定位**：每条问题保留原文、建议、理由和来源
- **科学保护**：不虚构实验、数值、标准、文献或方法细节
- **结果一致**：评分与 Reviewer Decision 由同一套代码规则生成
- **可复核交付**：界面可检查，结果可导出，运行过程可追踪

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

## 产品结构

![ScholarForge OS 产品结构](docs/readme-assets/product-structure.svg)

产品围绕一条完整工作链路组织：

1. **Review Input**：接收目标期刊与 40–12,000 字符的科研英文文本。
2. **Parallel Agent Team**：四个专业 Agent 发起四次独立模型请求。
3. **Evidence Aggregator**：规范化结果、去重、执行保护检查与确定性评分。
4. **Review Workspace**：集中呈现原文对照、问题、术语与运行轨迹。
5. **Submission Readiness**：统一输出分数、Reviewer Decision 及其理由。
6. **Deliverables**：生成修改稿、Markdown 审校报告和结构化 JSON。

## 四个专业 Agent

| Agent | 主要职责 | 关键产出 |
| --- | --- | --- |
| **Terminology Guardian** | 检查缩写、术语、单位、符号与命名一致性 | 术语问题与规范化建议 |
| **Academic Editor** | 检查语法、搭配、学术语气、清晰度与可读性 | 保守全文修改稿与语言问题 |
| **Logic Auditor** | 检查因果关系、证据边界、逻辑跳跃与过度表述 | 逻辑风险与修改建议 |
| **Method Auditor** | 检查实验报告完整性与方法可复现性 | 缺失信息与作者补充项 |

每个 Agent 都有独立的 System Prompt、请求、响应、耗时和失败状态。系统不是用一个提示词模拟四个角色。

## 使用流程

1. 输入目标期刊并粘贴科研英文段落。
2. 启动全面审校；系统使用 `Promise.all` 并行调度四个 Agent。
3. 各 Agent 返回独立的结构化问题与建议。
4. 聚合器统一字段、合并重复问题，并保留来源 Agent。
5. 科学保护规则检查新增数字、意义漂移和方法缺失处理。
6. 代码根据严重程度与问题类型计算修改前后评分和 Decision。
7. 在工作台复核结果，下载 TXT、Markdown 或 JSON 交付物。

单个 Agent 默认最多等待 46 秒；其失败不会抹除其他 Agent 的成功结果。只有四个 Agent 全部失败时，本次审校才整体失败。

## 审校工作台

![ScholarForge OS 审校工作台](docs/readme-assets/workspace-preview.svg)

- **左侧**：论文项目、Agent 团队状态和科学保护规则
- **中间**：文本输入、原文对照、问题中心、术语库和执行轨迹
- **右侧**：投稿准备度、Decision 理由、审校指标和交付物

界面同时支持：

- **真实模式**：调用已配置的阿里云百炼模型
- **演示模式**：使用明确标记的本地安全样例，不调用外部模型
- **局部失败状态**：保留成功 Agent 的结果并显示失败原因

## 科学保护机制

ScholarForge OS 把科学含义的完整性放在语言流畅度之前：

- 不虚构实验、样本数量、设备参数、标准、结果或参考文献
- 不在修改稿中新增原文不存在的数值 token
- 对缺失信息使用 `[Please provide ...]` 作者占位符
- 不把语言润色伪装成科学结论修改
- 不让模型直接决定最终评分和 Reviewer Decision
- 不因英文变流畅而自动消除重大的逻辑或方法问题

这些机制用于降低明显风险，不等同于完整的事实核验、统计审查或同行评议。

## 技术架构

![ScholarForge OS 系统架构](docs/readme-assets/arch-system.svg)

| 层级 | 职责 |
| --- | --- |
| **Client Layer** | 三栏工作台、交互状态、结果视图与浏览器端导出 |
| **Application Layer** | Next.js Route Handlers、输入校验、健康检查与错误响应 |
| **Orchestration Layer** | 并行调度、规范化、去重、保护规则、评分与 Decision |
| **Agent Layer** | 四个独立的百炼 OpenAI 兼容接口请求 |
| **Artifact Layer** | TXT、Markdown 与 JSON 文件生成 |

### 并行运行时

![ScholarForge OS 并行工作流](docs/readme-assets/workflow-runtime.svg)

- `POST /api/review`：执行演示或真实审校；路由最大执行时间为 60 秒
- `GET /api/health`：返回应用版本、模型配置状态与当前模型
- 正文长度：40–12,000 字符
- 目标期刊名称：最多 160 字符
- 单 Agent 超时：46 秒
- 默认模型：`qwen-plus`

### 评分与 Reviewer Decision

模型负责识别问题，代码负责最终评分。重大逻辑/方法问题的权重高于语言/术语问题，修改后仍未解决的问题继续计入惩罚。

| Decision | 确定性条件 |
| --- | --- |
| `Major Revision` | 修改后分数低于 80，或仍有至少 2 个重大 Logic/Method 问题 |
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
| 服务端 | Next.js Route Handlers、Node.js Runtime |
| 模型平台 | 阿里云百炼 Model Studio OpenAI 兼容接口 |
| 多 Agent 调度 | `Promise.all` 并行执行 |
| 文件导出 | Browser Blob、Object URL |
| 部署 | Vercel |
| CI | GitHub Actions、Node.js 22 |

## 快速开始

### 环境要求

- Node.js 20.9+（推荐 Node.js 22）
- npm
- 阿里云百炼 API Key（可选；未配置时进入演示模式）

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
```

| 变量 | 是否必填 | 说明 |
| --- | --- | --- |
| `DASHSCOPE_API_KEY` | 否 | 未配置时使用演示模式；真实模式必填 |
| `DASHSCOPE_BASE_URL` | 否 | 百炼 OpenAI 兼容接口基础地址 |
| `DASHSCOPE_MODEL` | 否 | 模型名称，默认 `qwen-plus` |

不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则密钥会被打包到浏览器端。

### 3. 启动与验证

```bash
npm run dev
```

- 应用：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`

```bash
npm run typecheck
npm run build
```

## Vercel 部署

1. 在 Vercel 导入 `liqinglq666/scholarforge-os`。
2. 保持 Next.js Framework Preset 与根目录 `./`。
3. 配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 和 `DASHSCOPE_MODEL`。
4. 部署后打开 `/api/health`，确认 `modelStudioConfigured: true`。
5. 从首页执行一次真实审校，验证四个 Agent 的运行轨迹。

## 仓库结构

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts       # 版本与模型配置健康检查
│   │   └── review/route.ts       # 多 Agent 审校 API
│   ├── globals.css               # 界面视觉系统
│   ├── layout.tsx
│   └── page.tsx                  # 三栏审校工作台
├── lib/
│   ├── bailian.ts                # Agent 调用、聚合、评分与保护规则
│   ├── demo-review.ts            # 演示模式固定结果
│   └── types.ts                  # 核心数据契约
├── docs/readme-assets/           # README 架构与界面图
├── public/scholarforge-mark.svg
├── .github/workflows/ci.yml
├── .env.example
├── package.json
├── README.md
└── README.en.md
```

## 版本说明

- **应用版本 `v0.3.0`**：Web 应用和发布版本
- **工作流契约 `v0.2.0`**：`/api/review` 返回的审校数据结构
- **演示工作流 `v0.2.0-demo`**：演示模式固定结果的契约标识

应用版本和工作流版本承担不同职责，因此不会强制保持相同编号。

## 当前边界

- 仅支持纯文本输入，暂不解析 PDF 或 DOCX
- 暂无账号、数据库和云端论文项目持久化
- 暂不支持逐条接受或拒绝修改
- 完整修改稿仅由 Academic Editor 生成
- Logic 与 Method 建议保留在问题中心，不会被自动编造成论文事实
- 数值保护为 token 级检测，不等同于完整事实核验
- 多 Agent 运行受单次 Vercel 函数生命周期限制
- 真实模式会把输入文本发送到阿里云百炼模型服务

## 路线图

### v0.4 · 文档与项目工作区

- PDF/DOCX 上传与章节解析
- 论文版本历史与术语记忆
- 逐条接受或拒绝修改
- DOCX Track Changes 导出

### v0.5 · 投稿材料工作流

- Response to Reviewers
- Cover Letter、Highlights 与 Author Contributions
- Data Availability Statement

### v0.6 · 证据链与一致性

- 期刊指南知识库
- 引用与 DOI 核验
- 跨章节术语、数值与结论一致性检查

## 文档

- [ScholarForge OS 产品文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/IuKGwEAU9isxlck4V8ec8jJcnpe)
- [ScholarForge OS 技术文档（飞书）](https://dcnua2ebj1ej.feishu.cn/wiki/JGxewZQa5izFL0kKQMycXkC9n0c)

两份文档均设置为“互联网获得链接的人可阅读”。产品文档包含产品定位、场景、机制、边界与演示附录；技术文档包含架构、数据契约、运行时、规则、部署与测试边界。

## License

仓库当前未包含开源许可证。除非获得版权所有者明确许可，否则不默认授予复制、修改、分发或商业使用权。
