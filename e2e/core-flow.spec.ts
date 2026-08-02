import { expect, test } from '@playwright/test';

const source = 'The results can well prove that the compressive strength was 42.5 MPa after 28 d, representing an increase of 12%.';
const revised = 'The results indicate that the compressive strength was 42.5 MPa after 28 d, representing an increase of 12%.';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      configured: true,
      model: 'test-model',
      message: '分析服务已配置。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 },
    }),
  }));
  await page.route('**/api/review', (route) => {
    const posted = route.request().postDataJSON() as { taskId: string };
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
      requestId: 'e2e-request',
      result: {
        id: 'e2e-result',
        taskId: posted.taskId,
        summary: '发现一处结论强度问题，请作者核对。',
        suggestedText: revised,
        warnings: [],
        generatedAt: new Date().toISOString(),
        issues: [{
          id: 'e2e-issue',
          category: 'Evidence boundary',
          severity: 'minor',
          location: 'Sentence 1',
          original: 'can well prove',
          revised: 'indicate',
          reason: '“prove” 的结论强度超过原文证据边界。',
          meaningChanged: false,
          authorActionRequired: false,
          safeToApply: true,
        }],
        },
      }),
    });
  });
});

test('new task → analysis → author decision → apply → undo/redo → export → history', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /AI 提建议/ })).toBeVisible();
  await page.getByRole('link', { name: '开始新任务' }).click();

  await expect(page.getByRole('heading', { name: '准备需要核对的科研文本' })).toBeVisible();
  await page.getByLabel('项目名称').fill('E2E manuscript');
  await page.getByLabel('英文论文原文').fill(source);
  await expect(page.getByRole('button', { name: '检查发送内容' })).toBeEnabled();
  await page.getByRole('button', { name: '检查发送内容' }).click();
  await expect(page.getByRole('heading', { name: '确认把所选文本发送给模型？' })).toBeVisible();
  await page.getByRole('button', { name: '确认并开始分析' }).click();

  await expect(page.getByRole('heading', { name: 'E2E manuscript' })).toBeVisible();
  await expect(page.getByText('发现一处结论强度问题，请作者核对。')).toBeVisible();
  await page.getByRole('button', { name: '接受' }).click();
  await page.getByRole('button', { name: '应用这一条建议' }).click();
  await expect(page.locator('.manuscript-text')).toContainText('The results indicate');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.locator('.manuscript-text')).toContainText('can well prove');
  await page.getByRole('button', { name: '重做' }).click();
  await expect(page.locator('.manuscript-text')).toContainText('The results indicate');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '审校报告 Markdown' }).click();
  expect((await downloadPromise).suggestedFilename()).toContain('review-report.md');

  await page.getByRole('link', { name: '最近任务' }).click();
  await expect(page.getByRole('heading', { name: 'E2E manuscript' })).toBeVisible();
  await expect(page.getByText(/0 条待处理/)).toBeVisible();
});

test('unconfigured service is explicit and never offers analysis', async ({ page }) => {
  await page.unroute('**/api/health');
  await page.route('**/api/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, model: null, message: '分析服务未配置。不会生成模拟结果。', limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 } }),
  }));
  await page.goto('/workspace');
  await page.getByLabel('英文论文原文').fill(source);
  await expect(page.getByText('分析服务未配置', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '检查发送内容' })).toBeDisabled();
});

test('core workspace has no horizontal overflow at the active viewport', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByLabel('英文论文原文').fill(source);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
