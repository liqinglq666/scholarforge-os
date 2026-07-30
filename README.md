# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-mark.svg" alt="ScholarForge OS Mark" width="150" />
</p>

<p align="center">
  面向科研人员的多智能体学术英语审校与投稿工作台
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="docs/product.md">产品文档</a> ·
  <a href="docs/technical.md">技术文档</a> ·
  <a href="docs/PRD.md">PRD</a>
</p>

## 一句话介绍

ScholarForge OS 是一个面向科研人员的多智能体学术英语工作台，由四个独立百炼 Agent 并行完成术语、语言、逻辑和方法审查，再由代码统一聚合问题、校准评分并生成可下载交付物。

## 它解决什么问题

很多科研英语工具能够把句子改得更流畅，却很难承接真实论文工作：修改原因不可见、科学含义可能漂移、术语前后不一致、方法缺失被擅自补写，甚至评分与 Reviewer Decision 相互冲突。

ScholarForge OS 关注的不是“再做一个润色框”，而是把专业分工、证据定位、科学保护、运行轨迹、确定性评分和结果交付串成一条完整工作链路。

它主要解决五类问题：

- **语言不自然**：语法、搭配、学术语气和可读性
- **术语不一致**：缩写、单位、符号、材料和试件命名
- **结论超过证据**：因果过度、绝对化表达和逻辑跳跃
- **方法不可复现**：样本数、设备参数、重复次数和数据处理缺失
- **结果不可复核**：修改无定位、无理由、无来源 Agent、无法导出

## 产品架构

![ScholarForge OS 产品结构](docs/readme-assets/product-structure.svg)

产品由一条审校主链路和四个专业模块构成：

- **Review Input**：接收目标期刊和科研英文文本
- **Parallel Agent Team**：四个独立 Agent 并行调用阿里云百炼
- **Evidence Aggregator**：规范化、去重、保护检查和确定性评分
- **Review Workspace**：原文对照、问题中心、术语库和运行轨迹
- **Submission Readiness**：统一生成分数、Decision 和理由
- **Deliverables**：导出修改稿、Markdown 报告和结构化 JSON

这条路径的核心原则是：**模型负责专业判断，代码负责最终规则。**

## 核心使用路径

1. 输入目标期刊，粘贴科研英文段落。
2. 启动全面审校，四个 Agent 并行执行。
3. Terminology Guardian 检查术语、缩写、单位和命名。
4. Academic Editor 生成保守全文修改稿。
5. Logic Auditor 检查因果、证据边界和逻辑跳跃。
6. Method Auditor 检查复现性和报告完整性。
7. 聚合器去重问题，执行科学保护规则并计算评分。
8. 在工作台查看对照、问题、术语和真实运行轨迹。
9. 下载修改稿、审校报告或 JSON 证据数据。

## 产品界面

### 三栏审校工作台

![ScholarForge OS 工作台](docs/readme-assets/workspace-preview.svg)

工作台由三部分构成：

- 左侧：论文项目、Agent 团队状态和科学保护规则
- 中间：文本输入、对照审校、问题中心、术语库和执行轨迹
- 右侧：投稿准备度、Decision 原因、审校指标和交付物

## 真实多 Agent

当前 v0.2 不再使用一次提示词模拟多个角色，而是执行四次独立模型请求：

```text
Terminology Agent ─┐
Language Agent ────┼──→ Deterministic Aggregator
Logic Agent ───────┤
Method Agent ──────┘
```

四个请求通过 `Promise.all` 并行执行。每个 Agent 拥有独立 System Prompt、独立输出、独立耗时和独立失败状态。

如果某一个 Agent 失败，其余成功结果仍会被保留；只有四个 Agent 全部失败时，工作流才整体失败。

## 科学保护规则

ScholarForge OS 把科研可信度放在语言流畅度之前：

- 不虚构实验、样本数量、设备参数、标准或参考文献
- 不新增原文没有的数值和试验结果
- 缺失信息必须使用 `[Please provide ...]` 作者占位符
- 不把语言润色伪装成科学结论修改
- 模型不能直接决定最终评分与 Reviewer Decision
- Logic 与 Method 的重大问题不会因为英文变流畅而自动消失

## 技术架构

![ScholarForge OS 系统整体架构](docs/readme-assets/arch-system.svg)

系统采用轻量 Next.js 全栈架构：

- **Client Layer**：三栏工作台、结果视图与浏览器端文件导出
- **Application Layer**：Next.js Route Handlers、输入校验、健康检查和错误边界
- **Orchestration Layer**：并行调度、输出规范化、去重、评分和 Decision
- **Agent Layer**：四个独立阿里云百炼 `qwen-plus` 调用
- **Artifact Layer**：TXT、Markdown 和 JSON 交付物

### 并行工作流

![ScholarForge OS 并行工作流](docs/readme-assets/workflow-runtime.svg)

