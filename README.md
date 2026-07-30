# ScholarForge OS｜研语工坊

面向科研人员的多智能体学术英语审校与投稿工作台。

## 当前版本

首版 MVP 已实现：

- 科研英文输入与内置示例论文
- 术语、语言、逻辑、方法四类 Agent 审校
- 原文与修改稿双栏对照
- 问题位置、严重程度、修改理由与建议
- 论文级术语规则
- 模拟审稿评分与投稿准备度
- 阿里云百炼服务端调用
- 未配置 API Key 时的完整安全演示模式
- 响应式桌面端与移动端界面
- Vercel 部署结构
- GitHub Actions 类型检查和生产构建

## 技术结构

```text
Next.js 16 + React 19 + TypeScript
        ↓
/api/review 服务端路由
        ↓
阿里云百炼 OpenAI 兼容接口
```

百炼 API Key 只在服务端读取，不会发送到浏览器。

## 本地运行

环境要求：Node.js 20.9 或更高版本，推荐 Node.js 22。

```bash
git clone git@github.com:liqinglq666/scholarforge-os.git
cd scholarforge-os
npm install
```

复制环境变量模板：

### Windows CMD

```bat
copy .env.example .env.local
```

### PowerShell、macOS 或 Linux

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
DASHSCOPE_API_KEY=你的百炼APIKey
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

然后启动：

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

健康检查：

```text
http://localhost:3000/api/health
```

未配置 `DASHSCOPE_API_KEY` 时，应用会自动进入演示模式，不会报空白页。

## Vercel 部署

1. 登录 Vercel，并使用 GitHub 账号授权。
2. 点击 **Add New → Project**。
3. 导入 `liqinglq666/scholarforge-os`。
4. Framework Preset 保持 **Next.js**，其他构建设置保持默认。
5. 在 **Environment Variables** 中添加：

```text
DASHSCOPE_API_KEY
DASHSCOPE_BASE_URL
DASHSCOPE_MODEL
```

建议把变量同时应用于 Production、Preview 和 Development。

6. 点击 **Deploy**。
7. 环境变量修改后需要重新部署，旧部署不会自动获得新变量。

## 安全要求

- 不要把真实 Key 写入 `.env.example`、README 或前端代码。
- 不要使用 `NEXT_PUBLIC_DASHSCOPE_API_KEY`，否则密钥会暴露给浏览器。
- `.env.local` 已加入 `.gitignore`。
- API 输入首版限制为 12,000 字符，防止超长请求和意外额度消耗。
- 系统提示词禁止虚构实验数据、样本数量、参考文献和设备参数。

## 下一阶段

- Word/PDF 上传与章节解析
- 多 Agent 并行工作流与 SSE 实时事件
- 逐条接受或拒绝修改
- 论文项目、版本历史与术语记忆
- DOCX、XLSX 和 PDF 正式导出
- 审稿意见回复与 Cover Letter 生成

## 常用命令

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

## License

暂未添加开源许可证。未经许可，不默认授予复制、修改或商业使用权。
