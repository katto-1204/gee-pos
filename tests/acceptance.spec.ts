import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(9)
})

test('1. Catalog has 9 jersey shirts (no bandanas), XS-2XL 2 each (12 stock), 3XL-5XL in Not available', async ({ page }) => {
  await expect(page.locator('.product-card')).toHaveCount(9)
  await expect(page.locator('.product-card').filter({ hasText: /Bandana/i })).toHaveCount(0)
  const badges = await page.locator('.product-card .stock-count-badge').allTextContents()
  expect(badges.every((text) => text.trim() === '12 left')).toBe(true)
  const imagesLoaded = await page.locator('.product-card img.product-jersey-img').evaluateAll(
    (imgs) => imgs.length === 9 && imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
  )
  expect(imagesLoaded).toBe(true)

  // Verify XS-2XL are Available (2 each) and 3XL-5XL are in Not available, and selling 2 XS moves XS to Not available
  await page.locator('.product-card').first().click()
  const sizeModal = page.getByRole('dialog', { name: 'Choose a size' })
  await expect(sizeModal.locator('.size-section:not(.unavailable) .size-option')).toHaveCount(6)
  await expect(sizeModal.locator('.size-section.unavailable .size-option')).toHaveCount(3)
  await sizeModal.locator('.size-option').filter({ hasText: /^XS/ }).click()
  await page.locator('.product-card').first().click()
  await sizeModal.locator('.size-option').filter({ hasText: /^XS/ }).click()
  await page.locator('.product-card').first().click()
  await expect(sizeModal.locator('.size-section.unavailable .size-option').filter({ hasText: /^XS/ })).toBeVisible()
  await sizeModal.getByRole('button', { name: 'Cancel', exact: true }).click()
})

test('2. Home jersey cards are 3x3 squares with centered names and no SKU or SHIRTS text', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 })
  const box = await page.locator('.product-card').first().boundingBox()
  expect(box).not.toBeNull()
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(8)
  const texts = await page.locator('.product-card').allTextContents()
  expect(texts.every((t) => !/GG-|SHIRTS/i.test(t))).toBe(true)
})

test('3. Removed Choose Category, Home/Products search, Log Out, and merged Orders & Reports', async ({ page }) => {
  await expect(page.getByText('Choose Category')).toHaveCount(0)
  await expect(page.getByPlaceholder('Search products...')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Log Out/i })).toHaveCount(0)
  await expect(page.locator('.primary-nav button')).toHaveCount(4)
  await page.locator('.primary-nav').getByRole('button', { name: 'Products', exact: true }).click()
  await expect(page.getByPlaceholder('Search by product or SKU')).toHaveCount(0)
  await page.locator('.primary-nav').getByRole('button', { name: 'Orders', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Orders & Reports/i })).toBeVisible()
  await expect(page.locator('.kpi-card')).toHaveCount(4)
})

test('4. Adaptive Gee Graphics logo (white dark / black light) and PP Neue Montreal font', async ({ page }) => {
  await expect(page.locator('.brand-logo-img')).toHaveAttribute('src', '/icons/gee-logo-white.png')
  const fontFamily = await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily)
  expect(fontFamily).toContain('PP Neue Montreal')
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('.brand-logo-img')).toHaveAttribute('src', '/icons/gee-logo-black.png')
  await expect(page.locator('html')).toHaveClass(/light-mode/)
})

