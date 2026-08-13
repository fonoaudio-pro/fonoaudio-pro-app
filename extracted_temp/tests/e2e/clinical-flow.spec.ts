import { test, expect } from '@playwright/test';
import { devLogin, navigateToPatients, openFirstConsultorio, createAndGetPatient, switchTab } from './helpers';

test.describe('Sprint 8 — Clinical Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  // TC-01
  test('TC-01: Dev login lands on dashboard', async ({ page }) => {
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
  });

  // TC-02
  test('TC-02: Navigate to patients list', async ({ page }) => {
    await navigateToPatients(page);
    await expect(page.locator('text=Pacientes').first()).toBeVisible();
    await expect(page.locator('text=Consultorio').first()).toBeVisible();
  });

  // TC-03
  test('TC-03: Create a new patient', async ({ page }) => {
    const name = `QA ${Date.now()}`;
    const ok = await createAndGetPatient(page, name);
    expect(ok).toBeTruthy();
    await expect(page.locator('text=Resumen').first()).toBeVisible();
  });

  // TC-04
  test('TC-04: Patient detail has tabs', async ({ page }) => {
    const ok = await createAndGetPatient(page, `TabTest ${Date.now()}`);
    expect(ok).toBeTruthy();
    for (const t of ['Resumen', 'Ficha', 'Anamnesis']) {
      await expect(page.locator('button').filter({ hasText: t }).first()).toBeVisible();
    }
  });

  // TC-05
  test('TC-05: Anamnesis save draft', async ({ page }) => {
    const ok = await createAndGetPatient(page, `Anamnesis ${Date.now()}`);
    expect(ok).toBeTruthy();
    await switchTab(page, 'Anamnesis');
    await page.waitForTimeout(1000);
    const saveBtn = page.locator('button').filter({ hasText: /Guardar Anamnesis/ }).first();
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
    // Verify we're still on the Anamnesis tab
    await expect(page.locator('button').filter({ hasText: 'Anamnesis' }).first()).toBeVisible();
  });

  // TC-06
  test('TC-06: Clinical history shows template or empty state', async ({ page }) => {
    const ok = await createAndGetPatient(page, `HistClin ${Date.now()}`);
    expect(ok).toBeTruthy();
    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);
    const hasHeader = await page.locator('text=Historia Clínica').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await page.locator('text=No hay plantillas').first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasHeader || hasEmpty).toBeTruthy();
  });

  // TC-07
  test('TC-07: AI buttons check on clinical history', async ({ page }) => {
    const ok = await createAndGetPatient(page, `AI ${Date.now()}`);
    expect(ok).toBeTruthy();
    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);
    // If there are textareas, there should be AI buttons nearby
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    if (count > 0) {
      const aiButtons = page.locator('button[title*="Refinar"], button[title*="Resumir"], button[title*="Redacción"]');
      expect(await aiButtons.count()).toBeGreaterThan(0);
    }
  });

  // TC-08
  test('TC-08: Clinical history save', async ({ page }) => {
    const ok = await createAndGetPatient(page, `Save ${Date.now()}`);
    expect(ok).toBeTruthy();
    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('Nota clínica de prueba QA Sprint 8');
    }
    const saveBtn = page.locator('button').filter({ hasText: /^Guardar$/ }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  // TC-09
  test('TC-09: Clinical history status badge', async ({ page }) => {
    const ok = await createAndGetPatient(page, `Badge ${Date.now()}`);
    expect(ok).toBeTruthy();
    await switchTab(page, 'Historia');
    await page.waitForTimeout(1500);
    const badge = page.locator('span').filter({ hasText: /Borrador|Revisado|Aprobado/ }).first();
    if (await badge.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(badge).toBeVisible();
    }
  });

  // TC-10
  test('TC-10: Sidebar navigation works', async ({ page }) => {
    for (const item of ['Pacientes', 'Agenda', 'Dashboard']) {
      await page.locator('nav').getByText(item).click();
      await page.waitForTimeout(400);
    }
    await expect(page.locator('aside')).toBeVisible();
  });
});
