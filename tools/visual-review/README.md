# Visual review capture tooling

This standalone tooling serves the repository read-only on an automatically assigned loopback port, launches an isolated headless Chrome profile, and stores WebP captures plus manifests beneath the system temporary directory. It does not use Firebase Hosting, GitHub Pages, production Function URLs, or browser profiles.

`capture.cjs --preset smoke` captures six high-signal states. `capture.cjs --preset sections` captures the eight site sections at 390×844, 1024×768, and 1366×768 (24 captures). It waits for fonts and two animation frames and validates selectors, sticky header positioning, horizontal overflow, browser errors, and production URL requests.
