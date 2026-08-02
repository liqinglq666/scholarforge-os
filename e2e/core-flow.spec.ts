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

test('quick review keeps the primary path short and preserves a local history entry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '单段落审校' }).click();

  await expect(page.getByRole('heading', { name: '粘贴文本，选择任务，开始分析' })).toBeVisible();
  await page.getByLabel(/粘贴英文论文原文/).fill(source);
  await page.getByText('高级设置与 DOCX 导入').click();
  await page.getByLabel('任务名称（可选）').fill('E2E manuscript');
  await expect(page.getByRole('button', { name: '开始分析' })).toBeEnabled();
  await page.getByRole('button', { name: '开始分析' }).click();
  await expect(page.getByRole('heading', { name: '确认发送当前文本？' })).toBeVisible();
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
  await expect(page.locator('.save-indicator')).toContainText('已保存到此浏览器');

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'E2E manuscript' })).toBeVisible();
  await expect(page.getByText(/0 条待处理/)).toBeVisible();
});

test('multi-project portfolio keeps project workflows in an explicit project route', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: '创建第一个项目' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await page.getByLabel('论文或课题名称').fill('E2E thesis');
  await page.getByLabel('章节名称').fill('Methods');
  await page.getByLabel('章节正文').fill('A total of 126 participants were included. The compressive strength was 42.5 MPa after 28 days.');

  await page.getByRole('button', { name: '添加章节' }).click();
  await page.getByLabel('章节名称').fill('Results');
  await page.getByLabel('章节正文').fill('The final analysis used n = 118. The compressive strength was 45.0 MPa after 28 days.');
  await page.getByRole('button', { name: '运行本地检查' }).click();
  await expect(page.getByText(/多个样本量候选值/)).toBeVisible();

  await page.getByRole('button', { name: /Methods/ }).click();
  await page.getByRole('button', { name: '开始本章节审校' }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/review$/);
  await expect(page.getByText('来自论文项目：Methods')).toBeVisible();
  const projectText = page.getByLabel(/粘贴英文论文原文/);
  await expect(projectText).toHaveValue(/126 participants/);
  await projectText.fill('A total of 126 participants were included. The compressive strength was 42.5 MPa after 28 days. This paragraph was clarified before review.');
  await page.getByRole('button', { name: '开始分析' }).click();
  await page.getByRole('button', { name: '确认并开始分析' }).click();
  await expect(page.getByRole('heading', { name: 'E2E thesis' })).toBeVisible();
  await page.getByRole('button', { name: '保存当前文本回项目' }).click();
  await expect(page.getByText(/自动生成一条版本记录/)).toBeVisible();
  await page.getByRole('link', { name: '返回项目' }).click();
  await expect(page.getByText(/最近审校/)).toBeVisible();
  await expect(page.locator('.project-overview article').filter({ hasText: '版本记录' })).toContainText('1');

  await page.getByRole('link', { name: '← 所有项目' }).click();
  await expect(page.getByRole('heading', { name: 'E2E thesis' })).toBeVisible();
  await page.getByRole('button', { name: '新建论文项目' }).click();
  await page.getByLabel('论文或课题名称').fill('Second project');
  const secondProjectUrl = page.url();
  await page.goto(`${secondProjectUrl}/review`);
  await expect(page.getByRole('heading', { name: '先从章节中选择本次处理内容' })).toBeVisible();
  await page.getByRole('link', { name: '← 所有项目' }).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
});

test('feedback and versions stay inside the selected project', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: '创建第一个项目' }).click();
  await page.getByLabel('论文或课题名称').fill('Feedback thesis');
  await page.getByLabel('章节名称').fill('Discussion');
  await page.getByLabel('章节正文').fill('The results support the hypothesis. A possible mechanism is improved transport efficiency.');

  await page.getByRole('link', { name: /意见与回复/ }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/feedback$/);
  await page.getByLabel('批量导师意见').fill('1. 讨论部分需要解释可能机制。\n2. 请说明本研究的局限性。');
  await page.getByRole('button', { name: '拆分并保存' }).click();
  await expect(page.getByText(/已拆分并保存 2 条导师意见/)).toBeVisible();
  await page.getByLabel('作者处理说明').first().fill('在 Discussion 第二句增加了可能机制解释。');
  await page.getByLabel('处理状态').first().selectOption('completed');

  await page.getByRole('link', { name: /版本记录/ }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/versions$/);
  await page.getByLabel('比较名称').fill('Discussion after feedback');
  await page.getByLabel('关联章节').selectOption({ label: 'Discussion' });
  await page.getByLabel('修改前版本').fill('The results support the hypothesis.');
  await page.getByLabel('修改后版本').fill('The results support the hypothesis. A possible mechanism is improved transport efficiency.');
  await page.getByRole('button', { name: '运行本地比较' }).click();
  await page.getByLabel('关联导师意见').selectOption({ index: 1 });
  await page.getByLabel('修改原因或处理说明').fill('根据意见补充机制解释。');
  await page.getByRole('button', { name: '保存到论文项目' }).click();
  await expect(page.getByText('版本比较已保存到论文项目。')).toBeVisible();
});

test('homepage examples remain available as an optional quick-review helper', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /环境与生态/ }).click();
  await page.getByRole('link', { name: '在工作台使用此示例' }).click();

  await expect(page.getByLabel(/粘贴中文科研原文/)).toHaveValue(/共采集36个样品/);
  await expect(page.getByRole('radio', { name: /科研中译英/ })).toBeChecked();
  await page.getByText('高级设置与 DOCX 导入').click();
  await expect(page.getByText('必须使用：microplastics')).toBeVisible();
});

test('unconfigured service is explicit and never offers analysis', async ({ page }) => {
  await page.unroute('**/api/health');
  await page.route('**/api/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ configured: false, model: null, message: '分析服务未配置。不会生成模拟结果。', limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 6, windowMinutes: 10 } }),
  }));
  await page.goto('/workspace');
  await page.getByLabel(/粘贴英文论文原文/).fill(source);
  await expect(page.getByText('分析服务未配置', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始分析' })).toBeDisabled();
});

test('core workspace has no horizontal overflow at the active viewport', async ({ page }) => {
  await page.goto('/workspace');
  await page.getByLabel(/粘贴英文论文原文/).fill(source);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
