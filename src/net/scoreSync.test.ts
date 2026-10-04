import { expect, it, vi } from 'vitest';
import { gameEvents } from '../game/events';
import { installScoreSync, setScoreSink } from './scoreSync';

it('syncs a completed run without blocking and handles offline transports', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const sink = vi.fn().mockRejectedValue(new Error('offline'));
  setScoreSink(sink);
  const remove = installScoreSync();
  expect(() => gameEvents.emit('run_end', { altitude: 30, duration: 45 })).not.toThrow();
  await Promise.resolve();
  expect(sink).toHaveBeenCalledWith({ altitude: 30, duration: 45 });
  expect(warn).toHaveBeenCalledOnce();
  remove(); setScoreSink(undefined); warn.mockRestore();
});
