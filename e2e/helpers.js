import { expect } from '@playwright/test';

export const seedPassword = () => process.env.E2E_SEED_PASSWORD;
export const admin = () => ({
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
});

/** Seeded sample accounts: mentees MTE-0001..0300, mentors MTR-0001..0160. */
export const sampleEmail = (id) => `${id.toLowerCase()}@sample.daraja.test`;

/** Sign in through the form, as a person would, and wait for the main concourse. */
export async function signIn(page, email, password = seedPassword()) {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Modules' })).toBeVisible();
}

/** A session token from the API, for setting up or checking state without the UI. */
export async function apiToken(request, email, password = seedPassword()) {
  const response = await request.post(`${process.env.E2E_API_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `sign-in for ${email}`).toBeTruthy();
  return (await response.json()).token;
}

export async function apiGet(request, token, path) {
  const response = await request.get(`${process.env.E2E_API_URL}/api${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `GET ${path}`).toBeTruthy();
  return response.json();
}

/** A fresh browser context per person, so two people can act in one test. */
export async function asPerson(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, email, password);
  return { context, page };
}
