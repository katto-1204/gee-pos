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
- [ ] Commit the reviewed changes, push normally to `https://github.com/katto-1204/gee-pos.git`, and verify the remote commit.

Prior verification for these changes: build passed and 10 Playwright tests passed.

Publication preparation: initialized Git only inside this project, configured the exact supplied origin, fetched `origin/main` at `8061a93`, and attached local main to that history without changing working files. Reviewed the diff and whitespace checks. Build output, dependencies, browser test output and temporary PDF tools are ignored. Push will be a normal history-preserving update.

## Print controls follow-up

- [ ] Reproduce each print entry point and identify missing behavior.
- [ ] Connect broken print controls while preserving sale/cart/inventory data.
- [ ] Verify affected flows, print layout, console/network health, existing Playwright suite and build.
- [ ] Document confirmed cause and hardware/browser verification limits.
