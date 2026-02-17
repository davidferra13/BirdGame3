import { describe, it, expect } from 'vitest';
import { clamp, lerp, moveToward, remap, expDecay } from '../utils/MathUtils';

describe('MathUtils', () => {
  describe('clamp', () => {
    it('should clamp value between min and max', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should work with negative ranges', () => {
      expect(clamp(5, -10, -5)).toBe(-5);
      expect(clamp(-15, -10, -5)).toBe(-10);
      expect(clamp(-7, -10, -5)).toBe(-7);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0.25)).toBe(2.5);
    });

    it('should work with negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-10, -5, 0.5)).toBe(-7.5);
    });

    it('should extrapolate beyond 0-1 range', () => {
      expect(lerp(0, 10, 2)).toBe(20);
      expect(lerp(0, 10, -1)).toBe(-10);
    });
  });

  describe('moveToward', () => {
    it('should move current toward target by maxDelta', () => {
      expect(moveToward(0, 10, 2)).toBe(2);
      expect(moveToward(8, 10, 2)).toBe(10); // Should clamp to target
      expect(moveToward(10, 0, 3)).toBe(7);
    });

    it('should not overshoot target', () => {
      expect(moveToward(9, 10, 5)).toBe(10);
      expect(moveToward(1, 0, 5)).toBe(0);
    });

    it('should handle negative movement', () => {
      expect(moveToward(10, 5, 2)).toBe(8);
      expect(moveToward(-5, -10, 2)).toBe(-7);
    });

    it('should return target when already at target', () => {
      expect(moveToward(5, 5, 10)).toBe(5);
    });
  });

  describe('remap', () => {
    it('should remap values from one range to another', () => {
      // Map 0-100 to 0-1
      expect(remap(50, 0, 100, 0, 1)).toBe(0.5);
      expect(remap(0, 0, 100, 0, 1)).toBe(0);
      expect(remap(100, 0, 100, 0, 1)).toBe(1);

      // Map 0-10 to 100-200
      expect(remap(5, 0, 10, 100, 200)).toBe(150);
      expect(remap(0, 0, 10, 100, 200)).toBe(100);
      expect(remap(10, 0, 10, 100, 200)).toBe(200);
    });

    it('should clamp to output range', () => {
      // Value outside input range should clamp
      expect(remap(150, 0, 100, 0, 1)).toBe(1); // Clamped to max
      expect(remap(-50, 0, 100, 0, 1)).toBe(0); // Clamped to min
    });

    it('should work with inverted ranges', () => {
      // Map 0-100 to 1-0 (inverted)
      expect(remap(0, 0, 100, 1, 0)).toBe(1);
      expect(remap(100, 0, 100, 1, 0)).toBe(0);
      expect(remap(50, 0, 100, 1, 0)).toBe(0.5);
    });
  });

  describe('expDecay', () => {
    it('should decay exponentially toward target', () => {
      // With high speed and dt, should get very close to target
      const result1 = expDecay(0, 10, 10, 1);
      expect(result1).toBeGreaterThan(9.99);
      expect(result1).toBeLessThan(10);

      // With low speed, should move slowly
      const result2 = expDecay(0, 10, 1, 0.1);
      expect(result2).toBeGreaterThan(0);
      expect(result2).toBeLessThan(2);
    });

    it('should approach target asymptotically', () => {
      let current = 0;
      const target = 100;
      const speed = 5;
      const dt = 0.016; // ~60 FPS

      // Simulate multiple frames
      for (let i = 0; i < 60; i++) {
        current = expDecay(current, target, speed, dt);
      }

      // After 60 frames (~1 second), should be close to target
      expect(current).toBeGreaterThan(95);
      expect(current).toBeLessThan(100);
    });

    it('should work with negative targets', () => {
      const result = expDecay(10, -10, 5, 0.1);
      expect(result).toBeLessThan(10);
      expect(result).toBeGreaterThan(-10);
    });
  });
});
