import { expect, test } from '@playwright/test';
import { admin, apiGet, apiToken, asPerson, sampleEmail, signIn } from './helpers.js';

test('two members connect and then see each other’s email', async ({ page, browser, request }) => {
  await signIn(page, sampleEmail('MTE-0020'));
  await page.goto('/directory?userType=current_staff&mentorsOnly=true');
  const row = page.locator('li.member').first();
  const name = await row.getByRole('link').first().innerText();
  await row.getByRole('button', { name: 'Connect' }).click();
  await row.getByLabel(/Note to/).fill('Hello from the Pride Centre class of 2024.');
  await row.getByRole('button', { name: 'Send request' }).click();
  await expect(row.getByText('Request sent')).toBeVisible();

  // Open their profile; until they answer, the email stays private.
  await row.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Email addresses are shared once you are connected')).toBeVisible();
  const memberId = new URL(page.url()).pathname.split('/').pop();

  // Look up their sign-in email through the admin API (sample accounts only).
  const adminToken = await apiToken(request, admin().email, admin().password);
  const { user } = await apiGet(request, adminToken, `/users/${memberId}`);

  // They answer from their connections page.
  const other = await asPerson(browser, user.email);
  await other.page.goto('/connections');
  await expect(other.page.getByText('Hello from the Pride Centre class of 2024.')).toBeVisible();
  await other.page.getByRole('button', { name: 'Accept' }).click();
  await expect(other.page.getByText(sampleEmail('MTE-0020'))).toBeVisible();
  await other.context.close();

  await page.reload();
  await expect(page.getByText(user.email)).toBeVisible();
});

test('an article waits for review, then is published for everyone', async ({ page, browser }) => {
  const title = `Handover habits that keep the line calm ${Date.now()}`;
  await signIn(page, sampleEmail('MTE-0030'));
  await page.goto('/knowledge/new');
  await page.getByLabel('Title').fill(title);
  await page
    .getByLabel('Summary')
    .fill('Say what is finished, what is open and what you are unsure about.');
  await page.getByLabel('Specialisation').selectOption({ index: 1 });
  await page
    .getByLabel('Article')
    .fill('Treat the handover as a task of its own.\n\nWrite it down as you go.');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Waiting for review').first()).toBeVisible();

  // Members do not see it yet.
  const reader = await asPerson(browser, sampleEmail('MTE-0031'));
  await reader.page.goto('/knowledge');
  await expect(reader.page.getByText(title)).toHaveCount(0);

  // An administrator publishes it with a note.
  const adminSession = await asPerson(browser, admin().email, admin().password);
  await adminSession.page.goto('/admin/articles');
  const row = adminSession.page.locator('li', { hasText: title });
  await row.getByLabel('Note to the author (optional)').fill('Thank you, published.');
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(adminSession.page.getByText('Nothing to moderate')).toBeVisible();
  await adminSession.context.close();

  await reader.page.reload();
  await reader.page.getByRole('link', { name: title }).click();
  await expect(reader.page.getByText('Treat the handover as a task of its own.')).toBeVisible();
  await reader.context.close();
});

test('a member reserves a place at an event and gives it up again', async ({ page }) => {
  await signIn(page, sampleEmail('MTE-0040'));
  await page.goto('/events');
  // Pin the row by its title: once reserved it no longer offers "Reserve a place".
  const open = page
    .locator('li.event-row')
    .filter({ has: page.getByRole('button', { name: /Reserve a place/ }) })
    .first();
  const title = await open.getByRole('heading').innerText();
  const event = page.locator('li.event-row', { hasText: title });
  await event.getByRole('button', { name: /Reserve a place/ }).click();
  await expect(event.getByText('You are going')).toBeVisible();
  await event.getByRole('link').click();
  await expect(page.getByRole('button', { name: 'Give up my place' })).toBeVisible();
  await page.getByRole('button', { name: 'Give up my place' }).click();
  await expect(page.getByRole('button', { name: /Reserve a place/ })).toBeVisible();
});
