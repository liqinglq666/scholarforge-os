import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, sourceEditor } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      configured: false,
      model: null,
      message: '分析服务未配置。不会生成模拟结果。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 8, windowMinutes: 10 },
    }),
  }));
});

test('task selection switches same-theme examples and protects authored text', async ({ page }) => {
  await page.goto('/workspace?example=materials-polish');

  const editor = sourceEditor(page);
  await expect(editor).toHaveValue(/The results can well prove/);
  await expect(page.locator('.source-origin-badge')).toHaveText('公开合成示例');
  await expect(page.getByLabel('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段保守润色');

  await page.locator('.quick-task-switcher label').filter({ hasText: '科研中译英' }).click();
  await expect(page.getByRole('radio', { name: /科研中译英/ })).toBeChecked();
  await expect(editor).toHaveValue(/养护28 d后/);
  await expect(page.getByLabel('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段中译英');
  await expect(page.getByLabel('目标期刊或语境（可选）')).toHaveValue('Construction and Building Materials');
  await expect(page.getByText(/正文、任务名称、期刊和术语规则已同步更新/)).toBeVisible();

  await page.locator('.quick-task-switcher label').filter({ hasText: '投稿前检查' }).click();
  await expect(page.getByRole('radio', { name: /投稿前检查/ })).toBeChecked();
  await expect(editor).toHaveValue(/No independent durability test was conducted/);
  await expect(page.getByLabel('任务名称（可选）')).toHaveValue('水泥基材料孔结构研究 · 结果段投稿前检查');
  await expect(page.locator('.save-indicator')).toContainText('已保存到此浏览器');

  await page.reload();
  await expect(sourceEditor(page)).toHaveValue(/No independent durability test was conducted/);
  await expect(page.locator('.source-origin-badge')).toHaveText('公开合成示例');
  await expect(page.getByRole('radio', { name: /投稿前检查/ })).toBeChecked();

  const customText = 'This author-edited paragraph must remain unchanged when the review task changes.';
  await sourceEditor(page).fill(customText);
  await expect(page.locator('.source-origin-badge')).toHaveText('我的文本');
  await expect(page.getByText(/之后切换任务不会覆盖当前内容/)).toBeVisible();

  await page.locator('.quick-task-switcher label').filter({ hasText: '科研中译英' }).click();
  await expect(page.getByRole('radio', { name: /科研中译英/ })).toBeChecked();
  await expect(sourceEditor(page)).toHaveValue(customText);
  await expect(page.getByText(/当前我的文本已保留/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
