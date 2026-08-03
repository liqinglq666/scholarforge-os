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

成功响应包含用户需要的 `ReviewResult` 与 `requestId`。`ReviewResult` 中包含 `SafetyGateReport`，但不包含 Agent 轨迹、内部评分或供应商调试数据。

当模型候选违反科研事实硬规则时，接口仍返回 `200` 和 `status=quarantined` 的结构化结果。原文与作者工作稿保持不变，前端展示阻断证据。隔离不是“分析成功且可直接使用”，也不是需要隐藏的普通错误。

常见错误：

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `INVALID_JSON`, `INVALID_BODY`, `INVALID_TASK`, `INVALID_SECTION` | 请求格式无效 |
| 413 | `REQUEST_TOO_LARGE` | 请求超过 80 KB |
| 429 | `RATE_LIMITED`, `PROVIDER_RATE_LIMITED` | 本地或供应商限流，包含 `Retry-After` |
| 502 | `INVALID_MODEL_JSON`, `MODEL_OUTPUT_TRUNCATED`, `MODEL_ERROR` | 模型结果不可用 |
| 503 | `SERVICE_NOT_CONFIGURED` | 服务未配置，没有调用模型 |
| 504 | `MODEL_TIMEOUT` | 模型请求超时 |

所有 API 响应包含禁止缓存和内容类型保护头。全站还配置 frame、referrer 和 permissions 安全策略。

## 请求保护

- 读取 `Content-Length` 并对实际 UTF-8 字节再次检查；
- 正文 40–12,000 字符；
- 最多 20 条术语锁；
- 每个浏览器会话 10 分钟最多 8 次；
- 每个出口 IP 10 分钟最多 40 次，降低共享评审网络误伤；
- 单 Node.js 实例最多 6 个并发模型请求；
- `REVIEW_DAILY_REQUEST_BUDGET` 可按 UTC 日启用请求数预算熔断；
- 模型请求有明确超时；
- 模型响应限制长度，`finish_reason=length` 视为失败。

会话标识只用于基础限流，不是身份认证。IP和会话双层限制用于成本与滥用保护。当前计数器为进程内 Map，多实例部署应替换为共享原子存储并配合平台 WAF。

## 科研事实安全门

完整候选稿检查：

1. JSON 对象、字段类型、长度和唯一 Issue ID；
2. 数值、科学计数法、百分数和样本量多重集；
3. “数值 + 单位”多重集；
4. 作者—年份引用和 DOI；
5. 作者术语规则；
6. 原文未提供的新实验或方法执行声明；
7. TODO、待补引用和危险占位符；
8. 相关/预测关系是否升级为因果；
9. 审慎结论是否升级为确定性结论；
10. 有限样本或特定场景是否扩大为普遍结论。

规则可能漏报或误报，因此 `passed` 不等于科学正确。

## 局部安全应用

模型返回的 `safeToApply` 不被信任。代码根据当前 Issue 和当前作者工作稿重新计算权限。

每次应用都会检查：

- 安全门未隔离完整候选稿；
- Issue 尚未应用；
- 原文和建议非空且不同；
- 修改不跨段落；
- 不改变数值、单位、引用、实验声明和科研主张边界；
- 不包含占位符或作者待补内容；
- 原文在当前工作稿中精确或空白归一化后唯一匹配；
- 不与已经应用的修改重叠。

作者决定与应用分开：接受不等于替换。应用成功加入撤销栈并清空重做栈。

## 浏览器持久化与迁移

快速审校和论文项目使用版本化浏览器存储。自动保存显示保存、保存中或失败状态；失败不会清空内存数据。

JSON 备份限制大小并验证格式、版本和字段。导入时不信任存储的编辑偏移和工作稿，而是从当前原文与 Issue 重建已应用修改。失败时当前数据不变。

## 账户与偏好

可选 Supabase Auth 使用服务端会话 Cookie。账户功能只同步经过验证的个性化偏好，不自动上传论文正文、导师意见、版本全文或分析历史。未配置 Supabase 时应用明确回退为游客本地模式。

## DOCX

浏览器使用 Mammoth 读取 `.docx`，文件上限 8 MB。它识别常见标题和论文章节，只允许用户选择一个不超过 12,000 字符的章节。公式、表格结构、图片、脚注、批注、修订痕迹和页面样式不会作为可编辑结构导入。

清洁 DOCX 由 `docx` 新生成，不声称保留源文件全部样式。

## 测试

- Vitest：请求校验、安全门、模型异常、锚点、应用、撤销/重做、备份、DOCX、账户和项目逻辑；
- Playwright：桌面与移动端公开入口、核心流程、服务未配置、下载、历史恢复和横向溢出；
- ESLint：Next.js Core Web Vitals 与 TypeScript 规则，CI 不允许警告；
- TypeScript：严格模式、未使用变量和未使用参数检查；
- Next.js production build：验证全部静态和动态路由可构建。
