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
  await expect(page.locator('.product-card')).toHaveCount(18)
  health.set(page, { errors, requests })
})

test.afterEach(async ({ page }) => {
  const { errors, requests } = health.get(page)!
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

for (const [width, height] of [[1440, 900], [1100, 768], [768, 1024], [390, 844], [360, 640]]) {
  test(`All category shows every item and scrolls at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await expect(page.locator('.product-card:visible')).toHaveCount(18)
    const workspace = page.locator('.main-column')
    await workspace.hover()
    await page.mouse.wheel(0, 3000)
    await expect.poll(() => workspace.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    await expect(page.locator('.product-card').last()).toBeInViewport()
    await page.locator('.product-card').last().click()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gg-cart-v1')!))).toEqual([])
    await page.locator('.product-card').filter({ hasText: 'Tigers Bandana' }).click()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gg-cart-v1')!))).toEqual([{ productId: 'p-bdtg05', quantity: 1 }])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`all-items-${width}.png`) })
    await page.locator('.filter-chips').getByRole('button', { name: 'Shirts', exact: true }).click()
    await expect(page.locator('.product-card:visible')).toHaveCount(9)
    await page.locator('.filter-chips').getByRole('button', { name: 'Bandanas', exact: true }).click()
    await expect(page.locator('.product-card:visible')).toHaveCount(9)
    for (const design of ['Wolves', 'Fox', 'Panthers', 'Phoenix']) {
      await expect(page.locator('.product-card').filter({ hasText: `${design} Bandana` })).toBeVisible()
    }
    await page.locator('.filter-chips').getByRole('button', { name: 'All', exact: true }).click()
    await page.getByPlaceholder('Search products...').fill('Tigers')
    await expect(page.locator('.product-card:visible')).toHaveCount(2)
    await page.getByPlaceholder('Search products...').fill('no matching item')
    await expect(page.locator('.product-card')).toHaveCount(0)
    await page.getByPlaceholder('Search products...').fill('')
    await expect(page.locator('.product-card:visible')).toHaveCount(18)
  })
}

test('All includes bandanas beyond the original five-item limit', async ({ page }) => {
  await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('gg-products-v2')!)
    products.push({ ...products.find((p: any) => p.category === 'bandanas'), id: 'extra-bandana', sku: 'EXTRA', name: 'Extra Bandana' })
    localStorage.setItem('gg-products-v2', JSON.stringify(products))
  })
  await page.reload()
  await expect(page.locator('.product-card:visible')).toHaveCount(19)
  await expect(page.locator('.product-card').last()).toContainText('Extra Bandana')
})

test('Legacy saved catalogs gain missing designs without overwriting saved data or duplicating products', async ({ page }) => {
  const before = await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('gg-products-v2')!)
    const legacy = products.filter((p: any) => !['p-bdwv06', 'p-bdfx07', 'p-bdpn08', 'p-bdph09'].includes(p.id))
    legacy[0].stock = 7
    const phoenix = { ...products.find((p: any) => p.id === 'p-bdph09'), stock: 3 }
    const custom = { ...legacy[9], id: 'custom-bandana', sku: 'CUSTOM-BD', name: 'Custom Bandana', stock: 2 }
    const cart = [{ productId: legacy[0].id, quantity: 2 }]
    const orders = [{ id: 'existing-order', number: '#1028', createdAt: new Date().toISOString(), items: [], subtotal: 10, tax: 0.6, total: 10.6, paymentMethod: 'Cash' }]
    localStorage.setItem('gg-products-v2', JSON.stringify([...legacy, phoenix, custom]))
    localStorage.setItem('gg-cart-v1', JSON.stringify(cart))
    localStorage.setItem('gg-orders-v1', JSON.stringify(orders))
    return { cart, orders }
  })
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(page.locator('.product-card:visible')).toHaveCount(19)
    const saved = await page.evaluate(() => ({ products: JSON.parse(localStorage.getItem('gg-products-v2')!), cart: JSON.parse(localStorage.getItem('gg-cart-v1')!), orders: JSON.parse(localStorage.getItem('gg-orders-v1')!) }))
    expect(new Set(saved.products.map((p: any) => p.id)).size).toBe(19)
    expect(saved.products.find((p: any) => p.id === 'p-gl01').stock).toBe(7)
    expect(saved.products.find((p: any) => p.id === 'p-bdph09').stock).toBe(3)
    expect(saved.products.find((p: any) => p.id === 'custom-bandana').stock).toBe(2)
    expect(saved.cart).toEqual(before.cart)
    expect(saved.orders).toEqual(before.orders)
  }
})

test('New bandana stock can be entered and sold through the existing product editor', async ({ page }) => {
  await page.locator('.primary-nav').getByRole('button', { name: 'Products', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Phoenix Bandana', exact: true }).click()
  await page.getByLabel('Stock on hand').fill('3')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.locator('.primary-nav').getByRole('button', { name: 'Home', exact: true }).click()
  await page.getByPlaceholder('Search products...').fill('Phoenix Bandana')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.locator('.product-card')).toContainText('3 in stock')
  await page.locator('.product-card').click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gg-cart-v1')!))).toEqual([{ productId: 'p-bdph09', quantity: 1 }])
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
    await expect(receipt.locator('.receipt-lines > div')).toHaveCount(44)
    await receipt.getByRole('button', { name: 'Print receipt' }).scrollIntoViewIfNeeded()
    expect(await receipt.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    await page.evaluate(() => {
      ;(window as any).__printCalls = 0
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
    await expect(receipt.locator('.receipt-breakdown')).toContainText('Subtotal₱28600.00Tax₱1716.00')
    await expect(receipt.locator('.receipt-total')).toContainText('₱30316.00')
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
    expect(saved.orders[0].items).toHaveLength(44)
    expect(saved.cart).toEqual([])
    expect(saved.products[0].stock).toBe(23)
  })
}
