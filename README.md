# ScholarForge OS · 研语工坊

[简体中文](README.md) · [English](README.en.md)

<p align="center">
  <img src="public/scholarforge-lockup.svg" alt="ScholarForge OS" width="420" />
</p>

<p align="center"><strong>把科研英语建议变成可核对、可决定、可导出的作者工作流</strong></p>

ScholarForge OS 聚焦三个稳定场景：科研中译英、英文保守润色和投稿前预检。系统不会自动覆盖原文。每条建议都需要作者查看、决定，并在安全定位后才能应用到工作稿。

<p align="center">
  <a href="https://scholarforge-os.vercel.app">在线体验</a> ·
  <a href="https://scholarforge-os.vercel.app/api/health">健康检查</a> ·
  <a href="docs/ARCHITECTURE.md">系统架构</a>
</p>

## 产品主线

```text
导入 DOCX 或粘贴文本
→ 选择翻译、润色或投稿前预检
→ 内部专业检查与结果聚合
→ 作者逐条接受、拒绝或保留
→ 安全应用到工作稿
→ 导出 TXT、Markdown 报告或清洁 DOCX
```

| 工作流 | 主要用途 | 明确边界 |
| --- | --- | --- |
| 科研中译英 | 把中文科研段落转为学术英文 | 保留术语、数值和证据强度 |
| 英文保守润色 | 改善语法、搭配和学术语气 | 不新增事实，不主动扩大结论 |
| 投稿前预检 | 检查术语、语言、逻辑和方法报告 | 辅助作者检查，不替代同行评议 |

## 作者控制与安全边界

每条建议保持四种状态：待处理、接受、保留待定和拒绝。建议只有在原文定位唯一、内容完整、没有跨段落和重叠冲突时，才能由作者手动应用到工作稿。

当前版本不提供批量自动应用。术语、数值、引用、结论、逻辑、方法和可能改变科学含义的问题必须逐条核对。工作稿支持撤销和重做；无法安全定位的建议只作为参考，不会强行写入。

完整建议稿还会进行数值一致性检查。检测到数值增加、删除或变化时，系统保留原文，并生成需要作者核对的安全提示。

## 文档与导出

浏览器端支持：

- DOCX 文本与语义标题解析；
- Abstract、Introduction、Methods、Results、Discussion、Conclusion 识别；
- 导入前章节预览与范围选择；
- 超长章节按段落拆分到单次 12,000 字符上限；
- 直接粘贴文本。

当前不解析 PDF，也不提供 OCR。PDF 内容请先复制需要处理的段落，再粘贴到工作台。复杂公式、表格、浮动对象和原始 Word 页面排版不会被还原。

可导出：

- 建议文本 TXT；
- 含证据与作者决定的 Markdown 报告；
- 基于作者已应用建议生成的清洁 DOCX。

当前不生成 Word 原生修订痕迹，也不导出面向开发者的结构化结果文件，避免把不完整的格式保真能力误认为正式交付能力。

## 服务与数据

- 草稿和最近 8 条任务历史保存在当前浏览器 `localStorage`；
- 可导出和恢复完整工作区备份；
- 恢复历史或备份时会校验任务字段、作者决定与已应用修改；无效、越界或重叠修改不会进入工作稿或 DOCX；
- 原始 DOCX 不会自动上传；
- 只有作者主动运行任务时，当前文本才发送到服务端；
- 百炼 API Key 仅从服务端环境变量读取。

未配置 `DASHSCOPE_API_KEY` 时，本地编辑、保存、历史和导出仍可使用，但分析请求会明确返回“服务未配置”。系统不会生成固定示例或模拟审阅结果，也不会把占位结果保存进任务历史。

浏览器数据可能因清理缓存、隐私模式或换设备而丢失，重要节点请主动备份。

## 技术架构

- Next.js 16、React 19、TypeScript 5.8
- Alibaba Cloud Model Studio OpenAI-compatible API
- 内部术语、语言、逻辑和方法检查
- Mammoth DOCX parsing
- docx.js 清洁作者工作稿导出
- Vitest 核心契约与安全应用测试
- GitHub Actions 依赖审计、测试、类型检查和生产构建

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

```env
DASHSCOPE_API_KEY=your_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

## 验证

```bash
npm audit --omit=dev --audit-level=high
npm run test
npm run typecheck
npm run build
```

## 当前限制

- 单次主输入最多 12,000 字符；
- 只支持 DOCX 导入和文本粘贴；
- 不支持 PDF、OCR、审稿回复、团队协作和跨设备同步；
- 不提供批量自动应用、原生修订痕迹或原文件格式保真；
- 不提供无模型服务时的模拟分析；
- 所有结果仍需作者核查科研事实、统计、引用和期刊要求。

## License

Copyright © ScholarForge OS contributors. 未声明开源许可证前，不授予默认复制、修改或再分发权利。
