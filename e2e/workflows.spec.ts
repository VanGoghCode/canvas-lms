import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signIn(
  page: Page,
  role: 'Student' | 'Instructor' = 'Student',
  name = 'Emma Garcia',
) {
  await page.goto('/login');
  await page.getByRole('radio', { name: role, exact: true }).check();
  await page.getByLabel('Account').selectOption({ label: name });
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
}
async function switchAccount(page: Page) {
  await page.getByRole('button', { name: 'Switch account / Log out' }).click();
  await expect(page.getByRole('button', { name: 'Enter workspace' })).toBeVisible();
}
async function assertFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test('new learner completes enrollment, draft, submit, instructor grading, and feedback', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create a student account' }).click();
  await page.getByLabel('Full name').fill('Taylor Morgan');
  await page.getByLabel('Email address').fill('taylor.morgan@example.edu');
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Taylor.' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore courses' }).click();
  await page.getByRole('button', { name: 'Enroll in CS 210', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data Structures & Algorithms' })).toBeVisible();
  await page.getByRole('link', { name: 'Applied Challenge', exact: true }).click();
  await page
    .getByLabel('Submission text')
    .fill('Use a hash table with separate chaining. Resize at 75% capacity.');
  await page.reload();
  await expect(page.getByLabel('Submission text')).toHaveValue(
    'Use a hash table with separate chaining. Resize at 75% capacity.',
  );
  await expect(page.getByText('Draft saved in this browser')).toBeVisible();
  await page.getByRole('button', { name: 'Submit assignment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Assignment submitted');
  await expect(page.getByText('Awaiting grade', { exact: true })).toBeVisible();
  await page
    .getByLabel('Submission text')
    .fill(
      'Revised: use separate chaining, resize at 75%, and test empty keys, collisions, and repeated keys.',
    );
  await page.getByRole('button', { name: 'Resubmit assignment' }).click();
  await switchAccount(page);
  await signIn(page, 'Instructor', 'Ava Patel');
  await page.getByRole('link', { name: 'Grade submissions for Applied Challenge' }).click();
  await page.getByLabel('Find a student').fill('Taylor Morgan');
  const response = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: /Taylor Morgan/ }) });
  await expect(response).toContainText('Revised: use separate chaining');
  await response.getByLabel('Score (out of 100)').fill('101');
  await response.getByRole('button', { name: 'Save grade' }).click();
  expect(
    await response
      .getByLabel('Score (out of 100)')
      .evaluate((input: HTMLInputElement) => input.validity.rangeOverflow),
  ).toBe(true);
  await expect(response.getByText('Needs grading', { exact: true })).toBeVisible();
  await response.getByLabel('Score (out of 100)').fill('0');
  await response.getByRole('button', { name: 'Save grade' }).click();
  await expect(response.getByRole('status')).toContainText('Grade published');
  await response.getByLabel('Score (out of 100)').fill('92');
  await response.getByLabel('Instructor comment').fill('Clear design and useful edge cases.');
  await response.getByRole('button', { name: 'Save grade' }).click();
  await expect(response.getByRole('status')).toContainText('Grade published');
  await page.reload();
  await page.getByLabel('Find a student').fill('Taylor Morgan');
  await expect(page.getByLabel('Score (out of 100)')).toHaveValue('92');
  await switchAccount(page);
  await signIn(page, 'Student', 'Taylor Morgan');
  await page.getByRole('link', { name: 'Open CS 210' }).click();
  await page.getByRole('link', { name: 'Applied Challenge', exact: true }).click();
  await expect(page.getByText('Clear design and useful edge cases.')).toBeVisible();
  await expect(page.getByLabel('Submission text')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Resubmit assignment' })).toHaveCount(0);
  await assertFits(page);
  await accessible(page);
  expect(errors).toEqual([]);
});

