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
  const dimensions = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: [
            element.tagName.toLowerCase(),
            element.id ? `#${element.id}` : '',
            ...Array.from(element.classList).slice(0, 3).map((name) => `.${name}`),
          ].join(''),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
          text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
        };
      })
      .filter((item) => item.right > viewport + 1 || item.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 12);

    return {
      url: window.location.pathname,
      viewport,
      content: document.documentElement.scrollWidth,
      offenders,
    };
  });

  expect(
    dimensions.content,
    `Horizontal overflow at ${dimensions.url}: viewport=${dimensions.viewport}, content=${dimensions.content}. Offenders: ${JSON.stringify(dimensions.offenders)}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}
