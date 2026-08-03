import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('homepage presents the scientific-safety proposition and one clear entry path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.editorial-hero h1')).toContainText('让 AI 修改先通过科研事实安全门');
  await expect(page.getByRole('link', { name: '直接体验公开案例' })).toBeVisible();
  await expect(page.getByRole('link', { name: '进入论文工作台' })).toBeVisible();
  await expect(page.locator('.gate-preview-findings li')).toHaveCount(3);
  await expect(page.locator('.gate-preview-findings .protected')).toContainText('作者工作稿保持不变');
  await expect(page.getByText('自动应用权限')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('public evaluator entry loads a real quick-review case without sending it automatically', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      configured: true,
      model: 'test-model',
      message: '分析服务已配置。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 8, windowMinutes: 10 },
    }),
  }));
  await page.goto('/try');
  await expect(page.getByRole('heading', { name: '用一个公开案例体验核心安全流程' })).toBeVisible();
  await expect(page.getByText('模型服务可用 · test-model')).toBeVisible();
  await page.getByRole('link', { name: '载入案例并开始' }).click();

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByLabel(/英文论文原文/)).toHaveValue(/Participants who slept less than 6 h/);
  await expect(page.getByRole('radio', { name: /投稿前检查/ })).toBeChecked();
  await expect(page.getByRole('button', { name: '检查并开始分析' })).toBeEnabled();
});

test('global navigation stays compact on desktop and becomes a drawer on mobile', async ({ page }) => {
  await page.goto('/');
  const mobile = (page.viewportSize()?.width ?? 0) <= 900;
  const primaryNavigation = page.getByRole('navigation', { name: '主要工作区' });

  if (mobile) {
    await expect(primaryNavigation).toBeHidden();
    const menuButton = page.getByRole('button', { name: '打开导航菜单' });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const mobileNavigation = page.getByRole('dialog');
    await expect(mobileNavigation.getByRole('link', { name: '直接体验', exact: true })).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: '论文项目', exact: true })).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: '快速审校', exact: true })).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: '安全说明', exact: true })).toBeVisible();
    await mobileNavigation.getByRole('link', { name: '论文项目', exact: true }).click();
  } else {
    await expect(primaryNavigation.getByRole('link', { name: '直接体验', exact: true })).toBeVisible();
    await expect(primaryNavigation.getByRole('link', { name: '论文项目', exact: true })).toBeVisible();
    await expect(primaryNavigation.getByRole('link', { name: '快速审校', exact: true })).toBeVisible();
    await expect(primaryNavigation.getByRole('link', { name: '安全说明', exact: true })).toBeVisible();
    await expect(primaryNavigation.getByRole('link')).toHaveCount(4);
    await primaryNavigation.getByRole('link', { name: '论文项目', exact: true }).click();
  }

  await expect(page).toHaveURL(/\/projects$/);
  await expectNoHorizontalOverflow(page);
});

test('public and product routes retain responsive layouts', async ({ page }) => {
  for (const route of ['/', '/try', '/trust', '/guide', '/workspace', '/projects', '/preferences', '/login']) {
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
