# Lessons

- Receipt responsiveness must be checked against physical paper widths, including 58mm and 80mm rolls. Desktop/mobile preview alone does not prove thermal compatibility. Use driver-selected page size, margins that leave room for the print head, and wrapping totals/payment metadata; verify exported PDF geometry and long-content readability.

- Receipt print QA must check the entire printed page, including blank space below the receipt. Explicitly reset the `:root` background in print CSS; a white body alone does not override the app's dark root background. Inspect the exported PDF with background printing enabled.

- When asked to show all products, verify both display limits and catalog completeness. Compare available designs across related categories and check saved browser data. A test that renders every existing seed item does not prove the catalog contains every expected product.
- Do not invent product SKUs or stock quantities to fill missing catalog entries. Confirm which designs are expected when the repository has no source for them.
