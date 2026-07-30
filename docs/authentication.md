# ScholarForge OS 账户与认证说明

## 1. 当前版本

ScholarForge OS v0.5 提供三种账户状态：

| 模式 | 适用场景 | 会话存储 | 是否为真实云端账户 |
| --- | --- | --- | --- |
| Supabase 云端账户 | 正式注册、登录与会话保持 | Supabase Auth | 是 |
| 本地演示账户 | 未配置 Supabase 时测试登录体验 | 当前浏览器 localStorage | 否 |
| 访客模式 | 比赛评审和快速体验 | 当前浏览器 localStorage | 否 |

界面会明确显示当前账户模式，不会把本地演示账户包装成云端账号。

## 2. 为什么保留访客入口

ScholarForge OS 是公开参赛作品。强制注册会增加评委和首次访问者的体验成本，因此当前采用：

- 公开工作台可以直接使用；
- 用户可主动进入 `/login` 注册或登录；
- 未登录用户可以继续使用访客模式；
- 登录功能不会阻断核心百炼审校 Demo。

## 3. Supabase 配置

在 Supabase 创建项目后，从项目设置中获取：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

将它们写入 `.env.local` 或 Vercel Environment Variables。

当前实现使用 `@supabase/supabase-js` 浏览器客户端，支持：

- 邮箱和密码注册；
- 邮箱和密码登录；
- 邮箱确认提示；
- 密码重置邮件；
- 浏览器会话保持；
- 当前设备退出。

## 4. 邮箱配置

Supabase 托管项目默认可能要求邮箱确认。正式发布前需要在 Supabase Dashboard 检查：

- Authentication / Sign In / Providers / Email；
- Confirm Email 是否开启；
- Site URL 是否指向正式域名；
- Redirect URLs 是否包含：
  - `http://localhost:3000/login`
  - `https://scholarforge-os.vercel.app/login`
- 生产环境建议配置自定义 SMTP。

## 5. 安全边界

当前账户系统只负责身份和会话，不应被误解为已经完成论文数据的云端隔离。

尚未实现：

- 按用户持久化论文项目；
- Supabase 数据表与 Row Level Security；
- 审校历史和版本历史；
- 服务端对 `/api/review` 的登录鉴权；
- 用户配额和调用计费隔离；
- 云端文件上传与对象存储。

因此当前版本中：

- 论文草稿仍保存在浏览器本地；
- 审校 API 为了公开比赛体验仍可匿名调用；
- 登录不会自动把旧草稿上传到 Supabase；
- API Key 仍只存在于 Next.js 服务端环境变量中。

## 6. 下一阶段建议

要把账户系统升级为正式科研工作区，需要依次完成：

1. 创建 `profiles`、`projects`、`manuscript_versions` 和 `review_runs` 数据表；
2. 为所有用户数据表启用 Row Level Security；
3. 只允许用户读取和修改自己的项目；
4. 在服务端验证用户 JWT，再允许创建云端审校记录；
5. 将匿名访客草稿迁移到登录用户项目时进行显式确认；
6. 增加账户删除、数据导出和隐私说明。

## 7. 关键文件

- `app/login/page.tsx`：登录、注册和访客体验页面；
- `components/auth-provider.tsx`：账户状态与认证操作；
- `components/account-dock.tsx`：全局账户入口和退出菜单；
- `lib/supabase/client.ts`：可选 Supabase 浏览器客户端；
- `app/auth.css`：账户界面与响应式视觉系统；
- `.env.example`：认证环境变量模板。
