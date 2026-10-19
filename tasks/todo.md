# PWA conversion task

- [ ] Verify existing PWA scaffold and identify missing installability gaps
- [ ] Implement any missing PWA behavior for standalone install and offline reliability
- [ ] Validate the build and confirm the app serves as a proper PWA

# Receipt printing and complete catalog

- [x] Reproduce receipt printing and catalog scrolling failures in the browser.
- [x] Fix receipt print layout so only the complete receipt prints.
- [x] Show every matching product in All Category and keep the catalog scrollable at desktop, tablet, and mobile sizes.
- [x] Verify checkout, receipt printing, category/search behavior, scrolling, console/network health, and production build.

## Review

- Catalog browser reproduction: 12 visible cards out of 14 at 1100px. Removed the CSS rule hiding fifth cards and the bandana five-item slice.
- Printing diagnosis: the original print stylesheet hid the receipt's modal ancestor. Print now shows only the receipt with store, sale/date, item details, subtotal, tax, total, payment and footer; long receipts scroll on screen and paginate on paper.
- `npm run build`: passed.
- `npx playwright test`: 8 passed. Covered 1440, 1100, 768, 390 and 360px widths, wheel scrolling to the final item, add to cart, categories, search/no matches, an additional sixth bandana, and cash/online checkout with 44 items.
- Checked print-button invocation, receipt-only print CSS, persisted sale/cart/inventory state, and no application console errors/warnings or failed requests. Google Fonts was stubbed to the system fallback because sandbox network access blocks it.
- Generated cash and online PDFs, verified all receipt text and footer across three pages each, and visually inspected print output and mobile catalog screenshots under `test-results/`.
- Added the existing store icon as favicon to eliminate a 404 found during browser verification.
- Physical printer output and native printer-driver settings were not tested. No real store data was changed; tests use isolated browser contexts.

## Follow-up: missing bandana catalog entries

- [x] Inspect the actual catalog after user reports only five bandanas.
- [x] Confirm `src/data.ts` defines nine shirts but only five bandanas; no other bandana records exist in the project.
- [x] Confirm whether Wolves, Fox, Panthers, and Phoenix are the missing designs.
- [x] Add confirmed missing products and migrate existing saved catalogs without overwriting stock, orders, or custom products.
- [x] Verify complete bandana catalog in All and Bandanas, scrolling, and existing-data preservation with Playwright.

The user confirmed all nine designs. Add the four missing products to both fresh and saved catalogs, preserving existing data. New designs start at zero stock because quantities have not been supplied.

### Follow-up verification

- `npm run build`: passed.
- `npx playwright test`: 10 passed, including all 18 items / nine bandanas at five viewport sizes; the four newly confirmed designs; legacy catalog migration and repeated reloads without duplicates; saved stock, custom products, cart and order preservation; stock editing and adding a new design to the cart; cash and online receipt regressions.
- Visually checked the updated mobile catalog screenshot. New designs are visible at zero stock; the existing stock limit prevents selling until quantities are entered in Products → Edit.
- No app console warnings/errors or failed requests in the browser suite. Google Fonts uses the same test fallback described above. Physical printer output was not retested.

## Publish to the original repository

- [x] Verify local repository boundary, remote ownership/access, and current default branch/history.
- [x] Compare local fixes with the original repository and preserve upstream work.
- [x] Commit the reviewed changes, push normally to `https://github.com/katto-1204/gee-pos.git`, and verify the remote commit.

Prior verification for these changes: build passed and 10 Playwright tests passed.

Publication preparation: initialized Git only inside this project, configured the exact supplied origin, fetched `origin/main` at `8061a93`, and attached local main to that history without changing working files. Reviewed the diff and whitespace checks. Build output, dependencies, browser test output and temporary PDF tools are ignored. Push will be a normal history-preserving update.

Publication result: pushed implementation commit `0db4625` to the original repository's `main` with a normal fast-forward push and verified GitHub's remote tip. Preserved the original React versions in both lockfiles. Build and 10 browser tests passed for the implementation; no deployment or physical-printer verification was performed.

