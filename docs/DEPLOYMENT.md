# 部署与发布清单

## 环境

- Node.js `>=22.12.0`；
- 支持 Next.js 16 Node.js runtime；
- 只在服务端配置 `DASHSCOPE_API_KEY`；
- 可选配置 `DASHSCOPE_BASE_URL`、`DASHSCOPE_MODEL`；
- 生产必须评估并设置 `REVIEW_DAILY_REQUEST_BUDGET`。

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

任一步失败都应阻止合并或部署。不得在 CI 中写入真实论文、模型输出或生产密钥。

## 公开部署前必须补充

1. 共享限流：当前 Map 只保护单实例，需使用 Redis/KV/数据库原子计数或平台限流。
2. 平台防护：WAF、请求大小、机器人/速率规则、DDoS 和来源控制。
3. 模型费用：供应商日预算、告警、熔断、并发和超时监控。
4. 日志：确认代理、平台和模型日志不记录正文，设置访问权限与保留期。
5. 法务与隐私：正式隐私政策、服务条款、模型供应商与数据区域披露、许可证。
6. 质量：真实中英文段落与 DOCX 样本验收；至少 Chrome、Edge、Safari、Firefox 和移动端测试。
7. 无障碍：键盘、屏幕阅读器、200% 缩放、对比度和移动键盘人工审计。
8. 恢复：确认备份导入、旧草稿迁移、存储失败和数据清除行为。

## 发布判断标准

- 预览部署：所有非 E2E 验证通过即可供内部评审。
- 受控试用：真实模型、共享限流、费用告警、隐私说明和 E2E 通过。
- 公开发布：再完成浏览器矩阵、真实科研样本、无障碍、日志与法律审核。

## 回滚

应用本身没有服务器数据库迁移。回滚代码不会删除浏览器本地 v2 数据。恢复旧版本前应验证旧版本不会误读 v2 键；不要通过脚本清除用户浏览器存储。
