# @borromic/analytics

Privacy-friendly web analytics for any website: page views, custom events and web vitals, sent to Borromic with no cookies.

[![npm](https://img.shields.io/npm/v/@borromic/analytics)](https://www.npmjs.com/package/@borromic/analytics)
[![license](https://img.shields.io/npm/l/@borromic/analytics)](./LICENSE)

- **One line to add**, in Next.js, React or any page, with route changes counted on their own.
- **No cookies, nothing stored** in the browser, and no IP address kept on the server.
- **Respects Do Not Track** and Global Privacy Control, and gives visitors a way to opt out.
- **Small**: about 2 KB gzipped, no dependencies, events sent in batches with a beacon as the page closes.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Custom events](#custom-events)
- [Web vitals](#web-vitals)
- [Opt-out](#opt-out)
- [Configuration](#configuration)
- [What is collected, and what isn't](#what-is-collected-and-what-isnt)
- [Moving from Trailic](#moving-from-trailic)
- [License](#license)

## Install

```bash
npm install @borromic/analytics
```

```bash
pnpm add @borromic/analytics
```

```bash
yarn add @borromic/analytics
```

Each website has its own **site key**. In Borromic, open the website's page: an Admin gives it a site key there, and the page shows it. The key is public: it ends up in every page of the site.

## Quick start

### Next.js (App Router)

Add the component once, in the root layout:

```tsx
// app/layout.tsx
import { Analytics } from "@borromic/analytics/next";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

and set the site key in the environment:

```bash
NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY=YOUR_SITE_KEY
```

That counts every page view, client-side navigations included. Without a key, the component does nothing, so set the variable only for production if previews and local runs shouldn't be counted.

### Next.js (Pages Router)

```tsx
// pages/_app.tsx
import type { AppProps } from "next/app";
import { Analytics } from "@borromic/analytics/next";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
```

### React

With Vite, Remix, React Router or any other React app, pass the key yourself:

```tsx
import { Analytics } from "@borromic/analytics/react";

export function App() {
  return (
    <>
      <Routes />
      <Analytics siteKey={import.meta.env.VITE_BORROMIC_ANALYTICS_KEY} />
    </>
  );
}
```

### Any other site

With a bundler but no React, call `inject` once, in code that runs in the browser:

```ts
import { inject } from "@borromic/analytics";

inject({ siteKey: "YOUR_SITE_KEY" });
```

### Plain script

With no build step at all, load the script and give it the key as a data attribute:

```html
<script
  defer
  src="https://cdn.jsdelivr.net/npm/@borromic/analytics@0.1/dist/script.js"
  data-site-key="YOUR_SITE_KEY"
></script>
```

The tag also takes `data-endpoint`, `data-web-vitals` (to report web vitals), `data-respect-do-not-track="false"` and `data-debug`. Events are recorded with `window.borromicAnalytics.track(name, data)`.

## Custom events

### In the browser

```ts
import { track } from "@borromic/analytics";

track("signup", { plan: "pro", seats: 3 });
```

`track` takes a name and, optionally, flat data: strings, numbers, booleans and `null`. Names are cut at 100 characters, data at 20 keys of 50 characters, and text values at 200 characters. It never throws, and does nothing on the server or before the page has a site key: what is recorded before `<Analytics />` starts is kept and sent once it does.

Only send what you would be comfortable showing to the visitor: never an email address, a name or anything else that identifies a person.

### On the server

From a route handler, a server action or any Node.js code:

```ts
import { track } from "@borromic/analytics/server";

export async function POST(request: Request) {
  // …
  await track("payment", { amount: 49, currency: "EUR" });
  return Response.json({ ok: true });
}
```

It answers whether the collector kept the event, waits 2 seconds at most, and never throws. It reads `BORROMIC_ANALYTICS_KEY`, then `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`; pass `{ siteKey, endpoint, timeoutMs }` as a third argument to override. A server event has no visitor, page or country.

## Web vitals

Add the component next to `<Analytics />`:

```tsx
import { WebVitals } from "@borromic/analytics/vitals";

<WebVitals />;
```

It reports the page's Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), Interaction to Next Paint (INP, the slowest interaction), First Contentful Paint (FCP) and Time to First Byte (TTFB), once, when the page is hidden or closed. It uses the browser's own performance entries, so it adds no library, and a browser that doesn't measure one of them simply doesn't report it. Without React, call `watchWebVitals()` from `@borromic/analytics`.

## Opt-out

Give visitors a way to object, typically on your privacy page:

```tsx
import { OptOut } from "@borromic/analytics/opt-out";

<p>
  We count visits with no cookies. <OptOut />
</p>;
```

It renders a button that reads like a link ("Stop measuring my visits", then "Measure my visits again"); pass `stop` and `resume` for your own words, and `className` to style it as you like. Once a visitor opts out, nothing more is sent from their browser, in any tab; their choice is the only thing ever written there (in `localStorage`).

Without React, use the functions:

```ts
import { isOptedOut, optIn, optOut } from "@borromic/analytics";
```

## Configuration

### Options

`<Analytics />` and `inject()` take the same options, all optional:

| Option              | Default                                                              | What it does                                                                    |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `siteKey`           | `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`                                 | The website's key, from its page in Borromic. Without one, nothing is measured. |
| `endpoint`          | `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT`, then Borromic's collector | Where events are sent.                                                          |
| `respectDoNotTrack` | `true`                                                               | Sends nothing when the browser says Do Not Track or Global Privacy Control.     |
| `beforeSend`        | none                                                                 | Changes an event before it leaves the browser, or drops it by returning `null`. |
| `debug`             | `false`                                                              | Logs to the console what is sent, and why nothing is.                           |

```tsx
<Analytics
  beforeSend={(event) => {
    if (event.path.startsWith("/admin")) return null;
    return event;
  }}
/>
```

An event, as `beforeSend` sees it, is `{ kind, path, referrer?, name?, data?, value? }`, where `kind` is `"pageview"`, `"event"` or `"vital"`.

### Environment variables

| Variable                                  | Read by                                              | What it holds                                     |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`      | `<Analytics />`, `inject()`, `track()` on the server | The website's site key.                           |
| `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT` | the same                                             | Another collector's address. Rarely needed.       |
| `BORROMIC_ANALYTICS_KEY`                  | `track()` on the server                              | The site key, when the server should use its own. |
| `BORROMIC_ANALYTICS_ENDPOINT`             | `track()` on the server                              | Another collector's address, for the server.      |

Next.js writes `NEXT_PUBLIC_` variables into the page when it builds it, so a change needs a new deployment. Other frameworks pass `siteKey` explicitly.

### Content Security Policy

If your site sets a `connect-src` directive, allow the collector's origin, `https://app.borromic.com`, or the `endpoint` you set.

## What is collected, and what isn't

What leaves the browser:

- **the page's path**, with its query reduced to `utm_*` campaign tags. Path segments that look like an email address or a token (a uuid, a long id or hash) are replaced by `[email]` and `[token]`;
- **the site the visitor came from**, as a host name only (`news.example.org`), on the first page view of a visit, and only when it's another site;
- **the custom events you record**, with their data;
- **web vitals**, if you add `<WebVitals />`;
- how long ago each event happened, in milliseconds, so the visitor's clock never matters.

What doesn't:

- **no cookies**, no `localStorage` or `sessionStorage`, and no identifier of any kind in the browser. The only thing ever written is a visitor's own opt-out;
- **no IP address is stored.** The collector reads the request's address only to count distinct visitors per day, as a one-way hash salted with a key that changes every day, so the same person can't be followed from one day to the next or from one website to another; the address itself is dropped once that hash is made. The country comes from the request's headers;
- nothing at all from a browser that says Do Not Track or Global Privacy Control (unless you turn `respectDoNotTrack` off), or from a visitor who opted out.

How it sends: events wait in a small queue and leave together, two seconds after the first one or as soon as ten are waiting, and with `navigator.sendBeacon` as the page is hidden or closed, so the last page view isn't lost. The body is plain text, which a browser can post to another site without a preflight request. Measuring never gets in the page's way: every call swallows its own errors, and the page paints the same whether the collector answers or not.

## Moving from Trailic

A site that used the `trailic` package moves in three steps: replace the dependency, rename the imports, and rename the environment variables.

```bash
npm uninstall trailic
npm install @borromic/analytics
```

| Before (`trailic`)                                                            | After (`@borromic/analytics`)                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `import { Trailic } from "trailic"`, `<Trailic siteKey endpoint />`           | `import { Analytics } from "@borromic/analytics/next"`, `<Analytics />` (`siteKey` and `endpoint` are optional) |
| `import { track, type Traits } from "trailic"`                                | `import { track, type EventData } from "@borromic/analytics"`                                                   |
| `import { TrailicOptOut } from "trailic/opt-out"`                             | `import { OptOut } from "@borromic/analytics/opt-out"`, with the same `stop` and `resume` props                 |
| `import { TrailicVitals } from "trailic/vitals"`                              | `import { WebVitals } from "@borromic/analytics/vitals"`                                                        |
| `import { trackServer } from "trailic/server"`                                | `import { track } from "@borromic/analytics/server"` (no `userId`)                                              |
| `identify`, `reset`, `setConsent`, and the relay or rewrite of `trailic/next` | No equivalent: nothing identifies a visitor, so there is nothing to consent to or reset.                        |
| `NEXT_PUBLIC_TRAILIC_KEY`                                                     | `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`, with the key from the website's page in Borromic                          |
| `NEXT_PUBLIC_TRAILIC_ENDPOINT`                                                | Remove it, or set `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT` to use another collector                            |
| `TRAILIC_SITE_KEY`, `TRAILIC_ENDPOINT`                                        | `BORROMIC_ANALYTICS_KEY`, `BORROMIC_ANALYTICS_ENDPOINT`                                                         |

A component that rendered `<Trailic />` only when both variables were set can render `<Analytics />` as it is: without a key, it does nothing.

## License

[MIT](./LICENSE)
