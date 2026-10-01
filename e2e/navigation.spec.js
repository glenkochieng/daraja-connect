import { expect, test } from '@playwright/test';
import { sampleEmail, signIn } from './helpers.js';

test('the sign band shows where you are and the skip link reaches the content', async ({
  page,
}) => {
  await signIn(page, sampleEmail('MTE-0050'));

  // Keyboard: the first Tab reaches the skip link, which moves focus to the main content.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();

  // Each module sign marks itself as the current page when followed.
  const modules = page.getByRole('navigation', { name: 'Modules' });
  for (const [sign, heading] of [
    [/Mentorship/, 'Mentorship'],
    [/Networking/, 'Networking hub'],
    [/Knowledge/, 'Knowledge repository'],
    [/Events/, 'Events'],
    [/Updates/, 'Updates'],
  ]) {
    const link = modules.getByRole('link', { name: sign });
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
});

test('members cannot open the admin console, and unknown pages say so', async ({ page }) => {
  await signIn(page, sampleEmail('MTE-0051'));
  await expect(
    page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: /Admin/ }),
  ).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'No sign for this page' })).toBeVisible();
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'No sign for this page' })).toBeVisible();
});

test('signing out returns to the sign-in page and protects the app', async ({ page }) => {
  await signIn(page, sampleEmail('MTE-0052'));
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto('/mentorship');
  await expect(page).toHaveURL(/\/sign-in$/);
});
