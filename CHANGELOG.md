# Changelog

All notable changes to this package are listed here. It follows [Semantic Versioning](https://semver.org/).

## 0.1.0 (2026-11-08)

The first release.

- `<Analytics />` for Next.js (`@borromic/analytics/next`, App Router and Pages Router) and React (`@borromic/analytics/react`), and `inject()` for any other site: page views, client-side navigations included.
- `track(name, data)` in the browser, and on the server from `@borromic/analytics/server`.
- `<WebVitals />` and `watchWebVitals()`: LCP, CLS, INP, FCP and TTFB, reported once as the page is hidden.
- `<OptOut />`, `optOut()`, `optIn()` and `isOptedOut()`: a visitor's way to object, kept in sync across tabs.
- A plain-script build, `dist/script.js`, configured by its tag's data attributes.
- No cookies and nothing stored in the browser but a visitor's opt-out; Do Not Track and Global Privacy Control respected by default; paths cleaned of emails and tokens, query reduced to `utm_*` tags, referrer reduced to its host.
- Events sent in batches of 20 at most, with a beacon as the page is hidden, as plain text so no preflight request is needed.
- Options: `siteKey`, `endpoint`, `respectDoNotTrack`, `beforeSend`, `debug`, with `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY` and `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT` as defaults.