test('5. Test Print modal shows Gee Graphics logo receipt, Pair BT, Manual Print, and Cancel', async ({ page }) => {
  await page.getByRole('button', { name: 'Test Print' }).click()
  const modal = page.getByRole('dialog', { name: 'Test Print' })
  await expect(modal).toBeVisible()
  await expect(modal.locator('.receipt-logo-img.thermal-logo')).toHaveAttribute('src', '/icons/gee-logo-black.png')
  await expect(modal.getByRole('button', { name: /Pair BT Printer/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /Manual Print/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(modal).toBeHidden()
})

test('6. Payment Successful waits for Print/Skip without BT, and auto-prints without browser dialog when BT connected', async ({ page }) => {
  // Without BT: does not show Payment Successful until Print or Close
  await page.locator('.product-card').first().click()
  await page.locator('.size-option:not(:disabled)').first().click()
  await page.locator('.charge-button').click()
  const receipt = page.getByRole('dialog', { name: 'Receipt #1029' })
  await expect(receipt).toBeVisible()
  await expect(receipt.getByRole('button', { name: /Pair BT Printer/i })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Payment successful' })).toHaveCount(0)
  // Clicking Print receipt without BT must NOT call window.print() — it opens the Connect BT Printer First modal
  await page.evaluate(() => { (window as any).__printCallsNoBt = 0; window.print = () => { (window as any).__printCallsNoBt++ } })
  await receipt.getByRole('button', { name: 'Print receipt', exact: true }).click()
  const btPrompt = page.getByRole('dialog', { name: 'Connect BT printer first' })
  await expect(btPrompt).toBeVisible()
  expect(await page.evaluate(() => (window as any).__printCallsNoBt)).toBe(0)
  await btPrompt.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(btPrompt).toBeHidden()
  await receipt.getByRole('button', { name: 'Skip printing', exact: true }).click()
  const success = page.getByRole('status', { name: 'Payment successful' })
  await expect(success).toBeVisible()
  await expect(success).toBeHidden({ timeout: 3500 })

  // With BT connected: auto-prints to BT without window.print() and triggers Payment Successful
  await page.evaluate(() => {
    ;(window as any).__btPrinted = false
    ;(window as any).__printCalls = 0
    window.print = () => { (window as any).__printCalls++ }
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {
        requestDevice: async () => ({
          name: 'MHT-P58D',
          addEventListener: () => {},
          gatt: {
            connect: async () => ({
              getPrimaryServices: async () => [{
                uuid: '0000ae30-0000-1000-8000-00805f9b34fb',
                getCharacteristics: async () => [{
                  properties: { writeWithoutResponse: true },
                  writeValueWithoutResponse: async () => { (window as any).__btPrinted = true },
                }],
              }],
            }),
            disconnect: () => {},
          },
        }),
      },
    })
  })
  await page.getByRole('button', { name: 'Test Print' }).click()
  await page.getByRole('button', { name: /Pair BT Printer/i }).click()
  await expect(page.getByRole('dialog', { name: 'Test Print' })).toContainText('MHT-P58D')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.locator('.product-card').first().click()
  await page.locator('.size-option:not(:disabled)').first().click()
  await page.locator('.charge-button').click()
  await expect.poll(() => page.evaluate(() => (window as any).__btPrinted)).toBe(true)
  expect(await page.evaluate(() => (window as any).__printCalls)).toBe(0)
  // Stays on ReceiptModal with Reprint + Done printing, no Payment Successful overlay yet
  const btReceipt = page.getByRole('dialog', { name: 'Receipt #1030' })
  await expect(btReceipt.getByRole('button', { name: /Reprint/i })).toBeVisible({ timeout: 8000 })
  await expect(btReceipt.getByRole('button', { name: /Done printing/i })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Payment successful' })).toHaveCount(0)
  await btReceipt.getByRole('button', { name: /Done printing/i }).click()
  await expect(btReceipt).toBeHidden()
  await expect(page.getByRole('status', { name: 'Payment successful' })).toBeVisible()
})

test('7. Online payment uploads image to IndexedDB, uses numeric inputMode, and recovers if localStorage is cleared', async ({ page }) => {
  await page.locator('.product-card').first().click()
  await page.locator('.size-option:not(:disabled)').first().click()
  await page.locator('.payment-method').filter({ hasText: 'Online' }).click()
  await expect(page.getByPlaceholder('Name shown on the account')).toHaveAttribute('inputmode', 'numeric')
  await expect(page.getByPlaceholder('e.g. GC-2819-7712')).toHaveAttribute('inputmode', 'numeric')

  await page.locator('#receipt-photo').setInputFiles('public/icons/gee-logo-black.png')
  await page.getByRole('button', { name: 'Save payment', exact: true }).click()
  await page.locator('.charge-button').click()
  await page.getByRole('dialog', { name: 'Receipt #1029' }).getByRole('button', { name: 'Skip printing', exact: true }).click()

  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.primary-nav').getByRole('button', { name: 'Orders', exact: true }).click()
  await expect(page.locator('.orders-table')).toContainText('#1029')
  await page.getByRole('button', { name: 'Proof', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Payment proof #1029' })).toBeVisible()
})

test('8. Responsive fit with zero horizontal overflow across Desktop, iPad Landscape, iPad Portrait, and Mobile', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1180, 820], [820, 1180], [390, 844]]) {
    await page.setViewportSize({ width, height })
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(fits).toBe(true)
  }
})
