import { describe, it, expect } from 'vitest';
import { getOrchestratorVersion } from './orchestrator.js';

describe('orchestrator', () => {
  it('returns version', () => {
    expect(getOrchestratorVersion()).toBe('0.1.0');
  });
});
