import { expect, type Page } from '@playwright/test';

export type PrimaryNavigationLabel = '直接体验' | '论文项目' | '快速审校' | '安全说明';

export async function followPrimaryNavigation(page: Page, name: PrimaryNavigationLabel) {
  const desktopNavigation = page.getByRole('navigation', { name: '主要工作区' });

  if (await desktopNavigation.isVisible()) {
    await desktopNavigation.getByRole('link', { name, exact: true }).click();
    return;
  }

  const menuButton = page.getByRole('button', { name: '打开导航菜单' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name, exact: true }).click();
  await expect(drawer).toBeHidden();
}

export function sourceEditor(page: Page) {
  return page.locator('#source-text');
}

export function startAnalysisButton(page: Page) {
  return page.getByRole('button', { name: '检查并开始分析', exact: true });
}

export async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}
