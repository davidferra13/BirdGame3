import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreSystem } from '../systems/ScoreSystem';

describe('ScoreSystem', () => {
  let scoreSystem: ScoreSystem;

  beforeEach(() => {
    scoreSystem = new ScoreSystem();
  });

  describe('initialization', () => {
    it('should start with zero values', () => {
      expect(scoreSystem.coins).toBe(0);
      expect(scoreSystem.bankedCoins).toBe(0);
      expect(scoreSystem.xp).toBe(0);
      expect(scoreSystem.streak).toBe(0);
      expect(scoreSystem.multiplier).toBe(1);
      expect(scoreSystem.heat).toBe(0);
      expect(scoreSystem.isWanted).toBe(false);
    });
  });

  describe('onHit', () => {
    it('should increase coins based on base points', () => {
      scoreSystem.onHit();
      expect(scoreSystem.coins).toBeGreaterThan(0);
    });

    it('should increase streak and multiplier', () => {
      scoreSystem.onHit();
      expect(scoreSystem.streak).toBe(1);
      expect(scoreSystem.multiplier).toBeGreaterThan(1);

      scoreSystem.onHit();
      expect(scoreSystem.streak).toBe(2);
      expect(scoreSystem.multiplier).toBeGreaterThan(1);
    });

    it('should increase heat', () => {
      const initialHeat = scoreSystem.heat;
      scoreSystem.onHit();
      expect(scoreSystem.heat).toBeGreaterThan(initialHeat);
    });

    it('should apply combo bonus multiplier', () => {
      scoreSystem.comboBonus = 0.5; // 50% bonus
      scoreSystem.onHit();
      const coinsWithBonus = scoreSystem.coins;

      scoreSystem = new ScoreSystem();
      scoreSystem.onHit();
      const coinsWithoutBonus = scoreSystem.coins;

      expect(coinsWithBonus).toBeGreaterThan(coinsWithoutBonus);
    });
  });

  describe('onHitWithValues', () => {
    it('should use custom coin and heat values', () => {
      scoreSystem.onHitWithValues(50, 2);
      expect(scoreSystem.coins).toBe(50);
      expect(scoreSystem.lastHitPoints).toBe(50);
    });

    it('should track NPC type', () => {
      scoreSystem.onHitWithValues(10, 1, 'tourist');
      expect(scoreSystem.lastHitNPCType).toBe('tourist');

      scoreSystem.onHitWithValues(10, 1, 'police');
      expect(scoreSystem.lastHitNPCType).toBe('police');
    });

    it('should apply multiplier based on streak', () => {
      scoreSystem.onHitWithValues(10, 1); // streak = 1, multiplier = 1.25
      const firstHit = scoreSystem.coins;

      scoreSystem.onHitWithValues(10, 1); // streak = 2, multiplier = 1.5
      const secondHit = scoreSystem.coins - firstHit;

      expect(secondHit).toBeGreaterThan(firstHit);
    });
  });

  describe('streak system', () => {
    it('should reset streak after timeout', () => {
      scoreSystem.onHit();
      expect(scoreSystem.streak).toBe(1);

      // Simulate time passing (streak timeout is typically 3 seconds)
      scoreSystem.update(4); // 4 seconds
      expect(scoreSystem.streak).toBe(0);
      expect(scoreSystem.multiplier).toBe(1);
    });

    it('should maintain streak within timeout window', () => {
      scoreSystem.onHit();
      scoreSystem.update(1); // 1 second
      scoreSystem.onHit();

      expect(scoreSystem.streak).toBe(2);
    });
  });

  describe('heat decay', () => {
    it('should decay heat over time when not in hotspot', () => {
      scoreSystem.heat = 5;
      scoreSystem.inHotspot = false;

      scoreSystem.update(1);
      expect(scoreSystem.heat).toBeLessThan(5);
      expect(scoreSystem.heat).toBeGreaterThanOrEqual(0);
    });

    it('should NOT decay heat when in hotspot', () => {
      scoreSystem.heat = 5;
      scoreSystem.inHotspot = true;

      const initialHeat = scoreSystem.heat;
      scoreSystem.update(1);
      expect(scoreSystem.heat).toBe(initialHeat);
    });

    it('should not decay heat below zero', () => {
      scoreSystem.heat = 0.1;
      scoreSystem.update(10); // Long time

      expect(scoreSystem.heat).toBe(0);
    });
  });

  describe('wanted status', () => {
    it('should become wanted when heat exceeds threshold', () => {
      scoreSystem.heat = 0;
      scoreSystem.update(0);
      expect(scoreSystem.isWanted).toBe(false);

      scoreSystem.heat = 5; // WANTED_THRESHOLD
      scoreSystem.update(0);
      expect(scoreSystem.isWanted).toBe(true);
    });
  });

  describe('banking', () => {
    it('should transfer coins to banked and grant XP', () => {
      scoreSystem.coins = 100;
      const banked = scoreSystem.bank();

      expect(banked).toBe(100);
      expect(scoreSystem.coins).toBe(0);
      expect(scoreSystem.bankedCoins).toBe(100);
      expect(scoreSystem.xp).toBe(20); // 100 / 5 = 20 XP
    });

    it('should clear heat, streak, and wanted status', () => {
      scoreSystem.coins = 50;
      scoreSystem.heat = 8;
      scoreSystem.streak = 5;
      scoreSystem.isWanted = true;

      scoreSystem.bank();

      expect(scoreSystem.heat).toBe(0);
      expect(scoreSystem.streak).toBe(0);
      expect(scoreSystem.multiplier).toBe(1);
      expect(scoreSystem.isWanted).toBe(false);
    });

    it('should return zero and not change anything if no coins', () => {
      scoreSystem.coins = 0;
      scoreSystem.heat = 5;

      const banked = scoreSystem.bank();

      expect(banked).toBe(0);
      expect(scoreSystem.heat).toBe(5); // Should not clear heat if no coins banked
    });
  });

  describe('grounding', () => {
    it('should lose a fraction of coins', () => {
      scoreSystem.coins = 100;
      const lost = scoreSystem.onGrounded();

      expect(lost).toBeGreaterThan(0);
      expect(lost).toBeLessThan(100);
      expect(scoreSystem.coins).toBe(100 - lost);
    });

    it('should clear heat, streak, and wanted status', () => {
      scoreSystem.coins = 100;
      scoreSystem.heat = 8;
      scoreSystem.streak = 5;
      scoreSystem.isWanted = true;

      scoreSystem.onGrounded();

      expect(scoreSystem.heat).toBe(0);
      expect(scoreSystem.streak).toBe(0);
      expect(scoreSystem.multiplier).toBe(1);
      expect(scoreSystem.isWanted).toBe(false);
    });

    it('should not affect banked coins', () => {
      scoreSystem.coins = 100;
      scoreSystem.bankedCoins = 200;

      scoreSystem.onGrounded();

      expect(scoreSystem.bankedCoins).toBe(200); // Unchanged
    });
  });

  describe('computed properties', () => {
    it('heatFraction should return normalized heat value', () => {
      scoreSystem.heat = 0;
      expect(scoreSystem.heatFraction).toBe(0);

      scoreSystem.heat = 5; // Half of MAX_HEAT (10)
      expect(scoreSystem.heatFraction).toBe(0.5);

      scoreSystem.heat = 10; // MAX_HEAT
      expect(scoreSystem.heatFraction).toBe(1);
    });

    it('totalCoins should return sum of banked and current coins', () => {
      scoreSystem.coins = 50;
      scoreSystem.bankedCoins = 150;
      expect(scoreSystem.totalCoins).toBe(200);
    });
  });
});
