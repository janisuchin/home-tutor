import { expect, test } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUN_LEDGER } from './helpers';

/**
 * Runs after every other project. Asks the API how many of the addresses this run signed up with
 * still have an account. It must be none: every test deletes what it creates, including second
 * accounts and sessions. The route only accepts e2e-shaped example.org addresses.
 */
test('no account is left behind by this run', async ({ request }) => {
  const emails = existsSync(RUN_LEDGER)
    ? readdirSync(RUN_LEDGER)
        .filter((f) => f.startsWith('emails-'))
        .flatMap((f) => readFileSync(join(RUN_LEDGER, f), 'utf8').split('\n'))
        .filter(Boolean)
    : [];
  test.skip(emails.length === 0, 'no test signed up in this run');
  let left = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const res = await request.post('/api/test/leftovers', { data: { emails: emails.slice(i, i + 100) } });
    expect(res.status()).toBe(200);
    left += (await res.json()).left;
  }
  expect(left, `${left} of ${emails.length} test accounts were left behind`).toBe(0);
});
