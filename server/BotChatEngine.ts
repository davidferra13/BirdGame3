/**
 * BotChatEngine
 *
 * Generates realistic, contextual chat messages for bot players.
 * Each bot receives a unique personality at spawn that controls their
 * writing style (capitalization, abbreviations, emoji, verbosity, etc.).
 * Messages are only triggered by game events or natural conversation flow,
 * never on a fixed timer.
 *
 * Design goals:
 * - No two bots say the exact same final string in one session
 * - Individual bots say 0-5 things total across their entire session
 * - Global chat pacing: mostly quiet, occasional bursts of 3-4 messages,
 *   then silence for 30-90 seconds
 * - Bots respond to each other and to real players with realistic delay
 */

// ============================================================================
// Types
// ============================================================================

interface BotPersonality {
  // Writing style
  capsStyle: 'none' | 'normal' | 'shout';
  usePunctuation: boolean;
  useAbbreviations: boolean;
  emojiChance: number;       // 0-1
  typoChance: number;        // 0-1
  exclamation: 'none' | 'single' | 'double';
  trailing: 'none' | 'ellipsis' | 'lol' | 'haha' | 'lmao';

  // Behavioral
  greetOnJoin: boolean;
  farewellOnLeave: boolean;
  hitReactChance: number;    // 0-1
  ownHitReactChance: number; // 0-1
  bankReactChance: number;   // 0-1
  respondToChat: number;     // 0-1
  initiateChance: number;    // 0-1
}

interface BotChatState {
  personality: BotPersonality;
  username: string;
  messagesSent: number;
  maxMessages: number;       // 0 = silent bot
  perBotCooldownEnd: number; // ms timestamp
}

interface QueuedMessage {
  botId: string;
  username: string;
  text: string;
  sendAt: number; // ms timestamp
}

export interface OutgoingChat {
  botId: string;
  username: string;
  message: string;
}

// ============================================================================
// Message Templates — assembled from parts, not flat lists
// ============================================================================

interface MessageParts {
  primary: string[];
  secondary?: string[];
  secondaryChance: number;
  standalone?: string[];
  standaloneChance: number;
}

