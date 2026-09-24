# not_for_you.md

A personal working log. Nothing here is needed to run or contribute to VoteArena;
[README.md](README.md) and [DEVDOC.md](DEVDOC.md) cover that.

---

## The overhaul pass, 2026-09-24

This one is the best-defended repository in the job so far, and the defences are
the right ones rather than the fashionable ones. A few worth naming, because most
of this pass was reading rather than changing:

- `trust proxy` is a **hop count**, not `true`, with a comment saying that `true`
  lets a client spoof `X-Forwarded-For`.
- Compression is disabled for `text/event-stream`, because otherwise frames sit
  in the encoder's buffer.
- The IP is hashed and deliberately **not** the identity key, because a hall
  behind one NAT would let the first voter lock out the room.
- The rate limiter's docblock says outright that it is not the duplicate-vote
  defence; the `UNIQUE (question_id, voter_id)` index is, and the race is caught
  and turned into the same 409.
- The Playwright suite runs against `dist/server/server/index.js`, so it tests
  the production build and the real static-file handling rather than Vite.

So: one real bug, and it took a while to find.

### A channel that outlived everyone on it

`EventHub` removes a subscriber two ways. The route's `close` handler calls the
disposer returned by `subscribe`, which deletes the subscriber, deletes the
channel if it was the last one, clears the channel's pending frames and flush
timer, and stops the keepalive interval when no channels remain.

The other way is a write that throws, in `emit`:

```ts
catch {
  set.delete(sub);
}
```

That deletes the subscriber and nothing else. A channel that lost every
subscriber to socket errors was left behind as an empty `Set`, still holding its
pending map and its flush timer, and because `channels.size` was still non-zero
the keepalive interval kept firing every 25 seconds forever, iterating channels
with nobody on them.

Proved it with a fake response whose `write` throws: subscriber count 0, channel
still tracked, keepalive still running.

The fix is not "add the cleanup to the catch block", it is to make both paths the
same path. `drop(code, sub)` now does the tidy-up and the disposer is one line
that calls it. The bug existed because there were two places that had to agree,
and only one of them knew the full story.

One wrinkle while writing it: the dead subscribers are collected into an array
and dropped after the loop, because `drop` can delete the channel's `Set` and
doing that while `for...of` is still walking it is asking for trouble.

### Two advisories, neither of them this repo's fault

`qs` (moderate, production) reaches the tree only through express, which pins an
affected range. `js-yaml` (high, dev) reaches it only through eslint's
`@eslint/eslintrc`. Neither is imported directly by anything here.

`js-yaml` was the more interesting one: the advisory range is `4.0.0 - 4.3.1`,
and the latest is `5.2.1`. Overriding a transitive dependency of eslint across a
major version to fix a dev-only DoS would be a poor trade, so I checked the 4.x
line first and found `4.3.2`, the patched release in the same major. Both are
`overrides` in package.json now, and the audit is clean at every severity.

### Documenting 35 files nobody had documented

Every file under `server/`, `src/` and `shared/` lacked a module header, while
the functions inside them had some of the best docblocks in the whole job. So the
headers were the gap, and writing them meant reading each file properly rather
than pattern-matching a description out of the filename. `config.ts` earns its
three lines: production refuses to boot without a real `SECRET_KEY`, development
mints a random one per boot, and that is why a dev restart logs everybody out.

### The capture fight, round two

Same shape as Trendify: `X-Frame-Options`, `frame-ancestors 'none'`, and a
`script-src 'self'` CSP that blocks the harness's inline script. Both correct,
both stay. Captured through the throwaway proxy.

Three things cost me time, all mine:

**The proxy could not do SSE.** It read the whole upstream response before
relaying it, and an event stream never reaches EOF, so the subscription hung and
the wall rendered its empty state: *"0 VOTES IN, no answers on this question
yet."* I had 39 ballots in the database and a `hello` frame on the wire proving
the server was right, and the page still showed nothing. That looks exactly like
an application bug, and I nearly wrote it up as one. The proxy now relays
`text/event-stream` chunk by chunk, and it is in the skill's scripts so the next
SSE app does not cost the same hour.

**The app caches static files for an hour**, and `__capture.html` is a static
file. Repointing the harness and rebuilding changed nothing, because the browser
kept serving the old copy out of cache, so I captured the wall three times while
believing I was capturing the voter screen. A `?v=N` on the navigation was enough;
the harness no longer reads its query string, so the parameter is inert.

**I nearly reported a legibility bug that is not one.** On the wall, a label
longer than its bar runs past the end of it, and in the JPEG the overflow looked
dark-on-dark. Measuring found two layered copies of every label: a dark one
clipped to the bar, and a light one underneath showing wherever the bar does not
reach. The design already handles exactly this case. Reading pixels off a
compressed screenshot is not evidence; reading the DOM is.

### No light README

The app is `color-scheme: dark` with one palette and no `prefers-color-scheme`
anywhere, which is right for a projector in a dim room. Generating a
`README-light.md` would produce the same screenshots under a different filename
and a toggle line pointing at a page that is not different. So there is one
gallery, the README says why, and the CI job that would have checked the pair
checks the images exist instead.

### Left undone

The tablet screenshot. The Chrome extension disconnected between the mobile
console capture and the tablet one, and the skill says to ask rather than reach
for another tool. Five captures were already in: wall, voter and console at
1440x900, and voter and console at 390px. Not worth blocking the repository over.

### Smaller things

- No CI at all. Five jobs now.
- No LICENSE. MIT, 2025, the year of the first commit.
- Three arrows in DEVDOC's prose.
- `@vitest/coverage-v8` was not installed, so a coverage floor was not even
  expressible.
- eslint was linting the generated `coverage/` directory and reporting warnings
  about istanbul's own bundled scripts. Added to the ignore list, and `coverage/`
  to `.gitignore`.
