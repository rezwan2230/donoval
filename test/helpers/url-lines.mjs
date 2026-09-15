// Match a URL as a WHOLE TOKEN, never as a substring.
//
// A containment check for the configured join link is equally satisfied by
// "<that link>.attacker.example", so a substring test against a URL literal
// proves less than it reads like — which is why CodeQL flags the shape wherever
// it appears (js/incomplete-url-substring-sanitization), assertions included.
//
// The fact these suites actually want is stronger than containment anyway: the
// join link stands ON ITS OWN in the description Clio emails verbatim to the
// client — a complete whitespace-delimited token on exactly one line — rather
// than being spelled somewhere inside a longer string. Everything below compares
// with `===`, so a longer URL that merely begins with the expected one no longer
// satisfies the check.

import assert from 'node:assert/strict';

/**
 * The trimmed lines of `text` that carry `url` as a complete whitespace-delimited
 * token — i.e. the whole line, or one whole word of it.
 */
export function linesCarryingUrl(text, url) {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.split(/\s+/).some((token) => token === url));
}

/** True when exactly one line of `text` carries `url` as a whole token. */
export function carriesUrlOnce(text, url) {
  return linesCarryingUrl(text, url).length === 1;
}

/**
 * assert-flavoured {@link carriesUrlOnce}. Prints the text on failure, because a
 * description that lost its join line is worth reading in full.
 */
export function assertCarriesUrl(text, url, message) {
  const lines = linesCarryingUrl(text, url);
  assert.equal(
    lines.length,
    1,
    `${message}\nExpected exactly one line carrying "${url}" as a whole token.\nGot:\n${text}`,
  );
}
