# 部署与发布清单

## 环境

- Node.js `>=22.12.0`；
- 支持 Next.js 16 Node.js runtime；
- 服务端配置 `DASHSCOPE_API_KEY`；
- 可选配置 `DASHSCOPE_BASE_URL`、`DASHSCOPE_MODEL`；
- 根据可承受费用设置 `REVIEW_DAILY_REQUEST_BUDGET`；
- 启用账户时配置 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY` 并执行偏好表迁移。

生产环境不得把任何服务端密钥暴露为 `NEXT_PUBLIC_*`。

## CI

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

任一步失败都应阻止合并或部署。CI 不得写入真实论文、真实模型输出或生产密钥。

## 公开部署前

1. 确认 `/api/health` 返回 `configured=true` 和预期模型；
2. 使用无痕窗口从 `/try` 完成推荐案例；
3. 检查首页、`/try`、`/trust`、`/guide`、`/workspace` 和 `/projects`；
4. 验证模型超时、供应商限流、预算熔断和服务未配置状态；
5. 确认生产域名指向预期提交和版本；
6. 检查桌面、390px 和 360px 移动视口，无横向滚动或被遮挡操作；
7. 检查键盘、焦点、对话框、200% 缩放和减少动态效果；
8. 验证 TXT、Markdown、clean DOCX 和 JSON 备份；
9. 确认日志不记录论文正文、API Key或完整模型响应；
10. 设置模型供应商预算告警和部署平台异常监控。

## 公开流量保护

当前实现提供：

- 浏览器会话限流；
- 出口 IP 滥用上限；
- 单实例并发保护；
- 可配置每日预算熔断；
- 请求和模型超时；
- `Retry-After`。

当前计数器为单实例内存 Map。多实例或更高流量部署应使用 Redis/KV/数据库原子计数，并配合平台 WAF、机器人规则和供应商预算控制。

## Vercel 发布策略

- 合并前先验证一个预览部署；
- 通过后优先将同一已验证构建提升到 production，避免重新构建产生差异；
- 比赛评审期减少无关提交和自动预览；
- 若 Hobby 账户触发滚动部署频率限制，停止重复 Redeploy，等待额度恢复后只触发一次最终部署；
- 保留上一条稳定生产部署作为回滚候选。

## 评审期检查

在专业评审结束前持续保证：

- 公网域名和 HTTPS 可访问；
- `/try` 无需登录和用户 API Key；
- 模型额度、并发和预算充足；
- Supabase异常不会阻断游客核心流程；
- 推荐案例和核心导出可用；
- 使用手册与线上版本一致。

## 回滚

回滚代码不会自动删除浏览器本地数据。恢复旧版本前必须验证旧版本能够安全忽略或迁移新版本键。不要通过脚本清除用户浏览器存储。
