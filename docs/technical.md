# ScholarForge OS｜研语工坊 技术文档

## 1. 文档信息

- 技术版本：v0.2
- 架构形态：Next.js 全栈应用
- 部署平台：Vercel
- 模型平台：阿里云百炼 Model Studio
- 默认模型：`qwen-plus`
- 运行模式：四个独立 Agent 并行调用 + 本地确定性聚合

## 2. 技术目标

ScholarForge OS 的技术设计围绕以下目标展开：

1. 证明多 Agent 不是前端动画，而是真实独立调用。
2. 保持科研写作场景中的保守性和可解释性。
3. 避免模型自由生成最终分数和 Reviewer Decision。
4. 在 Vercel 60 秒函数限制内完成四个 Agent 的并行执行。
5. 即使没有 API Key，也能提供稳定演示。
6. 单个 Agent 失败时仍保留其他成功结果。

## 3. 系统架构

```text
Browser
  ├─ Review input
  ├─ Comparison / Issues / Terminology / Trace
  └─ Client-side TXT / Markdown / JSON export
        ↓
Next.js Route Handler: POST /api/review
  ├─ Input validation
  ├─ Demo/live routing
  ├─ Request ID
  └─ Error boundary
        ↓
Parallel Orchestration: Promise.all
  ├─ Terminology Guardian → Model Studio
  ├─ Academic Editor      → Model Studio
  ├─ Logic Auditor        → Model Studio
  └─ Method Auditor       → Model Studio
        ↓
Deterministic Aggregator
  ├─ Normalize JSON
  ├─ De-duplicate issues
  ├─ De-duplicate terminology
  ├─ Numeric-token guardrail
  ├─ Score calculation
  ├─ Reviewer Decision
  └─ Partial-failure isolation
        ↓
ReviewResult JSON
```

## 4. 仓库结构

```text
.
├── app/
│   ├── api/
│   │   ├── health/route.ts       # 健康检查
│   │   └── review/route.ts       # 审校入口
│   ├── globals.css               # 基础视觉系统
│   ├── v02.css                   # v0.2 多 Agent 与交付物样式
│   ├── layout.tsx                # Metadata 与全局样式
│   └── page.tsx                  # 三栏工作台
├── lib/
│   ├── bailian.ts                # 多 Agent 执行与聚合
│   ├── demo-review.ts            # 无 Key 演示结果
│   └── types.ts                  # 核心类型
├── public/
│   └── scholarforge-mark.svg     # 品牌标识
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

## 5. 技术栈

| 层级 | 技术 |
| --- | --- |
| Web 框架 | Next.js 16 App Router |
| UI | React 19、TypeScript、原生 CSS |
| 服务端接口 | Next.js Route Handlers |
| 模型调用 | 阿里云百炼 OpenAI 兼容接口 |
| 并行调度 | `Promise.all` |
| 数据结构 | TypeScript interfaces |
| 文件导出 | Browser `Blob` + Object URL |
| 部署 | Vercel |
| CI | GitHub Actions、Node.js 22 |

当前没有引入数据库、队列、状态管理库或 UI 组件库，以减少比赛阶段的依赖面和部署风险。

## 6. 环境变量

```env
DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

### 安全要求

