import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('homepage presents one clear scientific-safety proposition', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.competition-hero h1')).toContainText('ScholarForge 阻止 AI 改错论文');
  await expect(page.getByRole('link', { name: '立即体验科研事实安全审校' })).toBeVisible();
  await expect(page.getByRole('link', { name: '进入完整论文工作台' })).toBeVisible();
  await expect(page.locator('.risk-findings li')).toHaveCount(3);
  await expect(page.getByText('候选稿已隔离')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('global navigation exposes evaluation and product workspaces', async ({ page }) => {
  await page.goto('/');
  const primaryNavigation = page.getByRole('navigation', { name: '主要工作区' });
  const utilityNavigation = page.getByRole('navigation', { name: '帮助与设置' });

  await expect(primaryNavigation.getByRole('link', { name: '直接体验', exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole('link', { name: '论文项目', exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole('link', { name: '快速审校', exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole('link')).toHaveCount(3);
  await expect(utilityNavigation.getByRole('link', { name: '安全与测试', exact: true })).toBeVisible();
  await expect(utilityNavigation.getByRole('link', { name: '使用手册', exact: true })).toBeVisible();
  await expect(utilityNavigation.getByRole('link', { name: '数据与隐私', exact: true })).toBeVisible();

  await primaryNavigation.getByRole('link', { name: '论文项目', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(primaryNavigation.getByRole('link', { name: '论文项目', exact: true })).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalOverflow(page);
});

test('public evaluation routes retain responsive layouts', async ({ page }) => {
  for (const route of ['/', '/try', '/trust', '/guide', '/workspace', '/projects', '/preferences', '/login']) {
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
