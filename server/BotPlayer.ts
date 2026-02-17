/**
 * Bot Player
 * A server-side AI player that wraps the real Player class
 * and is driven by BotBehavior. Indistinguishable from real players
 * in the WorldState and network messages.
 */

import { Player } from './Player';
import { BotBehavior, BotArchetype } from './BotBehavior';
import { Vector3 } from './types';

// Realistic-looking usernames — diverse styles that real players actually use.
// Deliberately NOT themed around birds/pooping so bots blend in with humans.
const BOT_NAMES: string[] = [
  // Generic gamer tags
  'ShadowMike', 'NightOwl33', 'CoolGuy_7', 'xDarkWolfx', 'SilentStorm',
  'ProSniper', 'IronClad', 'Gh0stRider', 'NovaBlaze', 'VoidWalker',
  'ZeroGravity', 'MysticRain', 'CyberPunk88', 'NeonDrift', 'ArcticFox_',
  'BlitzKrieg', 'RogueAgent', 'SteelNerve', 'OmegaWolf', 'PhantomX',

  // Real-name-based (like actual people picking usernames)
  'jake_2011', 'sarah.m', 'tommy_plays', 'emmarose', 'liam_w',
  'olivia97', 'noah_g', 'miaplays', 'ethan_k', 'ava_lol',
  'lucas_ttv', 'chloe_xx', 'mason2010', 'lily_star', 'aiden_m',
  'zoe_plays', 'dylan.r', 'ella2009', 'jack_fps', 'hailey_c',
  'brayden_', 'sofia_gg', 'owen99', 'riley.b', 'carter_w',
  'nora_ok', 'hunter_j', 'piper2012', 'jayden_x', 'layla_m',

  // Casual / random word combos
  'toastman', 'LuckyDuck', 'waffleking', 'CouchPotato', 'pizzatime',
  'mr_noodles', 'SleepyPanda', 'ChillDude', 'VibeCheck', 'CloudNine',
  'TacoTuesday', 'IceCreamMan', 'PotatoAim', 'lazyfrog', 'BurntToast',
  'SpicyMango', 'coconuthead', 'blobfish42', 'SquidWard', 'sadcat',

  // Tryhard / competitive style
  'TTVsweaty', 'cracked_', 'goated_fr', 'diff_gg', 'ez_clap',
  'no_scope', 'aim_assist', 'touch_grass', 'ratio_', 'YTFrosty',
  'GGs_Only', 'just_vibin', 'bot_lobby', 'carry_me', 'send_it',

  // Misc internet culture
  'doge_fan', 'amogus_', 'sk8rboy', 'monke_flip', 'big_chungus',
  'bruh_moment', 'NPC_energy', 'main_char', 'no_shot', 'lowkey_goat',
  'yeet_or_die', 'RickRoll_', 'gg_wp', 'rng_god', 'just_a_guy',
  'idk_man', 'oops_lol', 'wait_what', 'sus_player', 'not_a_bot',

  // Keyboard-mash / lazy names
  'aaabbb', 'qqq123', 'asdfghjk', 'zxcvbn', 'aaaaa_a',
  'test_123', 'Player847', 'Guest_99', 'unnamed_', 'hhhhh',

  // Mixed style
  'K1ngjulian', 'Dexter_Lab', 'SunnyDay22', 'MoonlightX', 'RainyMood',
  'ThunderCat', 'PixelDust', 'GlitchHop', 'RetroWave', 'cosmicray',
  'turbo_snail', 'Velvet_', 'NebulaStar', 'rusty_nail', 'CrystalEdge',
  'Sandstorm_', 'WinterWolf', 'SummerDaze', 'AutumnLeaf', 'SpringStep',
];

const usedNames = new Set<string>();

// Parts for procedurally generating overflow names that still look human
const NAME_PREFIXES = [
  'cool', 'dark', 'fast', 'epic', 'big', 'lil', 'old', 'new', 'real', 'just',
  'sad', 'mad', 'chill', 'lost', 'mega', 'super', 'tiny', 'lazy', 'hyper', 'sneaky',
];
const NAME_ROOTS = [
  'wolf', 'fox', 'bear', 'cat', 'panda', 'shark', 'tiger', 'lion', 'frog', 'duck',
  'toast', 'waffle', 'pixel', 'ninja', 'knight', 'mango', 'ghost', 'robot', 'wizard', 'cloud',
  'jake', 'mike', 'emma', 'alex', 'sam', 'max', 'leo', 'zoe', 'kai', 'finn',
];
const NAME_SEPARATORS = ['_', '', '.', '-', 'x'];

