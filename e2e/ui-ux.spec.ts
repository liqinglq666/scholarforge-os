import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('homepage presents one clear author-controlled workflow', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.hero h1')).toContainText('AI 提建议');
  await expect(page.getByRole('link', { name: '创建论文项目' })).toBeVisible();
  await expect(page.getByRole('link', { name: '单段落审校' })).toBeVisible();
  await expect(page.locator('.hero-flow li')).toHaveCount(3);
  await expect(page.locator('.home-proof article')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: '从论文结构开始，而不是从一个空白聊天框开始' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('global navigation keeps primary workspaces distinct from settings', async ({ page }) => {
  await page.goto('/');

  const primaryNavigation = page.getByRole('navigation', { name: '主要工作区' });
  const utilityNavigation = page.getByRole('navigation', { name: '偏好与设置' });

  await expect(primaryNavigation.getByRole('link', { name: '论文项目' })).toBeVisible();
  await expect(primaryNavigation.getByRole('link', { name: '审校工作台' })).toBeVisible();
  await expect(primaryNavigation.getByRole('link', { name: '最近任务' })).toBeVisible();
  await expect(utilityNavigation.getByRole('link', { name: '个性化' })).toBeVisible();
  await expect(utilityNavigation.getByRole('link', { name: '设置' })).toBeVisible();

  await primaryNavigation.getByRole('link', { name: '论文项目' }).click();
  await expect(page).toHaveURL(/\/project$/);
  await expect(page.getByRole('link', { name: '论文项目' })).toHaveAttribute('aria-current', 'page');
  await expectNoHorizontalOverflow(page);
});

test('core routes retain responsive layouts', async ({ page }) => {
  for (const route of ['/', '/workspace', '/project', '/preferences', '/login']) {
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
