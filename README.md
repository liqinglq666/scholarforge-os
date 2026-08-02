# ScholarForge OS

[简体中文](README.md) · [English](README.en.md)

**作者控制的科研英语检查与修改工作台。**

ScholarForge OS 面向需要处理中英文科研段落的研究生、科研人员和学术编辑。它不是论文生成器，也不替代作者判断：AI 生成可解释的建议，作者逐条接受、拒绝或暂缓；只有能够在当前工作稿中唯一定位且不改变科学含义的单条建议才能安全应用。

## 产品范围

只保留三个核心任务：

| 任务 | 解决的问题 | 明确边界 |
| --- | --- | --- |
| 科研中译英 | 生成可核对的学术英文 | 保护数值、单位、术语和证据强度 |
| 英文保守润色 | 改善语法、句法、搭配、简洁性和连贯性 | 不新增事实、引用、实验或更强结论 |
| 投稿前检查 | 识别语言、术语、逻辑、方法报告和证据边界问题 | 不评分、不预测录用、不声称完成同行评议 |

不支持 PDF、OCR、审稿回复自动生成、账户、云同步、团队协作、原始 DOCX OOXML 补丁、Word 修订痕迹、不可靠评分或批量应用全部建议。

## 核心流程

1. 在欢迎页理解产品能力，或从材料、生命医学、计算机、社会科学、环境和教育等示例开始体验。
2. 粘贴文本，或在浏览器中提取 DOCX 正文并选择章节。
3. 选择任务与章节，可添加目标期刊语境和术语锁。
4. 在发送前确认具体文本和设置；原始 DOCX 文件不会上传。
5. 查看原文、AI 建议稿、作者工作稿和问题列表。
6. 对每条问题做作者决定；安全应用前重新检查当前锚点。
7. 撤销、重做或单独撤回已应用修改，导出 TXT、Markdown 报告、清洁 DOCX 或工作区备份。
8. 从唯一的最近任务页恢复本地历史。

示例只会填入本地草稿，不会自动发送给模型。已有草稿在载入示例前会得到明确提示。

## 科研安全边界

模型输出之后，代码会检查：

- 数值、科学计数法和百分数是否变化；
- 带单位数值是否变化；
- 术语锁是否满足；
- 是否新增原文未提供的 DOI；
- 输出是否为空、过长、截断或非 JSON；
- 是否包含危险占位符、重复 Issue ID 或过长字段；
- 每条修改是否唯一定位、是否跨段落、是否需要作者信息、是否可能改变科学含义。

安全检查通过不等于科学正确。作者仍须核对事实、引用、统计结果、实验参数、样本数量、因果关系、方法、结论强度和期刊最新要求。

未配置模型服务时，健康接口明确返回未配置状态，工作台禁用分析，`POST /api/review` 返回 `503`，不会生成或保存模拟结果。

## 数据与恢复

- 草稿、分析结果、作者决定、工作稿和最近 12 条历史保存在当前浏览器 `localStorage`。
- DOCX 在浏览器中解析；原始二进制文件不会上传或保存。
- 只有作者确认后，所选正文、任务配置、目标期刊文本和术语锁才会发送给服务端与模型。
- 自动保存失败时页面会明确提示，当前内存内容不会被清空。
- 备份导入有大小、格式和版本验证。备份中的编辑偏移与替换文本不受信任；系统只按当前 Issue ID 重新定位并重建安全修改。

更多说明见 [产品说明](docs/product.md)、[研究生产品路线图](docs/GRADUATE_STUDENT_ROADMAP.md)、[架构](docs/ARCHITECTURE.md)、[技术与安全](docs/technical.md)、[隐私说明](docs/PRIVACY.md) 和 [部署说明](docs/DEPLOYMENT.md)。

## 技术架构

```text
Next.js 16 App Router + React 19 + TypeScript
├─ 欢迎页 / 跨学科示例 / 工作台 / 最近任务 / 数据与设置
├─ 浏览器 DOCX 正文提取（Mammoth）
├─ POST /api/review
│  ├─ 请求验证、大小限制、限流、并发、超时、预算熔断
│  ├─ 阿里云百炼兼容 Chat Completions 接口
│  └─ 确定性模型输出验证
├─ 问题级作者决定与安全锚点
├─ 统一版本化本地工作区与非破坏性旧草稿迁移
└─ TXT / Markdown / clean DOCX / JSON backup
```

## 本地运行

要求 Node.js `>= 22.12.0`。

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm ci
cp .env.example .env.local
npm run dev
```

模型环境变量：

```env
DASHSCOPE_API_KEY=your_server_side_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
REVIEW_DAILY_REQUEST_BUDGET=0
```

`DASHSCOPE_API_KEY` 只在服务端读取。`REVIEW_DAILY_REQUEST_BUDGET=0` 表示不启用每日请求数熔断；生产环境应设置与预算匹配的正整数。

## 验证

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run lint
npm run test
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

单元与组件测试覆盖请求验证、跨学科示例、确定性安全检查、安全应用、单条撤回、撤销/重做、工作区恢复、篡改备份、DOCX 边界、服务未配置和 API 限流。Playwright 覆盖完整核心流程与移动端布局。

## 部署

项目可部署到支持 Next.js 16 Node.js runtime 的平台。至少配置 `DASHSCOPE_API_KEY`，并根据部署规模设置请求预算。内存限流是单实例保护；多实例公开部署应替换为共享限流存储，并配置平台级 WAF、日志告警与费用上限。

详细发布清单见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 当前限制

- 本地工作区不会跨设备同步，清理浏览器数据会丢失未导出的内容。
- DOCX 只提取可用正文；公式、表格结构、脚注、批注、修订痕迹和页面样式需要作者回到原文核对。
- 清洁 DOCX 是新生成的编辑副本，不保留原始排版。
- 当前限流器为单 Node.js 实例内存实现，不适合作为多实例部署的唯一滥用防护。
- 模型结果可能不完整或错误；系统不验证参考文献真实性、统计正确性或期刊要求。

## 许可与责任

仓库当前未包含独立开源许可证文件。公开分发或第三方使用前，应由仓库所有者补充明确许可证。ScholarForge OS 的输出仅供作者辅助核对，不构成投稿、发表、统计、伦理或法律保证。
