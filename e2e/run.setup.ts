import { test as setup } from '@playwright/test';
import { rmSync } from 'node:fs';
import { RUN_LEDGER } from './helpers';

// Starts a fresh ledger of the addresses this run signs up with.
setup('start a fresh account ledger', async () => {
  rmSync(RUN_LEDGER, { recursive: true, force: true });
});
