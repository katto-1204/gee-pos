import { test, expect } from '@playwright/test'

for (const paper of [58, 80, 210]) {
  for (const long of [false, true]) {
    test(`${paper}mm paper fits ${long ? 'long names and a multi-page order' : 'a standard receipt'}`, async ({ page }, testInfo) => {
      const errors: string[] = []
      const failures: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
      page.on('requestfailed', request => failures.push(request.url()))
      page.on('response', response => { if (response.status() >= 400) failures.push(response.url()) })
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
      await page.goto('/')
      await page.evaluate((long) => {
        const products = JSON.parse(localStorage.getItem('gg-products-v2')!)
        const selected = long ? products.map((product: any, index: number) => ({ ...product, stock: 9999, name: `Thermal item ${index + 1} — ${'VeryLongDesignName'.repeat(3)}`, sku: 'LONGSKU'.repeat(8) })) : products
        localStorage.setItem('gg-products-v2', JSON.stringify(selected))
        localStorage.setItem('gg-cart-v1', JSON.stringify((long ? selected : selected.slice(0, 2)).map((p: any) => ({ productId: p.id, quantity: long ? 222 : 1 }))))
        if (long) localStorage.setItem('gg-settings-v2', JSON.stringify({ storeName: 'Gee Graphics Independent Design Store', receiptFooter: 'Thank you for supporting independent graphics.\nPlease keep this receipt for your records.' }))
      }, long)
      await page.reload()
      await page.locator('.payment-method').filter({ hasText: 'Online' }).click()
      await page.getByPlaceholder('Name shown on the account').fill(long ? 'CustomerAccount'.repeat(5) : 'Test buyer')
      await page.getByPlaceholder('e.g. GC-2819-7712').fill(long ? 'REFERENCE'.repeat(8) : 'THERMAL-123')
      await page.getByRole('button', { name: 'Save payment', exact: true }).click()
      await page.locator('.charge-button').click()
      const receipt = page.getByRole('dialog', { name: 'Receipt #1029' })
      await expect(receipt).toBeVisible()
      await expect(receipt.locator('.receipt-lines > div')).toHaveCount(long ? 18 : 2)
      // Print layout viewport models the printable width after the five-millimetre paper margins.
      const printableWidth = Math.floor((paper - 10) * 96 / 25.4)
      await page.setViewportSize({ width: printableWidth, height: 900 })
      await page.emulateMedia({ media: 'print' })
      const overflow = await receipt.evaluate(root => {
        const bounds = root.getBoundingClientRect()
        return Array.from(root.querySelectorAll('*')).filter(el => {
          const rect = el.getBoundingClientRect()
          return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || el.scrollWidth > el.clientWidth + 1)
        }).map(el => el.className || el.tagName)
      })
      await page.screenshot({ path: testInfo.outputPath('print-layout.png'), fullPage: true })
      await page.pdf({ path: testInfo.outputPath('receipt.pdf'), width: `${paper}mm`, height: paper === 210 ? '297mm' : '240mm', printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true })
      expect(overflow).toEqual([])
      expect(await receipt.locator('.receipt-amount > span').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(25)
      await expect(receipt.locator('.modal-actions')).toBeHidden()
      await expect(receipt.locator('.receipt-success')).toBeHidden()
      expect(errors).toEqual([])
      expect(failures).toEqual([])
    })
  }
}
