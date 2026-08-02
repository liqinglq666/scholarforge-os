import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('homepage presents one clear author-controlled workflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toContainText('AI 提建议');
  await expect(page.getByRole('link', { name: '创建论文项目' })).toBeVisible();
  await expect(page.getByRole('link', { name: '单段落审校' })).toBeVisible();
  await expect(page.locator('.hero-flow li')).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});

test('global navigation exposes only projects and quick review as primary workspaces', async ({ page }) => {
  await page.goto('/');
  const primaryNavigation = page.getByRole('navigation', { name: '主要工作区' });
  const utilityNavigation = page.getByRole('navigation', { name: '偏好与设置' });

  await expect(primaryNavigation.getByRole('link', { name: '项目', exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole('link', { name: '快速审校', exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole('link')).toHaveCount(2);
  await expect(utilityNavigation.getByRole('link', { name: '偏好', exact: true })).toBeVisible();
  await expect(utilityNavigation.getByRole('link', { name: '数据与隐私', exact: true })).toBeVisible();

  await primaryNavigation.getByRole('link', { name: '项目', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(primaryNavigation.getByRole('link', { name: '项目', exact: true })).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalOverflow(page);
});

test('core routes retain responsive layouts', async ({ page }) => {
  for (const route of ['/', '/workspace', '/projects', '/preferences', '/login']) {
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