### 评分与 Decision

最终评分由代码根据标准化问题计算，而不是采用模型自由输出：

```text
Major Logic / Method > Major Language / Terminology
Minor Logic / Method > Minor Language / Terminology
Suggestion 只产生轻微影响
```

Decision 规则：

- `Major Revision`：修改后分数低于 80，或仍有至少 2 个重大 Logic/Method 问题
- `Minor Revision`：修改后分数低于 92，或仍有任意重大问题
- `Ready for Submission`：修改后分数至少 92，且没有重大问题

## 当前交付物

当前版本已经提供真实下载功能：

- `Revised_Manuscript.txt`：保守修改稿
- `Audit_Report.md`：包含摘要、问题、术语、运行轨迹和 Decision 的完整报告
- `Review_Result.json`：结构化 Agent 结果和科学保护状态

DOCX Track Changes、PDF 报告和 Response to Reviewers 将在后续版本接入。

## 技术栈

| 层级 | 技术选型 |
| --- | --- |
| 前端 | Next.js 16、React 19、TypeScript、原生 CSS |
| 服务端 | Next.js Route Handlers、Node.js Runtime |
| 模型平台 | 阿里云百炼 Model Studio OpenAI 兼容接口 |
| 默认模型 | `qwen-plus` |
| 多 Agent 调度 | `Promise.all` 并行执行 |
| 文件导出 | Browser Blob、Object URL |
| 部署 | Vercel |
| CI | GitHub Actions、Node.js 22 |

## 仓库结构

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts       # 部署与百炼配置健康检查
│   │   └── review/route.ts       # 多 Agent 审校 API
│   ├── globals.css               # 基础视觉系统
│   ├── v02.css                   # v0.2 运行轨迹与交付物样式
│   ├── layout.tsx
│   └── page.tsx                  # 三栏审校工作台
├── lib/
│   ├── bailian.ts                # 四 Agent 调用、聚合、评分和保护规则
│   ├── demo-review.ts            # 安全演示模式
│   └── types.ts                  # 核心数据结构
├── public/
│   └── scholarforge-mark.svg
├── docs/
│   ├── PRD.md
│   ├── product.md
│   ├── technical.md
│   └── readme-assets/
├── .github/workflows/ci.yml
├── .env.example
├── package.json
└── README.md
```

## 快速开始

### 环境要求

- Node.js 20.9+
- 推荐 Node.js 22
- npm
- 阿里云百炼 API Key（可选；没有 Key 时自动进入演示模式）

### 克隆项目

```bash
git clone git@github.com:liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

### 配置环境变量

Windows CMD：

```bat
copy .env.example .env.local
```

macOS / Linux / PowerShell：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
DASHSCOPE_API_KEY=你的百炼APIKey
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则密钥会暴露给浏览器。

### 本地启动

```bash
npm run dev
```

默认地址：

- Web：`http://localhost:3000`
- Health：`http://localhost:3000/api/health`

### 类型检查与构建

```bash
npm run typecheck
npm run build
```

## Vercel 部署

1. 使用 GitHub 登录 Vercel。
2. 导入 `liqinglq666/scholarforge-os`。
3. Framework Preset 保持 Next.js。
4. Root Directory 保持 `./`。
5. 添加 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`DASHSCOPE_MODEL`。
6. 点击 Deploy。
7. 打开 `/api/health`，检查 `modelStudioConfigured: true`。
8. 在首页执行一次真实审校。

## 相关文档

- [产品需求文档 PRD](docs/PRD.md)
- [产品文档](docs/product.md)
- [技术文档](docs/technical.md)
- [部署与环境配置](README.md#vercel-部署)

## 当前边界

- 当前输入为纯文本，暂不解析 PDF 和 DOCX
- 当前没有用户登录、数据库和云端论文项目存储
- 当前不支持逐条接受或拒绝修改
- 当前只由 Academic Editor 生成完整保守修改稿
- Logic 和 Method 的建议保留在问题中心，不会自动编造成论文事实
- 当前数值保护是 token 级检查，不等同于完整事实核验
- 多 Agent 执行仍受 Vercel 单次函数生命周期限制
- 当前评分是产品辅助判断，不代表目标期刊官方结论
- 真实模式下，输入文本会发送到阿里云百炼模型服务

## 路线图

### v0.3 · 文档与论文项目空间

- PDF/DOCX 上传
- 章节结构解析
- 论文版本历史
- 术语记忆
- 逐条接受或拒绝修改

### v0.4 · 投稿工作流

- Response to Reviewers
- Cover Letter
- Highlights
- Author Contributions
- Data Availability Statement

### v0.5 · 证据链

- 期刊指南知识库
- 引用与 DOI 核验
- 跨章节一致性检查
- DOCX Track Changes 导出

## License

暂未添加开源许可证。未经许可，不默认授予复制、修改或商业使用权。
