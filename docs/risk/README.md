# Risk & Complexity — Index

This directory contains the risk and complexity analysis for the Drift Arrow codebase, split into focused sub-documents.

- [Complexity Hotspots](complexity-hotspots.md) - Rankings of the most complex functions and classes by branching logic, state dependencies, and call depth
- [Integration Boundaries](integration-boundaries.md) - Analysis of coupling between subsystems and their interaction patterns
- [Mobile-Specific Risks](mobile-risks.md) - Touch input edge cases, viewport issues, performance concerns, audio quirks, and tab lifecycle on mobile
- [General Fragile Areas](fragile-areas.md) - Floating point issues, timing-dependent logic, state inconsistencies, missing checks, and math edge cases
- [Untested Surface Area](untested-surface.md) - What the test suite covers and the large areas of runtime code with no test coverage
- [External / Browser Dependencies](browser-dependencies.md) - Core browser APIs used, vendor-prefixed features, browser-specific risks, and missing modern CSS
