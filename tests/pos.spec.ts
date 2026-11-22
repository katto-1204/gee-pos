import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const health = new WeakMap<Page, { errors: string[]; requests: string[] }>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text())
  })
  page.on('requestfailed', request => requests.push(`${request.url()}: ${request.failure()?.errorText}`))
  page.on('response', response => {
    if (response.status() >= 400) requests.push(`${response.status()} ${response.url()}`)
  })
  // Sandbox networking blocks Google Fonts; use the app's system font fallback.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(9)
  health.set(page, { errors, requests })
})

test.afterEach(async ({ page }) => {
  const { errors, requests } = health.get(page)!
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

for (const [width, height] of [[1440, 900], [1180, 820], [1100, 768], [820, 1180], [768, 1024], [390, 844], [360, 640]]) {
  test(`Catalog shows all 9 shirts with jersey images and 10 default stock at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await expect(page.locator('.product-card:visible')).toHaveCount(9)
    await expect(page.getByText('Choose Category')).toHaveCount(0)
    await expect(page.getByPlaceholder('Search products...')).toHaveCount(0)
    await expect(page.locator('.product-card').filter({ hasText: /Bandana/i })).toHaveCount(0)
    const imgs = page.locator('.product-card img.product-jersey-img')
    await expect(imgs).toHaveCount(9)
    const loaded = await imgs.evaluateAll((nodes) => nodes.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0))
    expect(loaded).toBe(true)
    const allTenStock = await page.locator('.product-card .stock-count-badge').evaluateAll((nodes) => nodes.length === 9 && nodes.every((n) => n.textContent?.trim() === '10 left'))
    expect(allTenStock).toBe(true)
    const noSkuOrShirt = await page.locator('.product-card').evaluateAll((nodes) => nodes.every((n) => !/GG-|SHIRTS/i.test(n.textContent || '')))
    expect(noSkuOrShirt).toBe(true)
    await page.locator('.product-card').filter({ hasText: 'TIGERS' }).click()
    await page.locator('.size-option:not(:disabled)').first().click()
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('gg-cart-v1')!))
    expect(cart).toHaveLength(1)
    expect(cart[0].productId).toBe('p-tg05')
    expect(cart[0].quantity).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`all-items-${width}.png`) })
  })
}

test('Legacy saved catalogs drop bandanas and migrate Bulldogs to Red Dragon without overwriting stock or orders', async ({ page }) => {
  const before = await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('gg-products-v2')!)
    products[0].stock = 7
    const legacy = [
      ...products.map((p: any) => p.id === 'p-rd03' ? { ...p, id: 'p-bd03', sku: 'GG-BD03', name: 'Bulldogs Shirt', image: undefined } : { ...p, image: undefined }),
      { id: 'p-bg01', sku: 'GG-BDGL01', name: 'Golden Lions Bandana', category: 'bandanas', kind: 'bandana', price: 650, stock: 30, accent: '#f4bf00', accent2: '#20231a', description: 'Legacy bandana' },
    ]
    const orders = [{ id: 'existing-order', number: '#1028', createdAt: new Date().toISOString(), items: [], subtotal: 10, tax: 0.6, total: 10.6, paymentMethod: 'Cash' }]
    localStorage.setItem('gg-products-v2', JSON.stringify(legacy))
    localStorage.setItem('gg-orders-v1', JSON.stringify(orders))
    return { orders }
  })
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(page.locator('.product-card:visible')).toHaveCount(9)
    const saved = await page.evaluate(() => ({ products: JSON.parse(localStorage.getItem('gg-products-v2')!), orders: JSON.parse(localStorage.getItem('gg-orders-v1')!) }))
    expect(saved.products.some((p: any) => p.category === 'bandanas')).toBe(false)
    expect(saved.products.find((p: any) => p.id === 'p-gl01').stock).toBe(7)
    expect(saved.products.find((p: any) => p.id === 'p-rd03')?.image).toBe('/jerseys/red-dragon.png')
    expect(saved.orders).toEqual(before.orders)
  }
})

for (const payment of ['Cash', 'Online']) {
  test(`${payment} checkout prints only the complete receipt`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    // A larger catalog exercises multi-page receipts and scrolling without changing real data.
    await page.evaluate(() => {
      const products = JSON.parse(localStorage.getItem('gg-products-v2')!)
      const extra = Array.from({ length: 30 }, (_, i) => ({ ...products[0], id: `long-${i}`, sku: `LONG-${i}`, name: `Receipt item ${i + 1}` }))
      const all = [...products.filter((p: any) => p.stock > 0), ...extra]
      localStorage.setItem('gg-products-v2', JSON.stringify(all))
      localStorage.setItem('gg-cart-v1', JSON.stringify(all.map(p => ({ productId: p.id, quantity: 1 }))))
    })
    await page.reload()
    await page.locator('.mobile-cart-fab').click()
    if (payment === 'Online') {
      await page.locator('.payment-method').filter({ hasText: 'Online' }).click()
      await page.getByPlaceholder('Name shown on the account').fill('Test buyer')
      await page.getByPlaceholder('e.g. GC-2819-7712').fill('REF-123456')
      await page.getByRole('button', { name: 'Save payment', exact: true }).click()
    }
    await page.locator('.charge-button').click()
    const receipt = page.getByRole('dialog', { name: 'Receipt #1029' })
    await expect(receipt).toBeVisible()
    await expect(receipt.locator('.receipt-lines > div')).toHaveCount(39)
    await receipt.getByRole('button', { name: 'Print receipt' }).scrollIntoViewIfNeeded()
    expect(await receipt.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    await page.evaluate(() => {
      ; (window as any).__printCalls = 0
      window.print = () => { (window as any).__printCalls++ }
    })
    await receipt.getByRole('button', { name: 'Print receipt' }).click()
    expect(await page.evaluate(() => (window as any).__printCalls)).toBe(1)
    await page.emulateMedia({ media: 'print' })
    await expect(receipt).toBeVisible()
    await expect(page.locator('.main-column')).toBeHidden()
    await expect(page.locator('.checkout-panel')).toBeHidden()
    await expect(receipt.locator('.modal-actions')).toBeHidden()
    await expect(receipt.locator('.receipt-success')).toBeHidden()
    await expect(receipt.locator('.receipt-store')).toHaveText('Gee Graphics POS')
    await expect(receipt.locator('.receipt-breakdown')).toContainText('Subtotal₱25350.00Tax₱1521.00')
    await expect(receipt.locator('.receipt-total')).toContainText('₱26871.00')
    await expect(receipt.locator('.receipt-total')).toContainText(payment)
    if (payment === 'Online') await expect(receipt).toContainText('REF-123456')
    expect(await receipt.evaluate(el => ({ overflow: getComputedStyle(el).overflowY, maxHeight: getComputedStyle(el).maxHeight, color: getComputedStyle(el).color }))).toEqual({ overflow: 'visible', maxHeight: 'none', color: 'rgb(0, 0, 0)' })
    await page.screenshot({ path: testInfo.outputPath(`receipt-${payment}.png`), fullPage: true })
    await page.pdf({ path: testInfo.outputPath(`receipt-${payment}.pdf`), format: 'A4', preferCSSPageSize: true })
    await page.emulateMedia({ media: 'screen' })
    await receipt.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(receipt).toBeHidden()
    await page.reload()
    const saved = await page.evaluate(() => ({ orders: JSON.parse(localStorage.getItem('gg-orders-v1')!), cart: JSON.parse(localStorage.getItem('gg-cart-v1')!), products: JSON.parse(localStorage.getItem('gg-products-v2')!) }))
    expect(saved.orders).toHaveLength(1)
    expect(saved.orders[0].items).toHaveLength(39)
    expect(saved.cart).toEqual([])
    expect(saved.products[0].stock).toBe(9)
  })
}

test('Light mode switches all surfaces and persists across reload', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveClass(/light-mode/)
  await expect(page.locator('.app-shell')).toHaveClass(/light-mode/)
  const panelBg = await page.locator('.checkout-panel').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(panelBg).toBe('rgb(255, 255, 255)')
  await page.screenshot({ path: testInfo.outputPath('light-mode-desktop.png') })
  await page.reload()
  await expect(page.locator('.app-shell')).toHaveClass(/light-mode/)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('.app-shell')).not.toHaveClass(/light-mode/)
})

test('Test Print modal shows sample receipt, Pair BT Printer, Manual Print, and Cancel', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.evaluate(() => {
    ; (window as any).__btRequested = false
      ; (window as any).__printCalls = 0
    window.print = () => { (window as any).__printCalls++ }
    Object.defineProperty(navigator, 'bluetooth', {
      configurable: true,
      value: {
        requestDevice: async () => {
          ; (window as any).__btRequested = true
          return {
            name: 'MPT-II Thermal',
            addEventListener: () => { },
            gatt: {
              connect: async () => ({
                getPrimaryService: async () => ({
                  getCharacteristics: async () => [{
                    properties: { writeWithoutResponse: true },
                    writeValueWithoutResponse: async () => { (window as any).__btPrinted = true },
                  }],
                }),
              }),
              disconnect: () => { },
            },
          }
        },
      },
    })
  })
  const testPrintBtn = page.getByRole('button', { name: 'Test Print' })
  await expect(testPrintBtn).toBeVisible()
  await testPrintBtn.click()
  const modal = page.getByRole('dialog', { name: 'Test Print' })
  await expect(modal).toBeVisible()
  await expect(modal.locator('.test-print-preview')).toContainText('SAMPLE TEST PRINT')
  await expect(modal.locator('.test-print-preview')).toContainText('PRINTER ALIGNMENT OK')
  await expect(modal.getByRole('button', { name: /Pair BT Printer/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: /Manual Print/i })).toBeVisible()
  await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
  await page.waitForTimeout(260)
  await page.screenshot({ path: testInfo.outputPath('test-print-modal-light.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('test-print-modal-mobile.png') })
  await page.setViewportSize({ width: 1440, height: 900 })

  await modal.getByRole('button', { name: /Manual Print/i }).click()
  expect(await page.evaluate(() => (window as any).__printCalls)).toBe(1)

  await modal.getByRole('button', { name: /Pair BT Printer/i }).click()
  expect(await page.evaluate(() => (window as any).__btRequested)).toBe(true)
  await expect(modal).toContainText('MPT-II Thermal')
  await modal.getByRole('button', { name: /Send BT Test Print/i }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__btPrinted)).toBe(true)

  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(modal).toBeHidden()

  // Completing a sale while BT printer is connected auto-sends to BT and never opens window.print()
  await page.evaluate(() => { (window as any).__btPrinted = false; (window as any).__printCalls = 0 })
  await page.locator('.product-card').first().click()
  await page.locator('.size-option:not(:disabled)').first().click()
  await page.locator('.charge-button').click()
  const successModal = page.getByRole('status', { name: 'Payment successful' })
  await expect(successModal).toBeVisible()
  await expect(successModal).toContainText('Payment Successful')
  await expect(successModal).toBeHidden({ timeout: 3500 })
  await expect.poll(() => page.evaluate(() => (window as any).__btPrinted)).toBe(true)
  expect(await page.evaluate(() => (window as any).__printCalls)).toBe(0)
})

test('Online payment uploads receipt image to IndexedDB without typing and allows viewing proof in Orders', async ({ page }) => {
  await page.locator('.product-card').first().click()
  await page.locator('.size-option:not(:disabled)').first().click()
  await page.locator('.payment-method').filter({ hasText: 'Online' }).click()
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')
  await page.locator('#receipt-photo').setInputFiles({ name: 'gcash-proof.png', mimeType: 'image/png', buffer: pngBytes })
  await expect(page.locator('.receipt-thumb-bar img')).toBeVisible()
  await page.getByRole('button', { name: 'Save payment', exact: true }).click()
  await page.locator('.charge-button').click()
  const receipt = page.getByRole('dialog', { name: 'Receipt #1029' })
  await expect(receipt).toBeVisible()
  await expect(page.getByRole('status', { name: 'Payment successful' })).toHaveCount(0)
  await receipt.getByRole('button', { name: 'Close', exact: true }).click()
  const skipSuccess = page.getByRole('status', { name: 'Payment successful' })
  await expect(skipSuccess).toBeVisible()
  await expect(skipSuccess).toBeHidden({ timeout: 3500 })

  const storedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem('gg-orders-v1')!)[0])
  expect(storedOrder.onlinePayment.receiptImage).toMatch(/^idb:rcpt-/)

  await page.reload()
  await page.locator('.primary-nav').getByRole('button', { name: 'Orders', exact: true }).click()
  await page.getByRole('button', { name: 'Proof', exact: true }).click()
  const proofModal = page.getByRole('dialog', { name: 'Payment proof #1029' })
  await expect(proofModal).toBeVisible()
  const loaded = await proofModal.locator('img.proof-full-img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
  expect(loaded).toBe(true)
  await proofModal.getByRole('button', { name: 'Close', exact: true }).click()

  // Verify IndexedDB backup restores orders even if localStorage is cleared
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.locator('.primary-nav').getByRole('button', { name: 'Orders', exact: true }).click()
  await expect(page.locator('.orders-table')).toContainText('#1029')
  await page.screenshot({ path: 'test-results/orders-reports-merged.png', fullPage: true })
})
