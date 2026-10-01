import { expect, test } from '@playwright/test';
import { admin, apiGet, apiToken, asPerson, sampleEmail, signIn } from './helpers.js';

test('a mentee requests a recommended mentor, who accepts within capacity', async ({
  page,
  browser,
  request,
}) => {
  const menteeEmail = sampleEmail('MTE-0010');
  await signIn(page, menteeEmail);
  await page
    .getByRole('navigation', { name: 'Modules' })
    .getByRole('link', { name: /Mentorship/ })
    .click();

  // The ranked board explains every match in plain words.
  const board = page.getByRole('region', { name: 'Recommended mentors' });
  const first = board.getByRole('listitem').first();
  await expect(first.getByLabel('Rank 1')).toBeVisible();
  await expect(
    first.getByRole('list', { name: 'Why this mentor' }).getByRole('listitem').first(),
  ).toBeVisible();
  await first.getByText('How this match was scored').click();
  await expect(first.getByText('Overall match score')).toBeVisible();
  const mentorName = (await first.getByRole('heading', { level: 3 }).innerText())
    .replace('Sample', '')
    .trim();

  // Send a request with a message.
  await first.getByRole('button', { name: 'Request' }).click();
  await first.getByLabel(/Message to/).fill('I would like advice on my next role.');
  await first.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText(`Request sent to ${mentorName}`)).toBeVisible();
  const myRequests = page.getByRole('region', { name: 'Your requests' });
  await expect(myRequests.getByText(mentorName)).toBeVisible();
  await expect(myRequests.getByText('Pending')).toBeVisible();

  // Look up the mentor's sign-in email through the admin API (sample accounts only).
  const menteeToken = await apiToken(request, menteeEmail);
  const { items } = await apiGet(request, menteeToken, '/mentorship/requests?as=mentee');
  const sent = items.find((r) => r.status === 'pending');
  const adminToken = await apiToken(request, admin().email, admin().password);
  const { user: mentor } = await apiGet(request, adminToken, `/users/${sent.mentor.id}`);
  const placesBefore = mentor.mentor.currentMentees;

  // The mentor accepts with a note; capacity goes up by one.
  const { context, page: mentorPage } = await asPerson(browser, mentor.email);
  await mentorPage.goto('/mentorship');
  await expect(mentorPage.getByText('I would like advice on my next role.')).toBeVisible();
  await mentorPage
    .getByLabel(/Note to/)
    .first()
    .fill('Happy to help. Let us meet next week.');
  await mentorPage.getByRole('button', { name: 'Accept' }).first().click();
  await expect(
    mentorPage.getByText(`${placesBefore + 1} of ${mentor.mentor.maxMentees} places taken`),
  ).toBeVisible();
  await mentorPage.getByRole('tab', { name: 'Active' }).click();
  await expect(mentorPage.getByText(menteeEmail)).toBeVisible();
  await context.close();

  // The mentee sees the acceptance, the note and the mentor's contact.
  await page.reload();
  await expect(myRequests.getByText('Accepted')).toBeVisible();
  await expect(myRequests.getByText('Happy to help. Let us meet next week.')).toBeVisible();
  await expect(myRequests.getByText(mentor.email)).toBeVisible();
});

test('a mentee whose profile says nothing yet is asked to complete it', async ({ page }) => {
  const email = `blank.${Date.now()}@daraja.test`;
  const password = `Blank-${Date.now()}`;
  await page.goto('/register');
  await page.getByText('Pride Centre graduate', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Full name').fill('Baraka Kiprono');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();

  // The profile is open while waiting, and lists what the matcher needs.
  await page.getByRole('link', { name: 'Complete your profile' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your profile' })).toBeVisible();
  const checklist = page.getByRole('complementary', { name: 'What your matches use' });
  const goals = checklist.getByRole('listitem').filter({ hasText: 'Your career goals' });
  await expect(goals).toContainText('Still to add');
  await page
    .getByLabel('Your career goals')
    .fill('I want to move from the ramp into load control.');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await expect(goals).toContainText('Done');
});
