import { describe, expect, it } from 'vitest';
import { WorldState } from '../../server/WorldState';
import { BotManager } from '../../server/BotManager';
import { BotPlayer } from '../../server/BotPlayer';

describe('server population integrity', () => {
  it('labels simulated players so they cannot be mistaken for human users', () => {
    const bot = new BotPlayer({ x: 0, y: 25, z: 0 });
    expect(bot.player.username).toMatch(/ \[BOT\]$/);
    expect(bot.botId).toMatch(/^bot_/);
    bot.destroy();
  });

  it('keeps bot population configuration separate and bounded', () => {
    const manager = new BotManager(new WorldState(), {
      minBots: 200,
      targetPopulation: 900,
      maxBots: 150,
      evaluationInterval: 0,
      joinStagger: 0,
    });
    expect(manager.getPopulationConfig()).toEqual({
      minBots: 100,
      targetPopulation: 500,
      maxBots: 100,
      evaluationInterval: 1,
      joinStagger: 1,
    });
  });
});