const T: Record<string, MessageParts> = {
  greet: {
    primary: [
      'hey', 'yo', 'hi', 'sup', 'hello', 'whats up', 'waddup',
      'heyo', 'hiii', 'ayy', 'yooo', 'hola', 'howdy',
    ],
    secondary: ['everyone', 'yall', 'gamers', 'people', 'guys'],
    secondaryChance: 0.12,
    standalone: [
      'just got on', 'lets go', 'im back', 'ok im here',
      'just started playing this', 'first game of the day',
    ],
    standaloneChance: 0.25,
  },

  react_got_hit: {
    primary: ['bro', 'dude', 'man', 'bruh', 'yo', 'ok', 'wow', 'ayo'],
    secondary: [
      'come on', 'seriously', 'why', 'stop', 'not cool', 'chill',
      'really', 'thats messed up', 'quit it', 'relax',
    ],
    secondaryChance: 0.5,
    standalone: [
      'nah', 'rude', 'i see how it is', 'oh its on now', 'alright bet',
      'that was so cheap', 'ok you asked for it', 'bro i had so many coins',
      'not again', 'my coins', 'pain', 'what was that for',
    ],
    standaloneChance: 0.35,
  },

  trash_talk: {
    primary: ['got em', 'gotcha', 'boom', 'splat', 'direct hit', 'nailed it'],
    secondary: [
      'too easy', 'nothing personal', 'my bad', 'sorry about that',
      'shouldve dodged', 'get good', 'outplayed',
    ],
    secondaryChance: 0.4,
    standalone: [
      'sorry not sorry', 'sit down', 'calculated', 'all skill',
      'you were in my way', 'bye bye coins', 'dont take it personal',
      'that felt good', 'had to do it',
    ],
    standaloneChance: 0.3,
  },

  celebrate_bank: {
    primary: ['lets go', 'nice', 'yes', 'finally', 'boom', 'ayy', 'yesss'],
    secondary: [
      'easy money', 'secured', 'safe', 'banked', 'stacked',
      'all safe now', 'cant touch me', 'too clean',
    ],
    secondaryChance: 0.45,
    standalone: [
      'secured the bag', 'cha ching', 'money money money',
      'get me to that sanctuary every time', 'phew that was close',
      'nobody is taking my coins', 'bank diff',
    ],
    standaloneChance: 0.25,
  },

  farewell: {
    primary: [
      'gotta go', 'bye', 'im out', 'peace', 'later', 'cya',
      'see ya', 'gtg', 'have fun', 'ok im leaving',
    ],
    secondaryChance: 0,
    standalone: [
      'gg everyone', 'good game', 'that was fun', 'ill be back later',
      'ok thats enough for today', 'my mom is calling me',
    ],
    standaloneChance: 0.2,
  },

  respond_generic: {
    primary: [
      'lol', 'haha', 'fr', 'same', 'true', 'facts', 'real',
      'yeah', 'nice', 'mood', 'big facts', 'for real',
      'right', 'yep', 'honestly', 'no cap', 'deadass',
      'thats crazy', 'bro what', 'i feel that',
    ],
    secondaryChance: 0,
    standaloneChance: 0,
  },

  respond_greeting: {
    primary: ['hey', 'yo', 'sup', 'hi', 'whats good', 'ayy', 'yooo'],
    secondaryChance: 0,
    standaloneChance: 0,
  },

  respond_question: {
    primary: [
      'idk', 'not sure', 'maybe', 'i think so', 'no idea',
      'good question', 'beats me', 'who knows',
    ],
    secondaryChance: 0,
    standaloneChance: 0,
  },

  respond_race: {
    primary: [
      'im down', 'sure', 'where', 'bet', 'lets do it',
      'maybe later', 'i suck at racing', 'down',
    ],
    secondaryChance: 0,
    standaloneChance: 0,
  },

  initiate_social: {
    primary: [
      'anyone wanna race', 'this game is so fun',
      'where is everyone flying', 'anyone else just vibing',
      'how do you get coins fast', 'whats the best strategy here',
      'whos got the most coins', 'the sanctuary is so far',
      'i keep getting pooped on', 'this is harder than i thought',
      'who wants to have a poop fight', 'im bored someone fight me',
      'is it just me or are the npcs faster now',
      'bet i can hit more npcs than anyone here',
    ],
    secondaryChance: 0,
    standaloneChance: 0,
  },
};

// ============================================================================
// Abbreviation map (applied when personality.useAbbreviations = true)
// ============================================================================

