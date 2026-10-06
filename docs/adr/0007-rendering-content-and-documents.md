# ADR 0007: Public projections, rendering and document generation

Status: ACCEPTED TECHNICAL DEFAULT, 2026-10-06 under approved gates; exact package APIs remain installation checks.

Decision: shared public catalog projection drives server HTML/metadata/JSON-LD; Cache Components with explicit tags/invalidation, dynamic filtered results and private uncached commerce. Separate store/admin root layouts. Cart/wishlist resolve fresh facts and checkout ignores public cache.

Structured validated product blocks and Cloudinary role-specific media; no arbitrary executable HTML. Homepage blocks remain undecided. Invoice renderer later uses @react-pdf/renderer on Node and private artifacts from immutable snapshots; no headless Chromium in invoice runtime.

Alternatives: CSR-only harms primary content delivery; blanket ISR misstates request-dependent filters; untagged caches drift; manual PDF coordinates complicate pagination. pdf-lib/pdfmake remain renderer alternatives if compatibility fails.

Consequences: invalidation includes old/new relationships and durable retry; VPS cache coordination must be verified for multiple replicas. Changing renderer is moderate cost if snapshots stay stable; changing cache APIs requires compatibility verification, not financial-model changes.
