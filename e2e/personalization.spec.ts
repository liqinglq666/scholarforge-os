import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('personal preferences create a tailored manuscript project', async ({ page }) => {
  await page.goto('/preferences');
  await expect(page.getByRole('heading', { name: '让默认设置适合你的学科和写作习惯' })).toBeVisible();

  await page.getByLabel('学科或研究方向').fill('Environmental Engineering');
  await page.getByLabel('当前阶段').selectOption('doctoral');
  await page.getByLabel('英文变体').selectOption('uk');
  await page.getByLabel('解释详细度').selectOption('detailed');
  await page.getByLabel('默认审校任务').selectOption('precheck');
  await page.getByLabel('默认目标期刊或写作语境').fill('Water Research');
  await page.getByLabel('原词或非首选表达').fill('micro plastic');
  await page.getByLabel('指定表达').fill('microplastic');
  await page.getByRole('button', { name: '添加规则' }).click();
  await page.getByLabel('模板章节 1 名称').fill('Structured Abstract');
  await page.getByRole('button', { name: '保存本地偏好' }).click();
  await expect(page.getByText('个性化偏好已保存到此浏览器')).toBeVisible();

  await page.getByRole('link', { name: '项目', exact: true }).click();
  await page.getByRole('button', { name: '创建第一个项目' }).click();
  await expect(page.getByRole('button', { name: /Structured Abstract/ })).toBeVisible();
  await expect(page.getByLabel('目标期刊（可选）')).toHaveValue('Water Research');
  await expect(page.getByText('统一使用：microplastic')).toBeVisible();
});

test('account page clearly falls back to guest-local mode when auth is unconfigured', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: '登录用于同步偏好，不自动上传论文' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '账户服务尚未配置' })).toBeVisible();
  await expect(page.getByText('SUPABASE_URL=https://your-project.supabase.co')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
});