- `DASHSCOPE_API_KEY` 只能在服务端读取。
- 禁止使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`。
- `.env.local` 必须被 `.gitignore` 忽略。
- 日志不得打印 Key。
- API 错误仅返回模型错误摘要，不返回请求头。

## 7. API 设计

### 7.1 `GET /api/health`

用途：验证部署、版本、工作流模式和 Key 是否存在。

示例：

```json
{
  "status": "ok",
  "service": "ScholarForge OS",
  "version": "0.2.0",
  "workflow": "parallel-multi-agent",
  "specialists": 4,
  "modelStudioConfigured": true,
  "timestamp": "2026-07-30T00:00:00.000Z"
}
```

注意：该接口只检查环境变量是否存在，不会实际调用模型。

### 7.2 `POST /api/review`

请求体：

```json
{
  "text": "Academic manuscript passage...",
  "targetJournal": "Construction and Building Materials"
}
```

输入限制：

- `text` 最少 40 字符
- `text` 最多 12,000 字符
- `targetJournal` 最多 160 字符

成功响应核心结构：

```json
{
  "mode": "live",
  "executionMode": "parallel-multi-agent",
  "workflowVersion": "0.2.0",
  "summary": "...",
  "revisedText": "...",
  "scoreBefore": 72,
  "scoreAfter": 78,
  "decision": "major_revision",
  "decisionReason": "...",
  "issues": [],
  "terminology": [],
  "agentRuns": [],
  "guardrails": [],
  "generatedAt": "...",
  "requestId": "..."
}
```

响应头：

```text
Cache-Control: no-store
X-ScholarForge-Workflow: 0.2.0
```

## 8. 多 Agent 执行模型

### 8.1 独立调用

`lib/bailian.ts` 为四个 Agent 定义四套独立 System Prompt：

- `terminology`
- `language`
- `logic`
- `method`

每个 Agent 都发起一次独立 `POST /chat/completions` 请求。

### 8.2 并行调度

```ts
const executions = await Promise.all(
  AGENT_IDS.map((agent) =>
    runSpecialist(agent, text, targetJournal, apiKey, baseUrl, model),
  ),
);
```

并行执行的目的：

- 避免四次调用耗时相加
- 保持不同专业角色互不污染
- 适配 Vercel 函数时间限制

### 8.3 Agent 局部失败

`runSpecialist` 不直接抛出错误终止整个工作流，而是返回：

```ts
{
  payload: emptyPayload,
  run: {
    agent,
    status: 'failed',
    durationMs,
    error,
  },
}
```

聚合器只使用成功 Agent 的结果。如果四个 Agent 全部失败，才抛出整体错误。

这种策略适合比赛演示和轻量生产：一个角色超时不会让用户完全失去结果。

## 9. Prompt 设计

### 9.1 共享硬规则

四个 Agent 共用以下规则：

- 不虚构实验、样本、数值、标准、参考文献或设备参数
- 保留原始数字、单位、材料名称和试件编号
- 缺失信息使用 `[Please provide ...]`
- 不新增 DOI 或参考文献
- 只返回 JSON

### 9.2 职责隔离

Terminology、Logic 和 Method Agent 不输出全文修改稿。

只有 Academic Editor 输出 `revisedText`，其职责被限定为保守语言修改。

这样可以减少多个 Agent 同时重写全文导致冲突的问题。

### 9.3 结构化输出

所有 Agent 输出：

```json
{
  "summary": "string",
  "revisedText": "string",
  "issues": [
    {
      "severity": "major | minor | suggestion",
      "location": "string",
      "original": "string",
      "revised": "string",
      "reason": "string",
      "category": "string",
      "meaningChanged": false
    }
  ],
  "terminology": []
}
```

服务端会再次规范化字段，避免模型返回缺失字段导致前端崩溃。

## 10. 聚合与去重

### 10.1 问题去重键

```text
agent | location | category | original
```

使用小写字符串构建 Set，避免同一 Agent 重复返回相同问题。

### 10.2 术语去重键

使用 `preferred.toLowerCase()`。

### 10.3 数量上限

- 单 Agent 最多保留 16 条问题
- 最终最多保留 40 条问题
- 最终最多保留 16 条术语规则

防止模型输出异常膨胀。

## 11. 评分系统

### 11.1 为什么不让模型打分

模型评分存在明显漂移，同样的问题可能给出不同分数，Decision 也可能与分数冲突。因此 ScholarForge OS 只采信模型识别的问题，不采信模型分数。

### 11.2 修改前惩罚

示意规则：

```text
Suggestion = 1
Minor Language / Terminology = 3
Minor Logic / Method = 4
Major Language / Terminology = 7
Major Logic / Method = 10
```

```text
scoreBefore = 100 - sum(penalty)
```

分数会限制在 0—100。

### 11.3 修改后惩罚

语言和术语问题被认为可以由保守修改部分处理，因此惩罚降低。

Logic 与 Method 往往依赖作者、数据或实验信息，因此仍保留较高惩罚。

### 11.4 Decision

```text
if scoreAfter < 80 OR unresolvedMajorLogicMethod >= 2:
    Major Revision
else if scoreAfter < 92 OR anyMajorIssue:
    Minor Revision
else:
    Ready for Submission
