import { describe, it, expect } from 'vitest';
import { EMPTY_INPUT } from '../input/types';
import { MenuConfirm } from './menuConfirm';
import { levelAt, hasWon } from './levels';

const ready = { ...EMPTY_INPUT, tracking: true, calibrated: true };
describe('storyboard navigation', () => {
  it('requires a new jump across screens and ignores held poses', () => {
    const input = { ...ready, jump: true };
    const confirm = new MenuConfirm(input);
    expect(confirm.read(input)).toBe(false);
    expect(confirm.read({ ...input, jump: false })).toBe(false);
    expect(confirm.read(input)).toBe(true);
    expect(confirm.read(input)).toBe(false);
  });
  it('keeps brief confirmations and handles counter resets', () => {
    const confirm = new MenuConfirm({ ...ready, selectCount: 5 });
    expect(confirm.read({ ...ready, selectCount: 6 })).toBe(true);
    expect(confirm.read({ ...ready, selectCount: 0 })).toBe(false);
    expect(confirm.read({ ...ready, selectCount: 1 })).toBe(true);
  });
  it('ignores lost tracking and does not replay its confirmation later', () => {
    const confirm = new MenuConfirm(ready);
    expect(confirm.read({ ...ready, tracking: false, jump: true })).toBe(false);
    expect(confirm.read({ ...ready, jump: true })).toBe(false);
  });
  it('keeps continuous altitude at both level boundaries', () => {
    expect(levelAt(59.99).id).toBe('kitchen');
    expect(levelAt(60).id).toBe('dessert');
    expect(hasWon(119.99)).toBe(false);
    expect(hasWon(120)).toBe(true);
  });
});
