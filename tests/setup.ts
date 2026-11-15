// The app lazy-loads the FAOSTAT country table; load it once before the engine tests run.
import { beforeAll } from 'vitest';
import { loadFaostat } from '../src/data/countries';

beforeAll(async () => { await loadFaostat(); });