## Print controls follow-up

- [x] Reproduce each print entry point and identify missing behavior.
- [x] Connect the current-sale print control while preserving sale/cart/inventory data.
- [x] Redesign the receipt preview and paper layout; remove the dark root background from print output.
- [x] Verify affected flows, print layout, console/network health, existing Playwright suite and build.
- [x] Document confirmed cause and hardware/browser verification limits.

Scope updated after the supplied receipt screenshot: prioritize receipt design and receipt printing. The separate Reports print control is outside this receipt change.

### Receipt redesign review

- Reproduced the black print background before editing: computed print `html` background was `rgb(10, 10, 11)`. The `:root` dark background beat the old `html` print selector. Explicitly reset the root and paper backgrounds to white.
- Replaced the oversized dark modal receipt styling with a white paper preview, Gee Graphics wordmark, sale/date/time metadata, aligned item amounts, quantity/unit-price/SKU details, subtotal/tax, a clear total, payment method/provider/reference and footer. Preserved the configured store name/footer and order data.
- Connected the previously inert cart printer icon to an explicitly unpaid preview. Empty carts show feedback. Preview/printing does not charge the customer, clear the cart or decrement inventory.
- `npm run build`: passed. `npx playwright test --workers=2`: 12 passed. Checked desktop and 390/360px receipt previews, cash/online checkouts, 44-item receipts, print invocation, unpaid preview data preservation, catalog regressions, application console/network health. Google Fonts used the test system-font fallback.
- Exported and inspected the actual PDFs: the two-item receipt fits one A4 page; both 44-item cash/online receipts paginate over four pages with every item, totals and footer present. Rendered the standard receipt and online final page for visual inspection. Verified unused paper below every footer is white, including with background printing enabled.
- Physical printers and native driver settings were not tested. Browser-added headers/footers are controlled by the user's print dialog. Deployment was not verified.

## Thermal receipt printing

- [x] Reproduce receipt output on 58mm and 80mm paper and identify overflow/margin problems.
- [x] Adapt receipt layout to printer paper width with safe thermal margins and readable narrow-paper typography, preserving the existing design and checkout data.
- [x] Verify 58mm, 80mm and A4 PDF output, long receipts and long names/references, mobile preview, browser console/network health, existing browser suite and production build.
- [ ] Review the diff, commit, push to the verified original repository and confirm the remote commit.

Browser printing uses the paper configured in the native print dialog; the app cannot silently enumerate or select installed printers. Keep paper selection in that dialog and make the receipt fit its selected printable width.

### Thermal verification review

- Reproduced unreadable total labels on 58mm paper: the large-total label wrapped to 81px high. The new regression checks require a readable single-line label and no horizontal overflow.
- Changed page margins from 10mm to 5mm and explicitly use the driver's page size. A 58mm roll now has 48mm for receipt content. The print layout uses its actual printable container width to compact branding/spacing and total typography; long payment metadata and totals wrap safely.
- Added short print-dialog instructions to the receipt preview and README. Printing controls/instructions are excluded from paper output; existing checkout and unpaid-preview persistence are unchanged.
- Production build passed. All 18 Playwright tests passed, including cash/online receipts, mobile previews and six physical-paper scenarios. After correcting the A4 test export to full 210×297mm, the six thermal/A4 tests passed again. No application console warnings/errors or failed requests; Google Fonts uses the existing test fallback.
- Inspected actual PDF dimensions and text geometry for 58mm, 80mm and A4. Standard receipts fit one page. The deliberately extreme 18-product / 3,996-unit orders paginate across five 58mm pages, four 80mm pages and three A4 pages at the tested page lengths. All item names, totals, long account/reference details and footer survived; unused paper stayed white. Visually inspected 58mm standard/final pages and the 80mm standard page.
- Physical thermal printer, roll feed/cutter, printer-specific settings, mobile OS print services and live deployment were not tested. Paper length follows the printer driver's configuration; the app does not invent a roll length or silently select a device.
