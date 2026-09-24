# Comment style

The rule: **a comment explains why, the code already says what.** If a comment
restates the line below it, delete the comment.

## Module headers

Every file under `server/`, `src/` and `shared/` opens with one. Where the
module turns on a decision, the header states it rather than describing the
contents:

```ts
/**
 * Environment parsing, validated once at boot with zod.
 *
 * Production refuses to start without a real `SECRET_KEY`, because that key
 * signs the voter cookies and hashes the IPs. Development mints a random one
 * per boot, which is why a dev restart logs everybody out.
 */
```

The second paragraph is the point. A reader can see that config is parsed; they
cannot see why their dev session keeps ending.

## Doc comments on exports

One line where one line is enough. More when a reader would otherwise have to
work something out, and in this codebase that usually means a threat model or a
network reality:

```ts
/**
 * The IP is hashed, never stored raw, and is deliberately NOT used as the
 * primary key: a hall full of people behind one NAT shares a single address, so
 * keying on IP would let the first voter lock everyone else out.
 */
```

```ts
/**
 * A generous ceiling: it never troubles a real voter, but it stops one script
 * hammering the endpoint. Real duplicate-vote prevention is the UNIQUE index on
 * (question_id, voter_id), not this limiter.
 */
```

Both record a decision that looks arbitrary until you know the reason.

## Comments inside a function

Reserved for a decision, a constraint or a trap:

```ts
// Behind a load balancer the client IP arrives in X-Forwarded-For. Trusting a
// fixed number of hops rather than `true` stops a client spoofing the header.
```

```ts
// Compressing an event stream makes frames sit in the encoder's buffer.
```

```ts
// Collected first, then dropped, so the tidy-up in `drop` cannot delete the
// channel out from under the loop that is still walking it.
```

## What is not written

- No narration: `// set the status` above a line that sets the status.
- No commented-out code. Git has it.
- No `// TODO` without a name and a reason.

## Plain ASCII

No em dashes, en dashes, arrows or dingbats anywhere: prose, code, JSX text,
interface strings or commit messages. Use `-`, `->` or rewrite. CI enforces it
over tracked files.

This is about the characters in the file, not the glyphs on screen. Two traps a
plain grep cannot see, both found in sibling repositories:

- An HTML entity for one of those characters is pure ASCII on disk and renders
  as exactly the character being removed. CI has a second grep for those. In
  JSX this matters more than usual, because an entity in text is easy to type.
- A coding font with ligatures draws `->` as a single arrow. Look at the
  rendered page, not only at the grep output.

## Tests

Test names are sentences: `a host reset frees a voter who already has the page
open`. Where a test exists because something was wrong, the file's header says
what was wrong, so nobody deletes it as redundant:

```ts
/**
 * A subscriber can leave two ways: the route's `close` handler calls the
 * disposer, or a write throws because the socket has gone. Those used to be
 * different code paths, and only the first cleaned up the channel.
 */
```

The end-to-end suite runs against `dist/server/server/index.js`, the real
production build, not the dev server. A test that only passes under Vite is not
testing what ships.
