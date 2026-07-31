# ScholarForge OS · 研语工坊

[简体中文](README.md) · [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS" width="420" />
</p>

<p align="center"><strong>围绕论文、证据与作者决策构建的科研英语工作台</strong></p>

ScholarForge OS 面向科研论文翻译、保守润色、投稿前预检和审稿回复。它不会把模型建议直接写进正文，而是把每条问题整理为可定位、可解释、可接受或拒绝的证据项，再由作者决定哪些修改进入工作稿。

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a> ·
  <a href="docs/ARCHITECTURE.md">系统架构</a>
</p>

## 核心工作流

```text
导入 DOCX / 文本型 PDF / 粘贴文本
→ 选择科研英语任务与论文章节
→ 四个专业 Agent 并行审阅
→ 统一为结构化证据项
→ 作者接受、拒绝或保留待定
→ 安全定位后写入工作稿
→ 导出 TXT / Markdown / JSON / DOCX
```

| 工作流 | 主要用途 | 边界 |
| --- | --- | --- |
| 科研中译英 | 把中文科研段落转为学术英文 | 保留术语、数值与证据强度 |
| 英文保守润色 | 改善语法、搭配和学术语气 | 不新增实验事实，不扩大结论 |
| 投稿前预检 | 检查术语、语言、逻辑和方法报告 | 结果是辅助判断，不替代同行评议 |
| 审稿回复助手 | 基于作者依据起草正式回复 | 缺失依据与位置会保留为作者待补项 |

## Evidence Desk

新版界面采用研究项目中心与三栏证据工作台：

- **结构与问题队列**：任务配置、章节、术语锁、风险和待决策问题。
- **文稿画布**：原文、建议稿、作者工作稿与差异视图。
- **证据检查器**：问题来源、风险、原文定位、建议、理由和作者决策。
- **上下文决策栏**：逐条导航、完成进度以及受限的低风险批量应用。

四个 Agent 是证据来源，而不是界面的主角。产品的主线始终是“论文—证据—作者决定”。

## 作者决策与安全应用

每条建议使用兼容的持久化状态：

- `pending`：待处理
- `accepted`：接受
- `deferred`：保留待定
- `dismissed`：拒绝

自动写入正文必须满足唯一定位、建议文本完整、无跨段落、无重叠冲突等条件。术语、数值、引用、结论、重大问题、逻辑/方法问题和可能改变科学含义的建议不能批量应用。

作者工作稿支持撤销和重做。无法安全定位的建议会保留为人工任务，不会强行替换。

## 文档导入与导出

浏览器端支持：

- DOCX 文本与语义标题解析；
- 可复制文字的 PDF 提取；
- Abstract、Introduction、Methods、Results、Discussion、Conclusion 识别；
- 导入前章节预览与范围选择；
- 超长章节按段落拆分到当前 12,000 字符任务上限。

当前不支持扫描型 PDF OCR，也不承诺还原 DOCX 的完整页面排版、公式、复杂表格或浮动对象。

可导出：

- 建议文本 TXT；
- 含证据与作者决定的 Markdown 报告；
- 完整结构化 JSON；
- 可继续编辑的清洁 DOCX；
- 对已安全应用修改生成的修订痕迹 DOCX。

## 数据与隐私

当前版本采用明确的本地优先模式：

- 草稿和最近 8 条任务历史保存在当前浏览器 `localStorage`；
- 支持版本化 JSON 备份与恢复；
- 原始 DOCX/PDF 不会自动上传；
- 只有作者主动运行任务时，选中的文本才发送到服务端工作流；
- 百炼 API Key 仅从服务端环境变量读取。

浏览器数据可能因清理缓存、隐私模式或换设备而丢失，请在重要节点导出备份。

## 技术架构

- Next.js 16、React 19、TypeScript 5.8
- Alibaba Cloud Model Studio OpenAI-compatible API
- 四个独立 Agent 并行请求与确定性聚合
- Mammoth DOCX parsing、Mozilla PDF.js
- docx.js 作者工作稿与修订痕迹导出
- Vitest 核心契约与安全应用测试
- GitHub Actions：依赖审计、测试、类型检查和生产构建

详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 本地运行

需要 Node.js `>= 22.12.0`。

```bash
git clone https://github.com/liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
cp .env.example .env.local
npm run dev
```

实时模型环境变量：

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

未配置 API Key 时，应用使用明确标记的安全演示结果。

## 验证

```bash
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

## 当前限制

- 单次主输入最多 12,000 字符；
- 扫描型 PDF 暂不支持 OCR；
- 复杂 DOCX/PDF 版式可能影响文本顺序；
- 浏览器本地项目不跨设备自动同步；
- Agent 结果仍需作者核查科研事实、统计、引用和期刊要求；
- 准备度分数属于产品内辅助指标，不代表期刊决定。

## License

Copyright © ScholarForge OS contributors. 未声明开源许可证前，不授予默认复制、修改或再分发权利。
