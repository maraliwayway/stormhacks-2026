import { expect, it, vi } from 'vitest';
import { gameEvents } from './events';

it('keeps gameplay running if a voice listener throws and allows teardown', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const removeBroken = gameEvents.on('milestone', () => { throw new Error('voice offline'); });
  const listener = vi.fn();
  const remove = gameEvents.on('milestone', listener);
  gameEvents.emit('milestone', { altitude: 25 });
  expect(listener).toHaveBeenCalledOnce();
  remove(); removeBroken();
  gameEvents.emit('milestone', { altitude: 50 });
  expect(listener).toHaveBeenCalledOnce();
  warn.mockRestore();
});
