import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  followPrimaryNavigation,
  sourceEditor,
  startAnalysisButton,
} from './helpers';

const source = 'The results can well prove that the compressive strength was 42.5 MPa after 28 d, representing an increase of 12%.';
const revised = 'The results indicate that the compressive strength was 42.5 MPa after 28 d, representing an increase of 12%.';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      configured: true,
      model: 'test-model',
      message: '分析服务已配置。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 8, windowMinutes: 10 },
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
          safetyGate: {
            status: 'passed',
            blockedCount: 0,
            reviewCount: 0,
            checkedAt: new Date().toISOString(),
            checks: [
              { id: 'numbers', title: '数值与样本量', state: 'passed', summary: '已核对 3 个数值标记。', evidence: ['42.5', '28', '12%'] },
              { id: 'claim-boundary', title: '因果、结论强度与研究范围', state: 'passed', summary: '未发现主张边界升级。', evidence: [] },
            ],
          },
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

test('quick review follows the current five-stage workflow and preserves a local history entry', async ({ page }) => {
  await page.goto('/');
  await followPrimaryNavigation(page, '快速审校');

  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('heading', { name: '准备本次审校任务' })).toBeVisible();

  const editor = sourceEditor(page);
  await expect(editor).toBeVisible();
  await editor.fill(source);
  await page.getByLabel('任务名称（可选）').fill('E2E manuscript');

  const analyze = startAnalysisButton(page);
  await expect(analyze).toBeEnabled();
  await analyze.click();
  await expect(page.getByRole('heading', { name: '确认发送当前文本？' })).toBeVisible();
  await page.getByRole('button', { name: '确认并开始分析' }).click();

  await expect(page.getByRole('heading', { name: 'E2E manuscript' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '候选稿通过当前自动规则' })).toBeVisible();
  await expect(page.getByText('通过当前代码检查仍需作者核对', { exact: true })).toBeVisible();
  await expect(page.getByText('发现一处结论强度问题，请作者核对。')).toBeVisible();

  await page.getByRole('button', { name: '已接受', exact: true }).click();
  await page.getByRole('button', { name: '应用这一条建议' }).click();

  const authorManuscript = page.locator('.author-manuscript');
  await expect(authorManuscript).toContainText('The results indicate');

  const titleActions = page.locator('.review-title-actions');
  await titleActions.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(authorManuscript).toContainText('can well prove');
  await titleActions.getByRole('button', { name: '重做', exact: true }).click();
  await expect(authorManuscript).toContainText('The results indicate');

  await page.getByRole('button', { name: '进入导出' }).click();
  await expect(page.getByRole('heading', { name: '选择需要的交付文件' })).toBeVisible();

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

  const projectText = sourceEditor(page);
  await expect(projectText).toHaveValue(/126 participants/);
  await projectText.fill('A total of 126 participants were included. The compressive strength was 42.5 MPa after 28 days. This paragraph was clarified before review.');

  const analyze = startAnalysisButton(page);
  await expect(analyze).toBeEnabled();
  await analyze.click();
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

test('workspace examples load into the local draft without sending a review request', async ({ page }) => {
  let reviewRequests = 0;
  await page.unroute('**/api/review');
  await page.route('**/api/review', (route) => {
    reviewRequests += 1;
    return route.abort();
  });

  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: '载入一个公开合成案例' })).toBeVisible();
  await page.getByRole('button', { name: /使用示例：材料与工程，结果段：避免过度证明/ }).click();

  await expect(sourceEditor(page)).toHaveValue(/The results can well prove/);
  await expect(page.getByRole('radio', { name: /英文保守润色/ })).toBeChecked();
  await page.getByText('术语规则', { exact: true }).click();
  await expect(page.getByText('孔结构', { exact: true })).toBeVisible();
  await expect(page.getByText('pore structure', { exact: true })).toBeVisible();
  await expect(page.getByText(/示例已载入/)).toBeVisible();
  expect(reviewRequests).toBe(0);
});

test('unconfigured service is explicit and never offers analysis', async ({ page }) => {
  await page.unroute('**/api/health');
  await page.route('**/api/health', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      configured: false,
      model: null,
      message: '分析服务未配置。不会生成模拟结果。',
      limits: { maxCharacters: 12_000, maxRequestBytes: 80_000, requestsPerWindow: 8, windowMinutes: 10 },
    }),
  }));

  await page.goto('/workspace');
  await sourceEditor(page).fill(source);
  await expect(page.getByText('分析服务未配置', { exact: true })).toBeVisible();
  await expect(startAnalysisButton(page)).toBeDisabled();
});

test('core workspace has no horizontal overflow at the active viewport', async ({ page }) => {
  await page.goto('/workspace');
  await sourceEditor(page).fill(source);
  await expectNoHorizontalOverflow(page);
});
