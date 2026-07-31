# ScholarForge OS 账户与认证说明

## 1. 当前账户模型

ScholarForge OS v1.3.2 只保留两种清晰的账户状态：

| 模式 | 适用场景 | 会话存储 | 云端项目 |
| --- | --- | --- | --- |
| Supabase 云端账户 | 正式注册、登录、跨设备项目 | Supabase Auth | 支持，需作者主动同步 |
| 访客模式 | 快速体验、比赛评审、未配置 Supabase 的部署 | 当前浏览器 | 不支持 |

旧版“本地演示账户”已删除。它和访客模式都只使用浏览器存储，却额外模拟邮箱注册与密码登录，容易被误解为真实账户。

## 2. 登录优先流程

```text
访问工作台
→ 检查 Supabase 或访客会话
→ 无有效会话时进入 /login
→ 登录云端账户或明确选择访客体验
→ 进入论文项目中心
```

访客入口仍然保留，因为公开演示和首次体验不应被强制注册阻断。访客会话不会自动上传论文，也不会获得跨设备项目。

## 3. 未配置 Supabase 时

当以下环境变量缺失时：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

登录页会隐藏无效的邮箱登录和注册表单，只显示访客入口与配置说明。系统不会再接受任意邮箱和密码并创建假的本地账户。

## 4. Supabase 配置

在 Supabase 创建项目后，从项目设置中获取：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

将它们写入 `.env.local` 或 Vercel Environment Variables。

当前认证层支持：

- 邮箱和密码注册；
- 邮箱和密码登录；
- 邮箱确认提示；
- 密码重置邮件；
- 浏览器会话保持；
- 当前设备退出。

## 5. 邮箱配置

正式发布前需要在 Supabase Dashboard 检查：

- Authentication / Sign In / Providers / Email；
- Confirm Email 是否开启；
- Site URL 是否指向正式域名；
- Redirect URLs 是否包含：
  - `http://localhost:3000/login`
  - `https://scholarforge-os.vercel.app/login`
- 生产环境建议配置自定义 SMTP。

## 6. 云端项目与数据隔离

Supabase 邮箱账户可以主动同步当前项目或迁移本机项目。数据库表 `public.scholarforge_projects` 启用 Row Level Security，所有操作要求：

```sql
auth.uid() = owner_id
```

登录本身不会自动上传本机论文。云端同步只会在作者点击“同步当前项目”或“迁移全部本机项目”后发生。

运行迁移脚本：

```text
supabase/migrations/20260730_cloud_workspace.sql
```

## 7. 当前安全边界

- 访客草稿、任务历史和作者决策保存在浏览器 localStorage；
- 原始 DOCX 二进制保存在浏览器 IndexedDB，不进入当前云端同步；
- Supabase 云端项目按用户 RLS 隔离；
- `/api/review` 为公开体验仍可匿名调用，尚未实施服务端 JWT 鉴权和用户配额；
- 百炼 API Key 只存在于 Next.js 服务端环境变量中；
- 清理浏览器数据会删除访客会话和本地工作区，但不会删除已同步的云端项目。

## 8. 旧本地演示会话迁移

升级到 v1.3.2 后：

- 旧访客会话会迁移到新的访客会话键；
- 旧本地演示账户会被清除并返回登录页；
- 用户可以重新选择访客体验，或使用真实 Supabase 邮箱账户登录；
- 本地论文草稿和任务历史不会因账户模式清理而被删除。

## 9. 关键文件

- `app/login/page.tsx`：云端登录、注册与访客入口；
- `components/auth-provider.tsx`：Supabase 与访客会话状态；
- `components/account-dock.tsx`：全局账户入口和退出菜单；
- `components/cloud-workspace-dock.tsx`：云端项目迁移与恢复；
- `lib/supabase/client.ts`：可选 Supabase 浏览器客户端；
- `supabase/migrations/20260730_cloud_workspace.sql`：云端项目表和 RLS；
- `.env.example`：认证环境变量模板。
