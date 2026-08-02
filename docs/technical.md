# 技术与安全说明

## API

### `GET /api/health`

返回真实服务配置状态、模型名称和用户相关限制。响应禁止缓存。未配置时 `configured=false`，不声称存在演示能力。

### `POST /api/review`

请求：

```ts
type ReviewRequest = {
  taskId: string;
  projectName: string;
  taskType: 'translate' | 'polish' | 'precheck';
  sectionType: 'general' | 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion' | 'conclusion';
  targetJournal: string;
  text: string;
  terminologyLocks: Array<{ id: string; source: string; preferred: string; note?: string }>;
};
```

成功响应只包含用户需要的 `ReviewResult` 与 `requestId`。不包含 Agent 轨迹、评分、内部模式或调试数据。

常见错误：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_JSON`, `INVALID_BODY`, `INVALID_TASK`, `INVALID_SECTION` | 请求格式无效 |
| 413 | `REQUEST_TOO_LARGE` | 请求超过 80 KB |
| 422 | `SAFETY_CHECK_FAILED` | 模型输出未通过确定性检查 |
| 429 | `RATE_LIMITED`, `PROVIDER_RATE_LIMITED` | 本地或供应商限流，包含 `Retry-After` |
| 502 | `INVALID_MODEL_JSON`, `MODEL_OUTPUT_TRUNCATED`, `MODEL_ERROR` | 模型结果不可用 |
| 503 | `SERVICE_NOT_CONFIGURED` | 服务未配置，没有调用模型 |
| 504 | `MODEL_TIMEOUT` | 55 秒超时 |

所有 API 响应包含 `Cache-Control: no-store` 和 `X-Content-Type-Options: nosniff`。

## 请求保护

- 读取 `Content-Length` 并对实际 UTF-8 字节再次检查；
- 正文 40–12,000 字符；
- 最多 20 条术语锁；
- 每个客户端 10 分钟 6 次；
- 单 Node.js 实例最多 4 个并发模型请求；
- `REVIEW_DAILY_REQUEST_BUDGET` 可按 UTC 日启用请求数预算熔断；
- 模型请求 55 秒超时；
- 模型响应最大 100,000 字符，`finish_reason=length` 视为失败。

当前限流使用进程内 Map。它适合单实例基础保护，不是多实例公开部署的唯一防线。

## 确定性模型输出检查

1. JSON 对象、字段类型、长度和唯一 Issue ID。
2. 数值、科学计数法、百分数多重集与原文一致。
3. “数值 + 单位”多重集与原文一致。
4. 术语锁的 `source` 出现在原文时，指定 `preferred` 必须出现在建议稿。
5. 建议稿不能包含原文未提供的 DOI。
6. 建议稿不能包含常见待补占位符。
7. 每个 Issue 的 `safeToApply` 会由代码再次收紧：含义变化、作者待补、跨段落、空文本或非唯一精确锚点都会禁用。

## 安全应用

每次点击应用都会针对**当前作者工作稿**重新检查：Issue 尚未应用、服务端安全标记、原文/建议非空、文本不同、原文长度、单段落、无占位符、无含义变化、无需作者补充、精确或忽略空白后唯一匹配。任何失败都会返回具体原因。

作者决定与应用是分开的：接受建议不等于自动替换。应用成功会加入撤销栈并清空重做栈。

## 浏览器持久化与迁移

`scholarforge.workspace.v2` 是唯一当前键。自动保存延迟 500 ms，并显示保存、保存中或失败状态。失败不会清空内存状态。

旧版 v1 草稿只迁移能够安全解释的输入字段。旧结果、评分、Agent 轨迹和编辑不会迁移；旧键不会被删除，避免静默损坏。

JSON 备份限制 2 MB。导入顺序为：读取文本、JSON 解析、格式/版本验证、字段清洗、Issue 验证、根据当前 Issue 重建已应用修改、用户预览、确认替换、原子写入。失败时当前工作区不变。

## DOCX

浏览器使用 Mammoth 读取 `.docx`，文件上限 8 MB。它识别 Title/Heading 1–3 和常见论文章节，只允许用户选择一个不超过 12,000 字符的章节。公式、表格结构、图片、脚注、批注、修订痕迹和页面样式不会作为可编辑结构导入。

清洁 DOCX 是由 `docx` 新生成的作者工作稿副本，不声称保留原样式。

## 测试

- Vitest：请求校验、安全检查、锚点、应用、撤销/重做、备份、DOCX、API、限流、组件状态。
- Playwright：桌面与移动端核心流程、服务未配置、横向溢出、下载和历史恢复。
- ESLint：Next.js Core Web Vitals 与 TypeScript 规则，CI 不允许警告。
- TypeScript：`strict`、`noUnusedLocals`、`noUnusedParameters`。