function generateProceduralName(): string {
  const style = Math.random();
  if (style < 0.4) {
    // prefix + root + number: "darkwolf42", "chill_fox7"
    const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
    const root = NAME_ROOTS[Math.floor(Math.random() * NAME_ROOTS.length)];
    const sep = Math.random() < 0.3 ? '_' : '';
    const num = Math.random() < 0.6 ? String(Math.floor(Math.random() * 99)) : '';
    return `${prefix}${sep}${root}${num}`;
  } else if (style < 0.7) {
    // name + year-like number: "alex2010", "sam_99"
    const root = NAME_ROOTS[Math.floor(Math.random() * NAME_ROOTS.length)];
    const sep = Math.random() < 0.3 ? '_' : '';
    const year = Math.random() < 0.5
      ? String(2005 + Math.floor(Math.random() * 15))
      : String(Math.floor(Math.random() * 999));
    return `${root}${sep}${year}`;
  } else {
    // root + root: "wolfninja", "pixel_toast"
    const a = NAME_ROOTS[Math.floor(Math.random() * NAME_ROOTS.length)];
    let b = NAME_ROOTS[Math.floor(Math.random() * NAME_ROOTS.length)];
    while (b === a) b = NAME_ROOTS[Math.floor(Math.random() * NAME_ROOTS.length)];
    const sep = Math.random() < 0.4 ? '_' : '';
    return `${a}${sep}${b}`;
  }
}

function pickBotName(): string {
  // Try to pick an unused name from the curated pool
  const available = BOT_NAMES.filter(n => !usedNames.has(n));
  if (available.length > 0) {
    const name = available[Math.floor(Math.random() * available.length)];
    usedNames.add(name);
    return name;
  }
  // All curated names used — generate a natural-looking procedural name
  let name: string;
  let attempts = 0;
  do {
    name = generateProceduralName();
    attempts++;
  } while (usedNames.has(name) && attempts < 20);
  usedNames.add(name);
  return name;
}

function releaseBotName(name: string): void {
  usedNames.delete(name);
}

let nextBotId = 1;

export class BotPlayer {
  readonly player: Player;
  readonly behavior: BotBehavior;
  readonly isBot = true;

  // Session simulation: bots "join" and "leave" over time
  private sessionDuration: number; // How long this bot stays (seconds)
  private sessionTimer = 0;
  readonly botId: string;

  // PvP state tracking — BotManager compares these each tick to detect events
  prevStunned = false;
  prevCoins = 0;

  constructor(spawnPos: Vector3) {
    this.botId = `bot_${nextBotId++}`;
    const username = pickBotName();
    this.player = new Player(this.botId, username, spawnPos);
    this.behavior = new BotBehavior(spawnPos);

    // Bots stay for 3-15 minutes then "leave" (mimics real player sessions)
    this.sessionDuration = 180 + Math.random() * 720;
  }

  /**
   * Update the bot's behavior and apply movement to its Player.
   * Returns false if the bot's session has expired (should be removed).
   */
  update(dt: number, nearbyPlayerPositions: Vector3[]): boolean {
    this.sessionTimer += dt;
    if (this.sessionTimer >= this.sessionDuration) {
      releaseBotName(this.player.username);
      return false; // Session over
    }

    // Calculate session maturity (0 = just joined, 1 = been here 5+ min)
    this.behavior.sessionMaturity = Math.min(1, this.sessionTimer / 300);

    // Run behavior AI
    const output = this.behavior.update(dt, nearbyPlayerPositions);

    // Apply movement to the Player entity (bypassing input validation
    // since we trust our own AI output)
    this.player.position = { ...output.position };
    this.player.yaw = output.yaw;
    this.player.pitch = output.pitch;
    this.player.speed = Math.max(0, Math.min(80, output.speed));
    this.player.lastUpdate = Date.now();

    // Sync coins
    this.behavior.coins = this.player.coins;

    return true;
  }

  /** Check if this bot should start banking */
  wantsToBank(): boolean {
    return this.behavior.state === 'bank' &&
      !this.player.isStunned() &&
      this.player.coins > 0 &&
      this.player.state !== 'BANKING';
  }

  /** Get a poop velocity (slightly randomized like a human) */
  getPoopVelocity(): Vector3 {
    const spread = 0.5; // Imperfect aim
    return {
      x: (Math.random() - 0.5) * spread,
      y: -2,
      z: (Math.random() - 0.5) * spread,
    };
  }

  isSessionExpired(): boolean {
    return this.sessionTimer >= this.sessionDuration;
  }

  /** Notify bot that it was hit by another player's poop */
  notifyHit(attackerPos: Vector3 | null): void {
    this.behavior.onHit(attackerPos);
  }

  /** Notify bot that its poop hit another player */
  notifyPoopHit(): void {
    this.behavior.onPoopHitPlayer();
  }

  /** Get this bot's personality archetype */
  getArchetype(): BotArchetype {
    return this.behavior.archetype;
  }

  destroy(): void {
    releaseBotName(this.player.username);
  }
}
