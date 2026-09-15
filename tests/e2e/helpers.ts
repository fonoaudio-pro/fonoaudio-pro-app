import { Page, expect } from '@playwright/test';

export async function devLogin(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle', timeout: 30_000 });
  const skipBtn = page.getByRole('button', { name: /Entrar sin Google/i });
  await skipBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await skipBtn.click();
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 15_000 });
}

export async function navigateToPatients(page: Page) {
  await page.locator('nav').getByText('Pacientes').click();
  await page.waitForTimeout(1000);
}

export async function openFirstConsultorio(page: Page) {
  // Wait for consultorio grid to appear
  await page.waitForTimeout(500);
  // Click the first consultorio card by its name
  const card = page.locator('text=Consultorio 1').first();
  if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
    await card.click();
    await page.waitForTimeout(1500);
  }
}

export async function createAndGetPatient(page: Page, name: string): Promise<boolean> {
  await navigateToPatients(page);
  await openFirstConsultorio(page);

  // We should now see "+ Nuevo" button and the patient table
  const nuevoBtn = page.getByRole('button', { name: /\+ Nuevo/ }).first();
  if (!await nuevoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Try alternate: link or text match
    const nuevoAlt = page.locator('button, a').filter({ hasText: /Nuevo/ }).first();
    if (!await nuevoAlt.isVisible({ timeout: 3000 }).catch(() => false)) return false;
    await nuevoAlt.click();
  } else {
    await nuevoBtn.click();
  }
  await page.waitForTimeout(800);

  // Fill the modal
  const nameInput = page.locator('input[name="name"]');
  if (!await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) return false;
  await nameInput.fill(name);

  const ageInput = page.locator('input[name="age"]');
  await ageInput.fill('8');

  const guardarBtn = page.locator('button[type="submit"]');
  await guardarBtn.click();
  await page.waitForTimeout(3000);

  // After creation, click on the patient row to open detail
  const patientRow = page.locator('tr').filter({ hasText: name }).first();
  if (await patientRow.isVisible({ timeout: 8000 }).catch(() => false)) {
    await patientRow.click();
    await page.waitForTimeout(2000);
    // Verify we're in PatientDetailView
    const resumenVisible = await page.locator('text=Resumen').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (resumenVisible) return true;
  }

  // Fallback: maybe the patient was created but the row selector is different
  // Try clicking any patient-like text
  const fallbackRow = page.getByText(name).first();
  if (await fallbackRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fallbackRow.click();
    await page.waitForTimeout(2000);
    return await page.locator('text=Resumen').first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  return false;
}

export async function switchTab(page: Page, tabLabel: string) {
  const tab = page.locator('button').filter({ hasText: tabLabel }).first();
  await tab.click({ timeout: 10_000 });
  await page.waitForTimeout(800);
}