test('account selection, dashboard, course, profile, and mobile layouts are accessible', async ({
  page,
}, testInfo) => {
  await page.goto('/login');
  await assertFits(page);
  await accessible(page);
  await page.screenshot({
    path: `test-results/previews/login-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await signIn(page);
  await assertFits(page);
  await accessible(page);
  await page.screenshot({
    path: `test-results/previews/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Open CS 210' }).click();
  await assertFits(page);
  await accessible(page);
  await page.getByRole('link', { name: 'My profile', exact: true }).click();
  await page.getByLabel('Preferred name').fill('Em');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('updated');
  await page.getByLabel('Preferred name').fill('Emmy');
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.reload();
  await expect(page.getByLabel('Preferred name')).toHaveValue('Emmy');
  await assertFits(page);
  await accessible(page);
});

test('profile validation prevents invalid and duplicate accounts', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page.getByLabel('Full name')).toBeFocused();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await page.getByLabel('Full name').fill('Test Person');
  await page.getByLabel('Email address').fill('EMMA.GARCIA@CAMPUS.EXAMPLE');
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(page.getByText('An account with this email already exists.')).toBeVisible();
  await page.getByLabel('Email address').fill('unique@example.edu');
  await page.getByLabel('Date of birth').fill('2026-08-16');
  await page.getByRole('button', { name: 'Create student account' }).click();
  await expect(
    page.getByText('Enter a valid date of birth that is not in the future.'),
  ).toBeVisible();
  await accessible(page);
});

test('deep links survive login, role checks deny cross-course grading, and unknown pages recover', async ({
  page,
}) => {
  await page.goto('/assignments/a105');
  await expect(page).toHaveURL(/login/);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page).toHaveURL(/assignments\/a105/);
  await page.goto('/instructor/grade/a105');
  await expect(page).toHaveURL(/dashboard/);
  await switchAccount(page);
  await signIn(page, 'Instructor', 'Liam Johnson');
  await page.goto('/instructor/grade/a105');
  await expect(page).toHaveURL(/instructor$/);
  await page.goto('/courses/c101');
  await expect(page.getByRole('heading', { name: 'Course unavailable' })).toBeVisible();
  await page.goto('/assignments/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Assignment unavailable' })).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Let’s get you back on track.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(page).toHaveURL(/instructor$/);
});

test('analytics filters, empty ranges, and reset work with accessible metrics', async ({
  page,
}, testInfo) => {
  await signIn(page, 'Instructor', 'Ava Patel');
  await page.screenshot({
    path: `test-results/previews/instructor-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await assertFits(page);
  await accessible(page);
  await page.getByRole('link', { name: 'Analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Course performance' })).toBeVisible();
  await accessible(page);
  await assertFits(page);
  await page.screenshot({
    path: `test-results/previews/analytics-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole('combobox', { name: 'Assignment', exact: true })
    .selectOption({ label: 'Applied Challenge' });
  await expect(page.getByText('Due-work completion', { exact: true }).locator('..')).toContainText(
    '—',
  );
  await page.getByLabel('Due from').fill('2027-01-01');
  await expect(page.getByText('Submissions', { exact: true }).first().locator('..')).toContainText(
    '0',
  );
  await page.getByLabel('Due through').fill('2026-01-01');
  await expect(page.getByRole('alert')).toContainText('Choose an end date');
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByLabel('Due from')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Assignment', exact: true })).toHaveValue('');
});

test('corrupt browser storage recovers and unavailable storage is explained', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('canvas-lite:v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Emma.' })).toBeVisible();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.getByRole('link', { name: 'My profile', exact: true }).click();
  await page.getByLabel('Preferred name').fill('Test');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be saved');
});

test('reset can be cancelled and then restores seed data', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Restore workspace data', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my work' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Restore workspace data', exact: true }).click();
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Emma.' })).toBeVisible();
});

test('saved sessions and assignment drafts stay consistent across browser tabs', async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto('/assignments/a105');
  await page.getByLabel('Submission text').fill('A draft shared across tabs.');
  const second = await context.newPage();
  await second.goto('/assignments/a105');
  await expect(second.getByLabel('Submission text')).toHaveValue('A draft shared across tabs.');
  await second.getByLabel('Submission text').fill('Updated in the second tab.');
  await expect(page.getByLabel('Submission text')).toHaveValue('Updated in the second tab.');
  await switchAccount(second);
  await expect(page.getByRole('button', { name: 'Enter workspace' })).toBeVisible();
  await second.close();
});
