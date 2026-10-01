import { expect, test } from '@playwright/test';
import { admin, asPerson } from './helpers.js';

test('a new graduate registers, waits for approval, and is let in by an administrator', async ({
  page,
  browser,
}) => {
  const email = `graduate.${Date.now()}@daraja.test`;
  const password = `Graduate-${Date.now()}`;

  // Step 1: who you are.
  await page.goto('/register');
  const next = page.getByRole('button', { name: 'Continue' });
  await expect(next).toBeDisabled();
  await page.getByText('Pride Centre graduate', { exact: true }).click();
  await next.click();

  // Step 2: details and consent.
  await page.getByLabel('Full name').fill('Wairimu Njoroge');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
  // Modules stay closed until approval.
  await page
    .getByRole('navigation', { name: 'Modules' })
    .getByRole('link', { name: /Mentorship/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();

  // An administrator approves the registration from the console.
  const { context, page: console } = await asPerson(browser, admin().email, admin().password);
  await console.goto('/admin/members');
  const row = console.locator('li', { hasText: email });
  await expect(row.getByText(/consent given/)).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();
  // Other tests may leave registrations waiting, so check this one left the queue.
  await expect(row).toHaveCount(0);
  await context.close();

  // The graduate is now in.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Wairimu/ })).toBeVisible();
  await expect(page.getByText('You are at the main concourse.', { exact: false })).toBeVisible();
});

test('sign-in explains a wrong password without signing anyone in', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('mte-0001@sample.daraja.test');
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
