/**
 * EmblemRenderer — Shared emblem rendering utility
 * Renders Murmuration emblems as Canvas2D images for use across HUD, leaderboard, minimap, etc.
 * All clients use this same renderer to ensure visual consistency.
 */

import type { EmblemConfig, EmblemBackground, EmblemBorder } from '@/types/murmuration';

/** Default emblem config for newly created Murmurations */
export const DEFAULT_EMBLEM: EmblemConfig = {
  background: 'circle',
  icon: 'bird_silhouette',
  border: 'thin',
  fgColor: '#ffffff',
  bgColor: '#4488ff',
};

/** Available icons by Formation level */
const BASE_ICONS = ['bird_silhouette', 'feather', 'wing'];
const F2_ICONS = ['wings_spread', 'talon', 'egg', 'nest', 'beak'];
const F5_ICONS = ['crown', 'star', 'lightning', 'skull', 'shield_icon'];
const ALL_ICONS = [...BASE_ICONS, ...F2_ICONS, ...F5_ICONS];

/** Available colors by Formation level */
const BASE_COLORS = ['#4488ff', '#ff4444', '#44ff44', '#ffdd44', '#ffffff'];
const F5_COLORS = [
  '#ff44ff', '#44ffff', '#ff8844', '#aa44ff', '#88ff44',
  '#ff6688', '#4466ff', '#ffaa44', '#44ffaa', '#ff4488',
  '#8844ff', '#44ff88', '#ff8866', '#6644ff', '#44ff66',
];
const ALL_COLORS = [...BASE_COLORS, ...F5_COLORS];

/** Background shapes available (F8 adds more) */
const BASE_BACKGROUNDS: EmblemBackground[] = ['circle', 'shield', 'diamond', 'hexagon'];

/** Border styles */
const BASE_BORDERS: EmblemBorder[] = ['thin', 'thick', 'ornate', 'animated'];

export function getAvailableIcons(formationLevel: number): string[] {
  if (formationLevel >= 5) return ALL_ICONS;
  if (formationLevel >= 2) return [...BASE_ICONS, ...F2_ICONS];
  return BASE_ICONS;
}

export function getAvailableColors(formationLevel: number): string[] {
  if (formationLevel >= 5) return ALL_COLORS;
  return BASE_COLORS;
}

export function getAvailableBackgrounds(formationLevel: number): EmblemBackground[] {
  return BASE_BACKGROUNDS;
}

export function getAvailableBorders(formationLevel: number): EmblemBorder[] {
  if (formationLevel >= 10) return BASE_BORDERS;
  return BASE_BORDERS.filter(b => b !== 'animated');
}

/**
 * Render an emblem to a canvas element.
 * @param config The emblem configuration
 * @param size Canvas size in pixels
 * @param isGolden Whether to apply golden border (Formation 10)
 * @returns HTMLCanvasElement with rendered emblem
 */
export function renderEmblem(config: EmblemConfig, size: number, isGolden = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Draw background shape
  drawBackground(ctx, config.background, cx, cy, r, config.bgColor);

  // Draw border
  drawBorder(ctx, config.background, cx, cy, r, config.border, isGolden);

  // Draw icon
  drawIcon(ctx, config.icon, cx, cy, r * 0.5, config.fgColor);

  return canvas;
}

/**
 * Render an emblem and return as a data URL for use in <img> tags.
 */
export function renderEmblemDataURL(config: EmblemConfig, size: number, isGolden = false): string {
  const canvas = renderEmblem(config, size, isGolden);
  return canvas.toDataURL('image/png');
}

/**
 * Create a small emblem HTMLElement for inline display (HUD, leaderboard rows, etc.)
 */
export function createEmblemElement(config: EmblemConfig, size: number, isGolden = false): HTMLElement {
  const canvas = renderEmblem(config, size, isGolden);
  canvas.style.cssText = `width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;`;
  return canvas;
}

// ============================================================================
// Drawing Helpers
// ============================================================================

function drawBackground(
  ctx: CanvasRenderingContext2D,
  shape: EmblemBackground,
  cx: number, cy: number, r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();

  switch (shape) {
    case 'circle':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 'shield':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx - r, cy - r * 0.4);
      break;
    case 'diamond':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      break;
  }

  ctx.closePath();
  ctx.fill();
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  shape: EmblemBackground,
  cx: number, cy: number, r: number,
  border: EmblemBorder,
  isGolden: boolean,
): void {
  const borderWidth = border === 'thin' ? 2 : border === 'thick' ? 4 : 3;
  ctx.strokeStyle = isGolden ? '#FFD700' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = borderWidth;

  if (border === 'ornate' || (isGolden && border !== 'thin')) {
    // Double border effect
    ctx.strokeStyle = isGolden ? '#FFD700' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    drawShapePath(ctx, shape, cx, cy, r + 2);
    ctx.stroke();
    ctx.strokeStyle = isGolden ? '#FFA500' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = borderWidth;
  }

  drawShapePath(ctx, shape, cx, cy, r);
  ctx.stroke();
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  shape: EmblemBackground,
  cx: number, cy: number, r: number,
): void {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    case 'shield':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy - r * 0.4);
      ctx.lineTo(cx + r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.8, cy + r * 0.6);
      ctx.lineTo(cx - r, cy - r * 0.4);
      break;
    case 'diamond':
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      break;
  }
  ctx.closePath();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: string,
  cx: number, cy: number, size: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(size * 1.2)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Map icon names to unicode/emoji or simple drawn shapes
  const iconMap: Record<string, string> = {
    bird_silhouette: '\u{1F426}',
    feather: '\u{1FAB6}',
    wing: '\u{1F54A}',
    wings_spread: '\u{1F985}',
    talon: '\u{1F43E}',
    egg: '\u{1F95A}',
    nest: '\u{1FAA8}',
    beak: '\u{1F424}',
    crown: '\u{1F451}',
    star: '\u2605',
    lightning: '\u26A1',
    skull: '\u{1F480}',
    shield_icon: '\u{1F6E1}',
  };

  const char = iconMap[icon] || '\u2605';
  ctx.fillText(char, cx, cy);
}
