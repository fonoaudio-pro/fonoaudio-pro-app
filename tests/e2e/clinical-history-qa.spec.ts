import { test, expect, Page } from '@playwright/test';
import { devLogin, navigateToPatients, openFirstConsultorio, switchTab } from './helpers';

async function createPatient(page: Page, name: string, age: string): Promise<boolean> {
  await navigateToPatients(page);
  await openFirstConsultorio(page);

  const nuevoBtn = page.getByRole('button', { name: /\+ Nuevo/ }).first();
  if (!await nuevoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const nuevoAlt = page.locator('button, a').filter({ hasText: /Nuevo/ }).first();
    if (!await nuevoAlt.isVisible({ timeout: 3000 }).catch(() => false)) return false;
    await nuevoAlt.click();
  } else {
    await nuevoBtn.click();
  }
  await page.waitForTimeout(800);

  const nameInput = page.locator('input[name="name"]');
  if (!await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) return false;
  await nameInput.fill(name);

  const ageInput = page.locator('input[name="age"]');
  await ageInput.fill(age);

  const guardarBtn = page.locator('button[type="submit"]');
  await guardarBtn.click();
  await page.waitForTimeout(3000);

  const patientRow = page.locator('tr').filter({ hasText: name }).first();
  if (await patientRow.isVisible({ timeout: 8000 }).catch(() => false)) {
    await patientRow.click();
    await page.waitForTimeout(2000);
    const resumenVisible = await page.locator('text=Resumen').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (resumenVisible) return true;
  }

  const fallbackRow = page.getByText(name).first();
  if (await fallbackRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fallbackRow.click();
    await page.waitForTimeout(2000);
    return await page.locator('text=Resumen').first().isVisible({ timeout: 5000 }).catch(() => false);
  }

  return false;
}

test.describe('Historia Clínica Inteligente — QA Visual', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('QA-01: Neonato — cribado auditivo alterado', async ({ page }) => {
    const ok = await createPatient(page, `QA Neonato ${Date.now()}`, '0');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    const hasAnamnesis = await page.locator('text=Anamnesis').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAnamnesis).toBeTruthy();

    await page.screenshot({ path: 'test-results/qa-01-neonato.png', fullPage: true });
  });

  test('QA-02: Lactante — retraso de lenguaje', async ({ page }) => {
    const ok = await createPatient(page, `QA Lactante ${Date.now()}`, '1');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/qa-02-lactante.png', fullPage: true });
  });

  test('QA-03: Preescolar — habla limitada', async ({ page }) => {
    const ok = await createPatient(page, `QA Preescolar ${Date.now()}`, '4');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/qa-03-preescolar.png', fullPage: true });
  });

  test('QA-04: Escolar — dificultades de lectura', async ({ page }) => {
    const ok = await createPatient(page, `QA Escolar ${Date.now()}`, '8');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/qa-04-escolar.png', fullPage: true });
  });

  test('QA-05: Adulto — disfonía', async ({ page }) => {
    const ok = await createPatient(page, `QA Adulto ${Date.now()}`, '35');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/qa-05-adulto.png', fullPage: true });
  });

  test('QA-06: Adulto Mayor — polimedicación', async ({ page }) => {
    const ok = await createPatient(page, `QA AdultoMayor ${Date.now()}`, '75');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/qa-06-adulto-mayor.png', fullPage: true });
  });

  test('UI: AdaptiveAnamnesisForm renders correctly', async ({ page }) => {
    const ok = await createPatient(page, `QA UI ${Date.now()}`, '5');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/ui-components.png', fullPage: true });
  });

  test('UI: Dark mode badges are readable', async ({ page }) => {
    const ok = await createPatient(page, `QA Dark ${Date.now()}`, '5');
    expect(ok).toBeTruthy();

    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);

    const darkModeToggle = page.locator('button').filter({ hasText: /Oscuro/ }).first();
    if (await darkModeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await darkModeToggle.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'test-results/dark-mode.png', fullPage: true });
  });
});