const ABBREVIATIONS: [RegExp, string][] = [
  [/\byou\b/gi, 'u'],
  [/\byour\b/gi, 'ur'],
  [/\byou're\b/gi, 'ur'],
  [/\bgoing to\b/gi, 'gonna'],
  [/\bwant to\b/gi, 'wanna'],
  [/\bgot to\b/gi, 'gotta'],
  [/\bbecause\b/gi, 'cuz'],
  [/\bthough\b/gi, 'tho'],
  [/\bprobably\b/gi, 'prolly'],
  [/\bpeople\b/gi, 'ppl'],
  [/\bsomeone\b/gi, 'someone'],
  [/\bdon't\b/gi, 'dont'],
  [/\bcan't\b/gi, 'cant'],
  [/\bwhat's\b/gi, 'whats'],
  [/\bthat's\b/gi, 'thats'],
  [/\blet's\b/gi, 'lets'],
  [/\bit's\b/gi, 'its'],
  [/\bi'm\b/gi, 'im'],
  [/\bi am\b/gi, 'im'],
  [/\bright now\b/gi, 'rn'],
  [/\bto be honest\b/gi, 'tbh'],
  [/\bnot gonna lie\b/gi, 'ngl'],
  [/\bi don't know\b/gi, 'idk'],
];

// ============================================================================
// Common typo patterns
// ============================================================================

function introduceTypo(msg: string): string {
  const words = msg.split(' ');
  if (words.length === 0) return msg;
  const idx = Math.floor(Math.random() * words.length);
  const word = words[idx];
  if (word.length < 3) return msg; // don't corrupt tiny words

  const typoType = Math.random();
  if (typoType < 0.4) {
    // swap two adjacent characters
    const pos = 1 + Math.floor(Math.random() * (word.length - 2));
    words[idx] = word.slice(0, pos) + word[pos + 1] + word[pos] + word.slice(pos + 2);
  } else if (typoType < 0.7) {
    // double a character
    const pos = Math.floor(Math.random() * word.length);
    words[idx] = word.slice(0, pos) + word[pos] + word.slice(pos);
  } else {
    // drop a character (middle only)
    const pos = 1 + Math.floor(Math.random() * (word.length - 2));
    words[idx] = word.slice(0, pos) + word.slice(pos + 1);
  }
  return words.join(' ');
}

// ============================================================================
// Emoji pool (sparingly used)
// ============================================================================

const EMOJIS = ['😂', '💀', '😭', '🔥', '💯', '😎', '🤣', '😤', '👀', '🤷', '😈', '💩'];

// ============================================================================
// Personality generation
// ============================================================================

function generatePersonality(): BotPersonality {
  const archetype = Math.random();

  // ~30%: Casual lowercase (most common internet style)
  if (archetype < 0.30) {
    return {
      capsStyle: 'none',
      usePunctuation: false,
      useAbbreviations: Math.random() < 0.6,
      emojiChance: 0,
      typoChance: Math.random() * 0.1,
      exclamation: 'none',
      trailing: pick(['none', 'none', 'none', 'lol', 'lmao']),
      greetOnJoin: Math.random() < 0.3,
      farewellOnLeave: Math.random() < 0.2,
      hitReactChance: 0.4 + Math.random() * 0.3,
      ownHitReactChance: 0.3 + Math.random() * 0.3,
      bankReactChance: 0.2 + Math.random() * 0.3,
      respondToChat: 0.15 + Math.random() * 0.25,
      initiateChance: 0.03 + Math.random() * 0.07,
    };
  }

  // ~15%: Terse / one-word responses
  if (archetype < 0.45) {
    return {
      capsStyle: 'none',
      usePunctuation: false,
      useAbbreviations: false,
      emojiChance: 0,
      typoChance: 0,
      exclamation: 'none',
      trailing: 'none',
      greetOnJoin: Math.random() < 0.15,
      farewellOnLeave: Math.random() < 0.1,
      hitReactChance: 0.3 + Math.random() * 0.2,
      ownHitReactChance: 0.2,
      bankReactChance: 0.1,
      respondToChat: 0.1 + Math.random() * 0.15,
      initiateChance: 0.01,
    };
  }

  // ~15%: Excitable / energetic
  if (archetype < 0.60) {
    return {
      capsStyle: Math.random() < 0.4 ? 'shout' : 'normal',
      usePunctuation: true,
      useAbbreviations: false,
      emojiChance: Math.random() * 0.15,
      typoChance: Math.random() * 0.08,
      exclamation: Math.random() < 0.5 ? 'double' : 'single',
      trailing: 'none',
      greetOnJoin: Math.random() < 0.6,
      farewellOnLeave: Math.random() < 0.4,
      hitReactChance: 0.6 + Math.random() * 0.3,
      ownHitReactChance: 0.5 + Math.random() * 0.3,
      bankReactChance: 0.5 + Math.random() * 0.3,
      respondToChat: 0.3 + Math.random() * 0.3,
      initiateChance: 0.08 + Math.random() * 0.12,
    };
  }

  // ~12%: Abbreviator / text-speak
  if (archetype < 0.72) {
    return {
      capsStyle: 'none',
      usePunctuation: false,
      useAbbreviations: true,
      emojiChance: 0,
      typoChance: 0.08 + Math.random() * 0.1,
      exclamation: 'none',
      trailing: pick(['none', 'lol', 'lmao', 'haha']),
      greetOnJoin: Math.random() < 0.35,
      farewellOnLeave: Math.random() < 0.25,
      hitReactChance: 0.35 + Math.random() * 0.3,
      ownHitReactChance: 0.3 + Math.random() * 0.25,
      bankReactChance: 0.25 + Math.random() * 0.2,
      respondToChat: 0.2 + Math.random() * 0.2,
      initiateChance: 0.04 + Math.random() * 0.06,
    };
  }

  // ~10%: Emoji user
  if (archetype < 0.82) {
    return {
      capsStyle: 'normal',
      usePunctuation: Math.random() < 0.5,
      useAbbreviations: false,
      emojiChance: 0.3 + Math.random() * 0.3,
      typoChance: 0,
      exclamation: 'none',
      trailing: 'none',
      greetOnJoin: Math.random() < 0.5,
      farewellOnLeave: Math.random() < 0.3,
      hitReactChance: 0.4 + Math.random() * 0.3,
      ownHitReactChance: 0.3 + Math.random() * 0.3,
      bankReactChance: 0.3 + Math.random() * 0.3,
      respondToChat: 0.2 + Math.random() * 0.25,
      initiateChance: 0.05 + Math.random() * 0.08,
    };
  }

  // ~8%: Trailing "haha" / "lol" personality
  if (archetype < 0.90) {
    return {
      capsStyle: 'none',
      usePunctuation: false,
      useAbbreviations: Math.random() < 0.4,
      emojiChance: 0,
      typoChance: Math.random() * 0.06,
      exclamation: 'none',
      trailing: pick(['lol', 'haha', 'lmao']),
      greetOnJoin: Math.random() < 0.3,
      farewellOnLeave: Math.random() < 0.2,
      hitReactChance: 0.3 + Math.random() * 0.3,
      ownHitReactChance: 0.25 + Math.random() * 0.25,
      bankReactChance: 0.2 + Math.random() * 0.2,
      respondToChat: 0.2 + Math.random() * 0.2,
      initiateChance: 0.03 + Math.random() * 0.05,
    };
  }

  // ~10%: Silent — never chats (maxMessages forced to 0 by caller)
  return {
    capsStyle: 'none',
    usePunctuation: false,
    useAbbreviations: false,
    emojiChance: 0,
    typoChance: 0,
    exclamation: 'none',
    trailing: 'none',
    greetOnJoin: false,
    farewellOnLeave: false,
    hitReactChance: 0,
    ownHitReactChance: 0,
    bankReactChance: 0,
    respondToChat: 0,
    initiateChance: 0,
  };
}

// ============================================================================
// Personality filter — transforms a base message into a styled one
// ============================================================================

function applyPersonality(base: string, p: BotPersonality): string {
  let msg = base;

  // Abbreviations first (before caps)
  if (p.useAbbreviations) {
    for (const [re, rep] of ABBREVIATIONS) {
      msg = msg.replace(re, rep);
    }
  }

  // Remove contractions' apostrophes for casual feel when no punct
  if (!p.usePunctuation) {
    msg = msg.replace(/'/g, '');
  }

  // Capitalization
  switch (p.capsStyle) {
    case 'none':
      msg = msg.toLowerCase();
      break;
    case 'normal':
      msg = msg.charAt(0).toUpperCase() + msg.slice(1).toLowerCase();
      break;
    case 'shout':
      msg = msg.toUpperCase();
      break;
  }

  // Strip punctuation
  if (!p.usePunctuation) {
    msg = msg.replace(/[.,;:!?]/g, '');
  }

  // Exclamation (applied after punct strip — adds back deliberately)
  if (p.exclamation === 'single') msg += '!';
  else if (p.exclamation === 'double') msg += '!!';

  // Trailing
  if (p.trailing !== 'none') {
    // Don't double up if message already ends with the trailing word
    const lowMsg = msg.toLowerCase();
    if (p.trailing === 'ellipsis') {
      if (!lowMsg.endsWith('...')) msg += '...';
    } else {
      if (!lowMsg.endsWith(p.trailing)) msg += ' ' + p.trailing;
    }
  }

  // Typos
  if (Math.random() < p.typoChance) {
    msg = introduceTypo(msg);
  }

  // Emoji
  if (Math.random() < p.emojiChance) {
    msg += ' ' + EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  }

  return msg.trim();
}

// ============================================================================
// Message builder — constructs from template parts
// ============================================================================

function buildFromParts(template: MessageParts, personality: BotPersonality): string {
  // Decide: standalone or composite
  if (template.standalone && Math.random() < template.standaloneChance) {
    const base = pick(template.standalone);
    return applyPersonality(base, personality);
  }

  let base = pick(template.primary);
  if (template.secondary && Math.random() < template.secondaryChance) {
    base += ' ' + pick(template.secondary);
  }
  return applyPersonality(base, personality);
}

// ============================================================================
// Keyword matching for contextual responses
// ============================================================================

const GREETING_WORDS = /\b(hey|hi|hello|sup|yo|waddup|howdy|hola|whats up)\b/i;
const RACE_WORDS = /\b(race|racing|checkpoint)\b/i;
const QUESTION_MARK = /\?/;

function categorizeMessage(message: string): string {
  if (GREETING_WORDS.test(message)) return 'respond_greeting';
  if (RACE_WORDS.test(message)) return 'respond_race';
  if (QUESTION_MARK.test(message)) return 'respond_question';
  return 'respond_generic';
}

// ============================================================================
// Utilities
// ============================================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================================
// BotChatEngine class
// ============================================================================

export class BotChatEngine {
  private bots = new Map<string, BotChatState>();
  private queue: QueuedMessage[] = [];
  private sentMessages = new Set<string>();   // dedup: lowercase of every sent message

  // Global pacing
  private globalCooldownEnd = 0;              // ms — no messages before this
  private conversationActive = false;
  private conversationEnd = 0;
  private burstCount = 0;
  private maxBurst = 4;

  // Last chat log for response context
  private lastChatSenderId = '';
  private lastChatMessage = '';
  private lastChatTime = 0;

  // ---- Bot registration ----

  registerBot(botId: string, username: string): void {
    const personality = generatePersonality();
    // 10% of bots are completely silent (personality might already be silent)
    const isSilent = personality.respondToChat === 0 && personality.hitReactChance === 0;
    const maxMessages = isSilent ? 0 : (1 + Math.floor(Math.random() * 5)); // 1-5

    this.bots.set(botId, {
      personality,
      username,
      messagesSent: 0,
      maxMessages,
      perBotCooldownEnd: Date.now() + 5000, // don't chat immediately on spawn
    });
  }

  unregisterBot(botId: string): void {
    this.bots.delete(botId);
    // Remove any queued messages for this bot
    this.queue = this.queue.filter(m => m.botId !== botId);
  }

  // ---- Event triggers ----

  onBotJoined(botId: string): void {
    const state = this.bots.get(botId);
    if (!state || !state.personality.greetOnJoin) return;
    if (!this.canBotChat(state)) return;

    const delay = 1500 + Math.random() * 4000; // 1.5-5.5s after joining
    this.tryQueue(botId, state, 'greet', delay);
  }

  onBotLeaving(botId: string): void {
    const state = this.bots.get(botId);
    if (!state || !state.personality.farewellOnLeave) return;
    if (!this.canBotChat(state)) return;

    // Farewell sent immediately (they're about to be removed)
    const msg = buildFromParts(T.farewell, state.personality);
    if (this.isDuplicate(msg)) return;
    this.recordSent(msg);
    state.messagesSent++;
    // Queue with 0 delay so it goes out this tick
    this.queue.push({ botId, username: state.username, text: msg, sendAt: Date.now() });
  }

  onBotGotHit(botId: string): void {
    const state = this.bots.get(botId);
    if (!state) return;
    if (Math.random() > state.personality.hitReactChance) return;
    if (!this.canBotChat(state)) return;

    const delay = 800 + Math.random() * 2500; // 0.8-3.3s reaction time
    this.tryQueue(botId, state, 'react_got_hit', delay);
  }

  onBotHitSomeone(botId: string): void {
    const state = this.bots.get(botId);
    if (!state) return;
    if (Math.random() > state.personality.ownHitReactChance) return;
    if (!this.canBotChat(state)) return;

    const delay = 500 + Math.random() * 2000;
    this.tryQueue(botId, state, 'trash_talk', delay);
  }

  onBotBanked(botId: string): void {
    const state = this.bots.get(botId);
    if (!state) return;
    if (Math.random() > state.personality.bankReactChance) return;
    if (!this.canBotChat(state)) return;

    const delay = 300 + Math.random() * 1500;
    this.tryQueue(botId, state, 'celebrate_bank', delay);
  }

  /**
   * Called when ANY chat message is received (from real player or another bot).
   * May trigger a bot to respond.
   */
  onChatReceived(senderId: string, username: string, message: string): void {
    this.lastChatSenderId = senderId;
    this.lastChatMessage = message;
    this.lastChatTime = Date.now();

    // Open/extend conversation window
    if (!this.conversationActive) {
      this.conversationActive = true;
      this.burstCount = 0;
      this.maxBurst = 3 + Math.floor(Math.random() * 3);
    }
    this.conversationEnd = Date.now() + 15000 + Math.random() * 10000;

    // Pick a random bot to potentially respond
    const candidates = Array.from(this.bots.entries()).filter(
      ([id, s]) => id !== senderId && this.canBotChat(s) && Math.random() < s.personality.respondToChat,
    );

    if (candidates.length === 0) return;

    // Only one bot responds (at most)
    const [responderId, responderState] = pick(candidates);
    const category = categorizeMessage(message);
    const delay = 2000 + Math.random() * 6000; // 2-8s response delay

    this.tryQueue(responderId, responderState, category, delay);
  }

  /**
   * Occasionally a bot may initiate unprompted social chat.
   * Called from BotManager on a slow timer.
   */
  tryInitiateSocial(): void {
    const candidates = Array.from(this.bots.entries()).filter(
      ([_, s]) => this.canBotChat(s) && Math.random() < s.personality.initiateChance,
    );
    if (candidates.length === 0) return;

    const [botId, state] = pick(candidates);
    const delay = 500 + Math.random() * 2000;
    this.tryQueue(botId, state, 'initiate_social', delay);
  }

  // ---- Update / flush ----

  /**
   * Process queued messages and return any that are ready to send.
   * Call this every server tick.
   */
  update(_dt: number): OutgoingChat[] {
    const now = Date.now();
    const outgoing: OutgoingChat[] = [];

    // Expire conversation window
    if (this.conversationActive && now > this.conversationEnd) {
      this.conversationActive = false;
      this.burstCount = 0;
      // Long silence after conversation
      this.globalCooldownEnd = now + 40000 + Math.random() * 80000;
    }

    // Process queue
    const remaining: QueuedMessage[] = [];
    for (const msg of this.queue) {
      if (now < msg.sendAt) {
        remaining.push(msg);
        continue;
      }

      // Check global cooldown
      if (now < this.globalCooldownEnd) {
        remaining.push(msg);
        continue;
      }

      // Check per-bot cooldown & limits
      const state = this.bots.get(msg.botId);
      if (!state || state.messagesSent >= state.maxMessages) continue;
      if (now < state.perBotCooldownEnd) {
        remaining.push(msg);
        continue;
      }

      // Final dedup check (another bot may have said same thing since queuing)
      if (this.isDuplicate(msg.text)) continue;

      // Send it
      this.recordSent(msg.text);
      state.messagesSent++;
      state.perBotCooldownEnd = now + 15000 + Math.random() * 30000; // 15-45s per-bot cooldown
      outgoing.push({ botId: msg.botId, username: msg.username, message: msg.text });

      // Update global pacing
      this.burstCount++;
      if (this.conversationActive) {
        this.globalCooldownEnd = now + 2000 + Math.random() * 4000;
        if (this.burstCount >= this.maxBurst) {
          this.conversationActive = false;
          this.burstCount = 0;
          this.globalCooldownEnd = now + 40000 + Math.random() * 80000;
        }
      } else {
        this.globalCooldownEnd = now + 30000 + Math.random() * 60000;
      }
    }

    this.queue = remaining;
    return outgoing;
  }

  // ---- Private helpers ----

  private canBotChat(state: BotChatState): boolean {
    if (state.messagesSent >= state.maxMessages) return false;
    if (Date.now() < state.perBotCooldownEnd) return false;
    return true;
  }

  private tryQueue(botId: string, state: BotChatState, category: string, delayMs: number): void {
    const template = T[category];
    if (!template) return;

    // Try up to 3 times to generate a non-duplicate
    for (let attempt = 0; attempt < 3; attempt++) {
      const msg = buildFromParts(template, state.personality);
      if (!this.isDuplicate(msg)) {
        this.queue.push({
          botId,
          username: state.username,
          text: msg,
          sendAt: Date.now() + delayMs,
        });
        return;
      }
    }
    // All attempts duplicated — skip silently (natural silence)
  }

  private isDuplicate(message: string): boolean {
    return this.sentMessages.has(message.toLowerCase().trim());
  }

  private recordSent(message: string): void {
    this.sentMessages.add(message.toLowerCase().trim());
  }
}
