import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('dedicated login page keeps guest mode usable when auth is unconfigured', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: '让你的科研写作环境跨设备保持一致' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '账户服务尚未开启' })).toBeVisible();
  await expect(page.getByRole('link', { name: '继续使用游客模式' })).toHaveAttribute('href', '/workspace');
  await expect(page.getByText('登录不会自动上传现有论文')).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
