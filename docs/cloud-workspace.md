# ScholarForge OS 云端论文项目部署说明

ScholarForge OS v1.0 将云端项目设计为**可选增强层**：Supabase 邮箱账户可以跨设备保存项目；访客和本地演示账户继续使用浏览器本地存储。

## 1. 当前保存内容

每个云端项目包含：

- 项目名称与工作流类型
- 目标期刊、论文章节、处理强度
- 当前论文草稿与作者依据
- 用户术语锁
- 最近 8 次多 Agent 任务快照
- 问题证据与作者决策
- 最新准备度与待处理数量

## 2. 安全边界

浏览器只使用 Supabase Publishable Key。真正的数据隔离由 Supabase Auth JWT 和 Row Level Security 完成。

所有 `select / insert / update / delete` 都要求：

```sql
auth.uid() = owner_id
```

不要把 `service_role` Key 放入 `NEXT_PUBLIC_*` 环境变量，也不要提交到 GitHub。

## 3. 部署数据库

1. 创建或打开 Supabase 项目。
2. 进入 **SQL Editor**。
3. 复制并运行：

```text
supabase/migrations/20260730_cloud_workspace.sql
```

4. 确认 `public.scholarforge_projects` 已创建并启用 RLS。

## 4. 配置环境变量

在 Vercel 中配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

修改后重新部署。

## 5. 使用流程

```text
Supabase 邮箱登录
→ 打开右下角“云端项目”
→ 明确点击“同步当前项目”或“迁移全部本机项目”
→ 在另一台设备登录同一账户
→ 从云端项目列表恢复到工作台
```

系统不会在首次登录时自动上传旧论文。迁移必须由用户明确触发。

## 6. 访客与故障回退

- 访客账户：只使用当前浏览器 localStorage。
- 本地演示账户：只使用当前浏览器 localStorage。
- Supabase 未配置：云端按钮展示配置说明，本地工作流保持可用。
- 数据表未部署：展示 SQL 迁移入口，不影响本地翻译、润色、预检和返修信。

## 7. v1.0 边界

当前使用项目级 JSON 信封保存最近 8 次任务，适合 MVP 与比赛演示。后续团队协作、无限版本历史和大型文档需要拆分为独立版本表、任务表和附件存储。
