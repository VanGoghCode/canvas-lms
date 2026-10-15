import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signIn(page: Page, instructor = false) {
  await page.goto('/login');
  if (instructor) await page.getByRole('radio', { name: 'Instructor', exact: true }).check();
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
}
async function verify(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
}

test('shared information dialogs work with keyboard, focus return, and touch-sized layouts', async ({
  page,
}, testInfo) => {
  await signIn(page);
  const trigger = page.getByRole('button', { name: 'About Coursework progress', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Coursework progress' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('including future work');
  await expect(page.getByRole('button', { name: 'Close information' })).toBeFocused();
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/info-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Close information' }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await page.getByRole('link', { name: 'Open CS 210' }).click();
  await page.getByRole('button', { name: 'About CS 210: syllabus', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('arrays');
  await page.getByRole('button', { name: 'Close information' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('student planner, gradebook, and calendar show connected, filtered coursework', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Review missing work' }).click();
  await expect(page.getByRole('heading', { name: 'Assignment planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Missing/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.work-item')).toHaveCount(4);
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption('c101');
  await expect(page.locator('.work-item')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Missing/ })).toHaveText('Missing2');
  await expect(page.getByRole('button', { name: /^All work/ })).toHaveText('All work6');
  await page.reload();
  await expect(page.locator('.work-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.locator('.work-item')).toHaveCount(12);
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/planner-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Grades & feedback', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grades & feedback', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption('c101');
  await expect(page.locator('.gradebook-row')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Modern Web Development' })).toHaveCount(0);
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/grades-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'August 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '2026-08-22, 1 deadline', exact: true }).click();
  await expect(page.locator('.calendar-agenda a')).toHaveCount(1);
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/calendar-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'September 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  await page.getByRole('button', { name: '2026-08-22, 1 deadline', exact: true }).click();
  await page.locator('.calendar-agenda').getByRole('link').click();
  await expect(page).toHaveURL(/assignments\/a105/);
});

test('filtered links retain their destination through sign-in', async ({ page }) => {
  await page.goto('/work?status=missing&course=c101');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/\/work\?status=missing&course=c101$/);
  await expect(page.locator('.work-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Switch account / Log out' }).click();
  await page.goto('/instructor/grade/a104?student=s001');
  await page.getByRole('radio', { name: 'Instructor', exact: true }).check();
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/\/instructor\/grade\/a104\?student=s001$/);
});

test('publishing from Needs grading leaves a confirmation and a path to the result', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/assignments/a105');
  await expect(
    page.getByText('Include three edge cases and their expected behavior.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Your draft is private.', { exact: false })).toBeVisible();
  await page.getByLabel('Submission text').fill('A response for the grading workflow.');
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await page.getByLabel('Submission text').fill('An unpublished revision.');
  await expect(page.getByText('You have unpublished changes.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Switch account / Log out' }).click();
  await signIn(page, true);
  await page.goto('/instructor/grade/a105');
  await page.getByLabel('Submission status').selectOption('pending');
  const response = page.getByRole('article').filter({ hasText: 'Emma Garcia' });
  await expect(response).toContainText('A response for the grading workflow.');
  await expect(response).not.toContainText('An unpublished revision.');
  await response.getByLabel('Score (out of 100)').fill('90');
  await response.getByRole('button', { name: 'Save grade' }).click();
  await expect(response).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Grade published for Emma Garcia');
  await page.getByRole('button', { name: 'View published grades' }).click();
  await expect(response.getByLabel('Score (out of 100)')).toHaveValue('90');
  await verify(page);
});

test('instructor queue and support roster link to the correct student response', async ({
  page,
}, testInfo) => {
  await signIn(page, true);
  await page.getByRole('link', { name: 'Grading queue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grading queue', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Queue status', exact: true }).selectOption('pending');
  await expect(page.getByRole('heading', { name: 'You’re caught up on grading' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all assignments', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(6);
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/grading-queue-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Students & support' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Support status', exact: true }).selectOption('support');
  await expect(page.getByRole('status')).toHaveText('8 course enrollments');
  await page.getByLabel('Search students').fill('Emma');
  await expect(page.getByRole('article')).toHaveCount(1);
  await verify(page);
  await page.screenshot({
    path: `test-results/previews/students-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByText('View coursework', { exact: true }).click();
  await page.getByRole('link', { name: 'Review →', exact: true }).first().click();
  await expect(page.getByLabel('Find a student')).toHaveValue('Emma Garcia');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.goto('/work');
  await expect(page).toHaveURL(/instructor$/);
  await page.getByRole('button', { name: 'Switch account / Log out' }).click();
  await expect(page.getByRole('button', { name: 'Enter workspace' })).toBeVisible();
  await signIn(page);
  await page.goto('/instructor/students');
  await expect(page).toHaveURL(/dashboard$/);
});
