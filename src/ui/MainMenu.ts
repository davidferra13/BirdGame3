import { makeKeyboardAccessible } from '../utils/AccessibilityHelper';
import { AuthState } from '../services/AuthStateManager';
export class MainMenu {
  private container: HTMLElement;
  private visible = true;
  private onPlay: (() => void) | null = null;
  private onStats: (() => void) | null = null;
  private onCosmetics: (() => void) | null = null;
  private onSettings: (() => void) | null = null;
  private onHowToPlay: (() => void) | null = null;
  private onQuit: (() => void) | null = null;
  private onCredits: (() => void) | null = null;
  private onAchievements: (() => void) | null = null;
  private onLeaderboard: (() => void) | null = null;
  private onInviteFriend: (() => void) | null = null;
  private onMurmurations: (() => void) | null = null;
  private onAccount: (() => void) | null = null;
  private usernameLabel: HTMLElement;
  private accountBtn: HTMLButtonElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.setAttribute('role', 'navigation');
    this.container.setAttribute('aria-label', 'Main menu');
    this.container.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:linear-gradient(180deg,#1a2a3a 0%,#2a4a6a 50%,#87ceeb 100%);' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;z-index:100;';

    // User strip (top-right): username + account/sign-in button
    const userStrip = document.createElement('div');
    userStrip.style.cssText =
      'position:absolute;top:20px;right:24px;display:flex;align-items:center;' +
      'gap:12px;z-index:101;pointer-events:auto;';

    this.usernameLabel = document.createElement('span');
    this.usernameLabel.style.cssText =
      'color:rgba(255,255,255,0.8);font-size:14px;' +
      'font-family:"Segoe UI",system-ui,sans-serif;';
    this.usernameLabel.textContent = 'Guest';
    userStrip.appendChild(this.usernameLabel);

    this.accountBtn = document.createElement('button');
    this.accountBtn.setAttribute('type', 'button');
    this.accountBtn.setAttribute('aria-label', 'Account or sign in');
    this.accountBtn.style.cssText =
      'padding:8px 16px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(255,255,255,0.3);border-radius:4px;' +
      'color:#fff;font-size:12px;font-weight:bold;letter-spacing:1px;' +
      'cursor:pointer;transition:background 0.2s;';
    this.accountBtn.textContent = 'SIGN IN';
    this.accountBtn.addEventListener('mouseenter', () =>
      this.accountBtn.style.background = 'rgba(255,255,255,0.2)');
    this.accountBtn.addEventListener('mouseleave', () =>
      this.accountBtn.style.background = 'rgba(255,255,255,0.1)');
    this.accountBtn.addEventListener('click', () => this.onAccount?.());
    userStrip.appendChild(this.accountBtn);

    this.container.appendChild(userStrip);

    // Title
    const title = document.createElement('h1');
    title.setAttribute('role', 'heading');
    title.setAttribute('aria-level', '1');
    title.style.cssText =
      'font-size:72px;font-weight:bold;margin-bottom:10px;' +
      'text-shadow:3px 3px 6px rgba(0,0,0,0.5);letter-spacing:4px;';
    title.textContent = 'BIRD GAME 3';
    this.container.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText =
      'font-size:18px;color:rgba(255,255,255,0.7);margin-bottom:60px;letter-spacing:2px;';
    subtitle.textContent = 'Poop on everything.';
    this.container.appendChild(subtitle);

    // Buttons
    const buttons = [
      { label: 'PLAY', ariaLabel: 'Start game', action: () => this.onPlay?.() },
      { label: 'HOW TO PLAY', ariaLabel: 'View tutorial and controls', action: () => this.onHowToPlay?.() },
      { label: 'PROFILE', ariaLabel: 'View player profile', action: () => this.onStats?.() },
      { label: 'LEADERBIRD', ariaLabel: 'View global LeaderBird rankings', action: () => this.onLeaderboard?.() },
      { label: 'ACHIEVEMENTS', ariaLabel: 'View achievements', action: () => this.onAchievements?.() },
      { label: 'COSMETICS', ariaLabel: 'Customize bird appearance', action: () => this.onCosmetics?.() },
      { label: 'MURMURATIONS', ariaLabel: 'Open Murmurations (clans)', action: () => this.onMurmurations?.() },
      { label: 'INVITE A FRIEND', ariaLabel: 'Share game with friends', action: () => this.onInviteFriend?.() },
      { label: 'SETTINGS', ariaLabel: 'Open settings menu', action: () => this.onSettings?.() },
      { label: 'CREDITS', ariaLabel: 'View credits', action: () => this.onCredits?.() },
      { label: 'QUIT', ariaLabel: 'Exit game', action: () => this.onQuit?.() },
    ];

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.setAttribute('aria-label', btn.ariaLabel);
      el.setAttribute('type', 'button');
      el.style.cssText =
        'display:block;width:240px;padding:14px 0;margin:6px 0;' +
        'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);' +
        'color:#fff;font-size:18px;font-weight:bold;letter-spacing:3px;' +
        'cursor:pointer;border-radius:4px;pointer-events:auto;' +
        'transition:background 0.2s,transform 0.1s;';
      el.textContent = btn.label;
      el.addEventListener('mouseenter', () => {
        el.style.background = 'rgba(255,255,255,0.25)';
        el.style.transform = 'scale(1.05)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'rgba(255,255,255,0.1)';
        el.style.transform = 'scale(1)';
      });
      el.addEventListener('click', btn.action);

      // Add keyboard accessibility (Enter/Space to activate)
      el.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.action();
        }
      });

      this.container.appendChild(el);
    }

    // Controls hint
    const hint = document.createElement('div');
    hint.style.cssText =
      'position:absolute;bottom:30px;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;';
    hint.innerHTML = 'WASD — Fly &nbsp;|&nbsp; S — Brake &nbsp;|&nbsp; SPACE — Ascend &nbsp;|&nbsp; K — Fast Descend &nbsp;|&nbsp; L-SHIFT — Slow Descend &nbsp;|&nbsp; CAPS — Bomber Mode';
    this.container.appendChild(hint);

    document.body.appendChild(this.container);
  }

  setCallbacks(
    onPlay: () => void,
    onStats: () => void,
    onCosmetics: () => void,
    onSettings: () => void,
    onHowToPlay: () => void,
    onQuit: () => void,
    onCredits: () => void,
    onAchievements: () => void,
    onLeaderboard: () => void,
    onInviteFriend: () => void,
    onAccount?: () => void,
    onMurmurations?: () => void,
  ): void {
    this.onPlay = onPlay;
    this.onStats = onStats;
    this.onCosmetics = onCosmetics;
    this.onSettings = onSettings;
    this.onHowToPlay = onHowToPlay;
    this.onQuit = onQuit;
    this.onCredits = onCredits;
    this.onAchievements = onAchievements;
    this.onLeaderboard = onLeaderboard;
    this.onInviteFriend = onInviteFriend;
    this.onAccount = onAccount ?? null;
    this.onMurmurations = onMurmurations ?? null;
  }

  /** Update the user strip display based on auth state */
  updateAuthDisplay(state: AuthState): void {
    if (state.isAuthenticated) {
      this.usernameLabel.textContent = state.username;
      this.accountBtn.textContent = 'ACCOUNT';
      this.accountBtn.setAttribute('aria-label', 'Open account settings');
    } else {
      this.usernameLabel.textContent = 'Guest';
      this.accountBtn.textContent = 'SIGN IN';
      this.accountBtn.setAttribute('aria-label', 'Sign in or create account');
    }
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