```

Decision 原因由代码模板生成，而不是模型自由撰写。

## 12. 科学保护规则

### 12.1 新增数字检测

```ts
function numericTokens(value: string): Set<string>
```

服务端提取原文和修改稿中的数字 token。如果修改稿出现原文没有的数字：

```text
revisedText = sourceText
```

这是保守回退，不代表完整事实核验。

### 12.2 意义改变

只要任意问题返回 `meaningChanged=true`，保护规则即标记为失败。

### 12.3 方法缺失占位符

重大 Method 问题应使用：

```text
[Please provide ...]
```

服务端会检查这一格式并显示保护状态。

## 13. 前端状态模型

### 13.1 请求前

- Agent：等待
- 下载按钮：禁用
- 评分：空

### 13.2 请求中

- 四个 Agent 同时显示“并行运行”
- 显示等待时间
- 进度条为体验进度，不代表单个模型 token 进度

### 13.3 请求完成

- Agent 显示真实耗时
- 失败 Agent 显示失败状态
- 结果切换到四个 Tab
- 下载按钮启用

## 14. 文件导出

当前导出在浏览器端完成，不调用服务端文件系统。

```ts
const blob = new Blob([content], { type });
const url = URL.createObjectURL(blob);
```

优点：

- 无需对象存储
- 不保存用户论文
- 不增加后端复杂度

当前格式：

- TXT
- Markdown
- JSON

后续 DOCX/PDF 需要服务端文档生成或专用导出服务。

## 15. 错误处理

### 15.1 输入错误

返回 400。

### 15.2 模型或配额错误

返回 502，并携带 `requestId`。

生产环境不返回完整内部错误；开发环境可返回 `detail`。

### 15.3 超时

每个 Agent 使用独立 `AbortController`，超时约 46 秒。

### 15.4 全部 Agent 失败

抛出整体错误，提示检查：

- API Key
- Base URL
- Model
- Quota
- Vercel Logs

## 16. 本地开发

```bash
git clone git@github.com:liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
copy .env.example .env.local
npm run dev
```

打开：

```text
http://localhost:3000
http://localhost:3000/api/health
```

## 17. Vercel 部署

1. 导入 GitHub 仓库。
2. Framework 选择 Next.js。
3. Root Directory 保持 `./`。
4. 添加三个环境变量。
5. Deploy。
6. 打开 `/api/health` 检查 `modelStudioConfigured`。
7. 在首页执行一次真实审校。

## 18. CI

GitHub Actions 使用 Node.js 22：

```text
npm install
npm run typecheck
npm run build
```

所有功能分支必须在合并前通过类型检查和生产构建。

## 19. 当前技术边界

- 没有数据库和用户系统
- 没有任务队列
- 没有 SSE/WebSocket
- 没有断点恢复
- 没有模型调用成本统计
- 没有对象存储
- 没有 PDF/DOCX 解析
- 没有全文分块与跨章节记忆
- 数值 guardrail 只做 token 对比，不是完整事实验证
- Promise.all 仍受单次 Vercel 函数生命周期限制

## 20. 未来架构

当支持全文论文和长期项目后，建议升级为：

```text
Next.js Client
    ↓
FastAPI / Node Platform API
    ↓
PostgreSQL + Redis Queue
    ↓
Workflow Worker Pool
    ├─ Parser Agent
    ├─ Terminology Agent
    ├─ Language Agent
    ├─ Logic Agent
    ├─ Method Agent
    ├─ Reviewer Agent
    └─ Revision Agent
    ↓
OSS / S3 Artifacts
    ↓
SSE realtime events
```

核心对象建议：

- users
- projects
- manuscript_versions
- sections
- terminology_rules
- review_runs
- agent_runs
- issues
- accepted_revisions
- artifacts

## 21. 测试重点

### 单元测试

- severity normalization
- issue de-duplication
- terminology de-duplication
- score calculation
- decision thresholds
- new numeric token detection
- partial agent failure

### 集成测试

- 无 Key 进入 demo
- 有 Key 执行四次请求
- 单 Agent 失败仍返回结果
- 四 Agent 全失败返回 502
- 12,000 字符边界

### UI 测试

- 移动端 Tab 横向布局
- 下载按钮状态
- 长错误文本换行
- 运行轨迹卡片
- 评分与 Decision 一致
