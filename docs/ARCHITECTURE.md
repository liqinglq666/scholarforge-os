# ScholarForge OS v2 架构

## 架构目标

系统优先保证用户控制、数据完整、可恢复、可测试和真实能力边界。页面组件只组织体验；业务规则由 `lib/` 中的纯函数和适配器承担。

```text
Browser
├─ Welcome / Workspace / History / Settings
├─ DOCX text extraction
├─ versioned local workspace
├─ issue decision + one-edit application
└─ TXT / Markdown / clean DOCX / JSON backup
         │ author confirmation
         ▼
POST /api/review
├─ body size + schema validation
├─ per-client rate limit + concurrency + budget circuit breaker
├─ provider request with timeout
├─ strict JSON normalization
└─ deterministic scientific-safety checks
         │
         ▼
Alibaba Cloud Model Studio compatible endpoint
```

## 目录与职责

| 目录 | 职责 |
| --- | --- |
| `app/` | App Router 页面、布局、错误边界和 Route Handlers |
| `components/app-shell/` | 全站导航和页脚 |
| `components/task-setup/` | 新建任务、DOCX 选择、术语锁和分析前确认 |
| `components/review/` | 三版本正文、问题处理、作者决定和导出 |
| `components/history/` | 唯一历史入口与安全恢复 |
| `components/settings/` | 服务状态、隐私、备份、清除和限制 |
| `components/workspace/` | 统一客户端工作区所有权与自动保存 |
| `lib/review/` | Prompt、模型适配、请求与输出验证 |
| `lib/editing/` | 当前锚点分析、单条应用、撤销和重做 |
| `lib/workspace/` | v2 schema、旧草稿迁移、存储和备份恢复 |
| `lib/documents/` | DOCX 文件边界与章节提取 |
| `lib/exports/` | TXT、Markdown、clean DOCX、JSON backup |
| `lib/security/` | 限流、并发和预算熔断 |
| `tests/`, `e2e/` | 单元、API、组件与浏览器流程测试 |

## 服务端与客户端边界

- `app/page.tsx` 等页面默认是 Server Components。
- 浏览器存储、文件解析、下载、对话框与交互位于显式 Client Components。
- API Key 只由 Node.js Route Handler 和模型适配器读取。
- 客户端永远不接收 API Key、模型内部遥测或供应商原始响应。
- 健康接口只公开配置状态、模型名称和用户需要理解的限制。

## 工作区状态

`WorkspaceState` 明确区分：

- `draft.sourceText`：分析时的原文；
- `currentResult.suggestedText`：完整 AI 建议稿；
- `workingText`：作者工作稿；
- `decisions`：每条问题的作者决定；
- `appliedEdits`：已安全应用的单条修改；
- `undoStack` / `redoStack`：可恢复编辑帧；
- `status`：草稿、分析中、审校或错误。

只有 `components/workspace/use-workspace.ts` 负责恢复、延迟保存和保存状态。其他组件通过显式回调更新状态，不直接操作 `localStorage`。

## 非破坏性恢复

v2 使用单一版本化键。首次运行会检查旧版草稿与历史键，尽量迁移项目名、任务、章节、正文、目标期刊和术语锁。无法证明安全的旧结果和编辑不会迁移，也不会删除旧键。

备份导入不信任 `start`、`end`、`original`、`revised` 或 `workingText`。它只读取已应用的 Issue ID，然后从当前原文与当前 Issue 重新执行唯一精确定位。失败、重复、跨段落、含义变化或作者待补修改会丢弃。

## 可扩展点

- 公开多实例部署：将 `lib/security/rate-limit.ts` 替换为共享原子存储。
- 新模型供应商：保持 `ReviewRequest` 与 `ReviewResult` 不变，增加服务端适配器。
- 更强 DOCX：应作为独立、可验证的导入模块，不应扩展到不可靠的原包补丁。
- 云同步：只有在端到端加密、权限、迁移、删除和恢复模型完整后才应重新评估。
