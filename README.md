# ScholarForge OS · 研语工坊

[简体中文](README.md) | [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS 标志" width="440" />
</p>

<p align="center">
  <strong>从论文导入、多 Agent 审校到作者修改与原始 DOCX 修订交付的一体化科研写作工作台</strong>
</p>

<p align="center">
  科研中译英、英文保守润色、投稿前预检、审稿回复、云端项目、<br />
  问题级安全应用，以及保留原 Word 结构的 DOCX 修订补丁。
</p>

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/login">登录 / 访客体验</a> ·
  <a href="docs/PRD.md">PRD</a> ·
  <a href="docs/technical.md">技术文档</a> ·
  <a href="docs/cloud-workspace.md">云端项目部署</a> ·
  <a href="docs/releases/v1.3-original-docx-patching.md">v1.3 发布说明</a>
</p>

<p align="center">
  <img alt="应用版本 v1.3.2" src="https://img.shields.io/badge/app-v1.3.2-17233d" />
  <img alt="Alibaba Cloud Model Studio" src="https://img.shields.io/badge/Alibaba%20Cloud-Model%20Studio-ff6a00" />
  <img alt="qwen-plus" src="https://img.shields.io/badge/model-qwen--plus-7c3aed" />
  <img alt="Four parallel agents" src="https://img.shields.io/badge/workflow-4%20parallel%20agents-0f766e" />
  <img alt="Original DOCX patching" src="https://img.shields.io/badge/DOCX-original%20package%20patch-2f6d67" />
  <img alt="Supabase Auth and RLS" src="https://img.shields.io/badge/cloud-Supabase%20Auth%20%2B%20RLS-3ecf8e" />
  <a href="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/liqinglq666/scholarforge-os/actions/workflows/ci.yml/badge.svg" /></a>
</p>

---

## 项目定位

ScholarForge OS 面向硕士生、博士生、科研人员、导师和学术编辑。它不是只负责“把英文改流畅”的输入框，而是一套覆盖论文输入、专业审校、作者决策和 Word 交付的科研写作系统。

```text
DOCX / PDF 论文
→ 章节识别与范围选择
→ 4 个百炼 Agent 并行处理
→ 问题证据与科学保护
→ 作者逐条决策
→ 安全应用到工作稿
→ 新工作稿 DOCX / 原始 DOCX 修订补丁
→ 本地或用户隔离的云端项目
```

核心原则：

> **模型负责专业判断，代码负责规则、保护、定位、冲突处理、评分和最终状态。**

## 四种科研英语工作流

| 工作流 | 输入 | 核心任务 | 主要输出 |
| --- | --- | --- | --- |
| **科研中译英** | 中文科研段落 | 保留数值、术语、证据强度和科学语气 | Academic English Translation |
| **英文保守润色** | 英文论文段落 | 改善语法、搭配和学术表达，不新增事实 | Conservative Revision |
| **投稿前预检** | 待投稿英文稿件 | 检查术语、语言、逻辑、方法与准备度 | Revision + Evidence |
| **审稿回复助手** | Reviewer Comment + 作者依据 | 生成不虚构实验和位置的正式回应 | Response to Reviewer Draft |

四种任务共用七种论文章节、三种处理强度、术语锁、问题证据、作者决策和科学保护规则。

## 四个独立百炼 Agent

| Agent | 职责 |
| --- | --- |
| **Terminology Guardian** | 术语、缩写、单位、符号、命名与用户术语锁 |
| **Academic Editor** | 翻译、润色、预检修改稿或返修信主输出 |
| **Logic Auditor** | 因果、证据边界、结论强度和回应完整性 |
| **Method Auditor** | 样本、设备、参数、统计、可重复性与作者依据 |

正常任务会向阿里云百炼发起 4 次独立 `qwen-plus` 请求，通过 `Promise.all` 并行执行。每个 Agent 都有独立提示词、结果、耗时和失败状态。

```text
Browser
  ↓
Next.js POST /api/review
  ↓
4 independent specialist requests
  ↓
Alibaba Cloud Model Studio · qwen-plus
  ↓
Deterministic aggregator and scientific guardrails
  ↓
Primary output + issue evidence + terminology + author decisions
```

API Key 只从服务端环境变量读取。最终分数和 Reviewer Decision 由代码根据规范化问题集计算，不由模型自由生成。

## 文档导入

浏览器端支持：

- DOCX 语义标题和段落解析；
- 可复制文字的 PDF 逐页提取；
- Abstract、Introduction、Methods、Results、Discussion、Conclusion 识别；
- 超过 12,000 字符的章节按段落拆分；
- 导入前章节预览和范围选择；
- 公式、表格、双栏、页眉页脚和扫描 PDF 风险提示。

选择文件不会自动把完整 DOCX/PDF 上传给 ScholarForge 或百炼。只有作者导入工作台并主动启动任务后，所选文本才进入审校请求。当前不执行扫描 PDF OCR。

## 作者修改工作流

系统只有在以下条件满足时才允许自动应用 Agent 建议：

1. 原文和建议文本均存在；
2. 原文在审校基线中只有一个定位结果；
3. 建议不包含 `[Please provide ...]`；
4. 修改不跨多个自然段；
5. 修改范围不与已接受建议重叠。

```text
精确匹配
→ 忽略空白差异后的唯一匹配
→ 不唯一 / 缺失 / 冲突时转人工处理
```

作者修改台提供逐条应用、一键应用安全建议、工作稿预览、撤销、重做、恢复原稿和写回 PaperLens。

### 两类 Word 交付物

**重新生成的作者工作稿**

- DOCX 清洁稿；
- DOCX 原生插入/删除修订标记；
- Author Decision Appendix。

它适合继续编辑，但不会完整继承原文件中的全部页面格式和复杂对象。

**原始 DOCX 结构保留补丁（v1.3）**

- 导入 DOCX 时，原始 OOXML 压缩包保存在当前浏览器 IndexedDB；
- 所选审校文本通过 SHA-256 指纹与原文件绑定；
- 作者在修改台确认建议后，可以重新打开原始包；
- 仅修改 `word/document.xml` 中能够唯一定位的普通正文；
- 使用 Word 原生 `w:del` / `w:ins` 修订节点；
- 未被修改的样式、图片、表格、公式、页眉页脚、关系文件和其他包内条目继续保留；
- 下载的是新副本，浏览器中的原始文件不会被覆盖。

### 原文件补丁的安全跳过规则

以下内容不会自动写回：

- 表格单元格；
- Word 公式；
- 域、交叉引用和超链接；
- 批注、书签和脚注/尾注引用；
- 已经含有修订标记的段落；
- 图形、对象和复杂内联结构；
- 原文缺失、出现多次或与其他修改重叠的建议。

导出后会显示补丁报告，列出成功写回和被安全跳过的 Issue ID。

> v1.3 不是字节级无损复制。`word/document.xml` 和可用时的 `word/settings.xml` 会重新序列化，其余未修改的包内文件由 JSZip 保留并重新打包。

### 本地原文件边界

- 原始 DOCX 只保存在当前浏览器 IndexedDB；
- 最多保留最近 6 个原始文件；
- 不会自动同步到 Supabase；
- 换设备或清理浏览器数据后，需要重新导入原文件；
- v1.3 之前导入的 DOCX 需要重新导入才能建立绑定；
- 导入后若手动改变审校原文，文本指纹将不再匹配原文件。

## 科研安全规则

系统当前执行：

- 不新增来源和作者依据之外的新数值；
- 不虚构实验、样本、设备、标准和参考文献；
- 不把相关性擅自改成因果关系；
- 缺失方法信息使用 `[Please provide ...]`；
- 重大逻辑和方法风险不会因语言变流畅而消失；
- 用户锁定术语进入四个 Agent 和最终保护检查；
- 缺失、不唯一、跨段落或重叠的建议不会自动替换。

这些保护不能替代正式同行评议、统计审查、文献核验和作者责任。

## 账户与云端论文项目

账户入口只保留两种明确模式：

- **Supabase 云端账户**：真实邮箱注册、登录与按用户隔离的云端项目；
- **访客模式**：无需注册，草稿与历史只保存在当前浏览器。

未配置 Supabase 时，登录页会隐藏无效的邮箱表单，只显示访客入口。旧版“本地演示账户”已删除，避免把浏览器身份误解为真实注册账户。

Supabase 邮箱账户可以同步当前项目、迁移本机项目、跨浏览器恢复项目，并通过 Row Level Security 隔离数据：

```sql
auth.uid() = owner_id
```

首次登录不会自动上传本机论文。访客始终使用浏览器本地存储。原始 DOCX 二进制包不属于当前云端同步范围。

部署说明：[`docs/cloud-workspace.md`](docs/cloud-workspace.md) · [账户说明](docs/authentication.md)

## 技术架构

```text
Next.js 16 + React 19 + TypeScript
├─ Project Hub
├─ Browser Document Ingestion
│  ├─ Mammoth DOCX parser
│  └─ Mozilla PDF.js
├─ PaperLens Workspace
│  └─ 4 × qwen-plus through Model Studio
├─ Author Editing Engine
│  ├─ exact / whitespace anchors
│  ├─ overlap protection
│  └─ undo / redo
├─ DOCX Delivery
│  ├─ docx.js generated working document
│  └─ JSZip + OOXML original-package patcher
├─ Browser Original File Store
│  └─ IndexedDB + SHA-256 source binding
└─ Account & Cloud
   ├─ Supabase Auth + RLS
   └─ browser-local guest fallback
```

## 快速开始

环境要求：Node.js `>= 22.12`。

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
```

百炼环境变量：

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

可选 Supabase：

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

在 Supabase SQL Editor 运行：

```text
supabase/migrations/20260730_cloud_workspace.sql
```

```bash
npm run dev
npm run typecheck
npm run build
```

## 关键文件

```text
components/document-import-dock.tsx
components/author-editing-dock.tsx
components/original-docx-patch-dock.tsx
lib/document-ingestion.ts
lib/author-editing.ts
lib/docx-export.ts
lib/original-docx-store.ts
lib/original-docx-patcher.ts
lib/bailian.ts
app/api/review/route.ts
app/api/health/route.ts
```

## 当前边界与路线图

- 扫描 PDF 暂不支持 OCR；
- 云端项目保存最近 8 次任务，不是无限版本库；
- 原文件补丁只处理能够唯一定位的普通正文段落；
- 原始 DOCX 不能跨设备同步；
- 多 Agent 实时状态尚未使用 SSE；
- 后续将推进原文件段落映射增强、完整版本历史、协作审批、DOI 与跨章节一致性核验。

## License

Copyright © ScholarForge OS contributors. Reuse 前请检查仓库许可信息。
