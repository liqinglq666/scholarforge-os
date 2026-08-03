# ScholarForge OS v3 架构

## 架构目标

系统优先保证作者控制、科研事实边界、数据完整、可恢复、可测试和真实能力披露。页面组织体验；业务规则由 `lib/` 中的纯函数和服务端适配器承担。

```text
Browser
├─ public evaluator routes: /try /trust /guide
├─ quick review and multi-project workspace
├─ browser DOCX body extraction
├─ local manuscript, feedback, version and history state
├─ issue decision + one-edit application + undo/redo
└─ TXT / Markdown / clean DOCX / JSON backup
         │ explicit author confirmation
         ▼
POST /api/review
├─ byte-size and schema validation
├─ session + IP rate limit, concurrency and budget fuse
├─ provider request with timeout
├─ strict structured-output normalization
├─ ScholarForge Safety Gate
│  ├─ numbers and value-unit pairs
│  ├─ citations, DOI, terminology and experiment claims
│  └─ causality, certainty and research scope
└─ code-derived local-application permission
         │
         ▼
Alibaba Cloud Model Studio compatible endpoint

Optional Supabase Auth
└─ validated personalization preferences only
```

## 目录与职责

| 目录 | 职责 |
| --- | --- |
| `app/` | App Router 页面、公开评审入口、布局、错误边界和 Route Handlers |
| `components/app-shell/` | 全站导航和页脚 |
| `components/task-setup/` | 新建任务、DOCX 选择、术语锁和分析前确认 |
| `components/review/` | 安全门、三版本正文、问题处理、作者决定和导出 |
| `components/projects/` | 多项目、章节、跨章节一致性、意见和版本流程 |
| `components/settings/` | 服务状态、隐私、备份、清除和限制 |
| `components/workspace/` | 客户端工作区所有权、迁移和自动保存 |
| `lib/review/` | Prompt、模型适配、请求/输出验证和安全门 |
| `lib/editing/` | 当前锚点分析、单条应用、重叠检测、撤销和重做 |
| `lib/workspace/` | 版本化 schema、旧数据迁移、存储和备份恢复 |
| `lib/projects/` | 项目、章节、一致性、意见和版本业务逻辑 |
| `lib/documents/` | DOCX 文件边界与章节提取 |
| `lib/exports/` | TXT、Markdown、clean DOCX、JSON backup |
| `lib/security/` | 会话/IP限流、并发和预算熔断 |
| `lib/auth/` | Supabase Auth、Cookie 和偏好同步边界 |
| `tests/`, `e2e/` | 单元、API、组件和桌面/移动浏览器测试 |

## 服务端与客户端边界

- 页面默认使用 Server Components；需要浏览器存储、文件、下载和交互的模块显式标记为 Client Components。
- API Key 只由 Node.js Route Handler 和模型适配器读取。
- 客户端不接收 API Key、供应商原始响应或内部模型遥测。
- 健康接口只公开配置状态、模型名称和用户相关限制。
- DOCX 原始二进制只在浏览器解析，不发送到服务端。
- Supabase 会话使用安全 Cookie；云端接口只接受经过校验的偏好结构。

## 安全门状态

`SafetyGateReport` 明确区分：

- `passed`：候选稿通过当前代码规则，仍须作者核对；
- `quarantined`：至少一项硬规则失败，候选稿与作者稿隔离；
- 历史无报告结果：标记为旧版结果，建议重新分析。

隔离不是一次普通 API 失败。API 返回结构化结果，页面展示阻断证据，作者工作稿保持原文，所有局部自动应用权限关闭。

## 工作区状态

`WorkspaceState` 区分：

- `draft.sourceText`：分析时的不可变原文；
- `currentResult.suggestedText`：完整 AI 候选稿；
- `currentResult.safetyGate`：代码安全门报告；
- `workingText`：作者工作稿；
- `decisions`：每条问题的作者决定；
- `appliedEdits`：已安全应用的单条修改；
- `undoStack` / `redoStack`：可恢复编辑帧；
- `status`：草稿、分析中、审校或错误。

作者接受一条建议不等于替换文本。应用时会针对当前工作稿重新定位并执行安全检查。

## 数据分层

- 快速审校和论文项目正文：浏览器本地；
- 导师意见、版本全文和分析历史：浏览器本地；
- 可选云端同步：个性化偏好；
- 模型请求：用户明确选择并确认的当前文本和设置；
- 服务端密钥：仅服务器环境变量。

## 非破坏性恢复

备份导入不信任存储的编辑偏移和替换结果。系统只读取已应用 Issue ID，再从当前原文与当前 Issue 重新执行唯一定位。失败、重复、跨段落、含义变化或作者待补修改会被丢弃，导入失败时当前工作区不变。

## 可扩展点

- 多实例公开部署：把内存限流替换为共享原子存储；
- 新模型供应商：保持 `ReviewRequest`、`ReviewResult` 和安全门契约，增加服务端适配器；
- 更强 DOCX：作为独立可验证模块，不直接承诺原包无损补丁；
- 论文全文云同步：只有在加密、权限、迁移、删除、审计和恢复模型完整后再评估。
