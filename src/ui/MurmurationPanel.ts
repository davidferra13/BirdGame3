/**
 * MurmurationPanel — Main Murmuration hub UI.
 * Shows roster, stats, challenges, chat, settings, and emblem.
 * Accessed from MainMenu and PauseMenu.
 * Follows existing imperative DOM pattern.
 */

import { MURMURATION } from '@/utils/Constants';
import type {
  Murmuration, MurmurationMember, MurmurationChallenge,
  MurmurationRole, EmblemConfig, MurmurationStats,
} from '@/types/murmuration';
import { createEmblemElement, DEFAULT_EMBLEM } from '@/ui/EmblemRenderer';
import { MurmurationChat } from '@/ui/MurmurationChat';

type PanelTab = 'roster' | 'stats' | 'challenges' | 'chat' | 'settings';

export class MurmurationPanel {
  private container: HTMLElement;
  private panel: HTMLElement;
  private headerArea: HTMLElement;
  private tabBar: HTMLElement;
  private contentArea: HTMLElement;
  private visible = false;
  private currentTab: PanelTab = 'roster';

  // Data
  private murmuration: Murmuration | null = null;
  private members: MurmurationMember[] = [];
  private challenges: MurmurationChallenge[] = [];
  private stats: MurmurationStats | null = null;
  private playerRole: MurmurationRole = 'fledgling';
  private chatWidget: MurmurationChat;

  // Callbacks
  private onClose: (() => void) | null = null;
  private onLeave: (() => void) | null = null;
  private onKick: ((userId: string) => void) | null = null;
  private onPromote: ((userId: string, role: MurmurationRole) => void) | null = null;
  private onEditEmblem: (() => void) | null = null;
  private onMvM: (() => void) | null = null;
  private onBrowse: (() => void) | null = null;
  private onCreate: (() => void) | null = null;
  private onDisband: (() => void) | null = null;
  private onUpdatePrivacy: ((privacy: string) => void) | null = null;
  private onTransferAlpha: ((userId: string) => void) | null = null;

  constructor() {
    this.chatWidget = new MurmurationChat();

    // Overlay
    this.container = document.createElement('div');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);z-index:2000;' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;' +
      'padding:40px;box-sizing:border-box;';

    // Panel
    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);' +
      'border-radius:16px;max-width:900px;width:100%;' +
      'max-height:80vh;overflow-y:auto;padding:32px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'border:2px solid rgba(255,255,255,0.1);';

    this.headerArea = document.createElement('div');
    this.tabBar = document.createElement('div');
    this.contentArea = document.createElement('div');

    this.panel.appendChild(this.headerArea);
    this.panel.appendChild(this.tabBar);
    this.panel.appendChild(this.contentArea);
    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);
  }

  getChatWidget(): MurmurationChat {
    return this.chatWidget;
  }

  setCallbacks(callbacks: {
    onClose: () => void;
    onLeave: () => void;
    onKick: (userId: string) => void;
    onPromote: (userId: string, role: MurmurationRole) => void;
    onEditEmblem: () => void;
    onMvM: () => void;
    onBrowse: () => void;
    onCreate: () => void;
    onDisband: () => void;
    onUpdatePrivacy: (privacy: string) => void;
    onTransferAlpha: (userId: string) => void;
  }): void {
    this.onClose = callbacks.onClose;
    this.onLeave = callbacks.onLeave;
    this.onKick = callbacks.onKick;
    this.onPromote = callbacks.onPromote;
    this.onEditEmblem = callbacks.onEditEmblem;
    this.onMvM = callbacks.onMvM;
    this.onBrowse = callbacks.onBrowse;
    this.onCreate = callbacks.onCreate;
    this.onDisband = callbacks.onDisband;
    this.onUpdatePrivacy = callbacks.onUpdatePrivacy;
    this.onTransferAlpha = callbacks.onTransferAlpha;
  }

  setData(
    murmuration: Murmuration | null,
    members: MurmurationMember[],
    challenges: MurmurationChallenge[],
    stats: MurmurationStats | null,
    playerRole: MurmurationRole,
  ): void {
    this.murmuration = murmuration;
    this.members = members;
    this.challenges = challenges;
    this.stats = stats;
    this.playerRole = playerRole;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  refresh(): void {
    if (!this.murmuration) {
      this.renderNoMurmuration();
      return;
    }
    this.buildHeader();
    this.buildTabs();
    this.renderContent();
  }

  // ── No Murmuration State ──

  private renderNoMurmuration(): void {
    this.headerArea.innerHTML = '';
    this.tabBar.innerHTML = '';
    this.contentArea.innerHTML = '';

    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:40px 20px;';

    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:64px;margin-bottom:16px;';
    icon.textContent = '\u{1F426}';
    empty.appendChild(icon);

    const msg = document.createElement('div');
    msg.style.cssText = 'font-size:18px;margin-bottom:8px;';
    msg.textContent = "You're not in a Murmuration";
    empty.appendChild(msg);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:30px;';
    sub.textContent = 'Join an existing group or create your own!';
    empty.appendChild(sub);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

    const browseBtn = this.btn('BROWSE', 'rgba(68,136,255,0.2)', '#88aaff');
    browseBtn.style.borderColor = 'rgba(68,136,255,0.4)';
    browseBtn.addEventListener('click', () => { this.hide(); this.onBrowse?.(); });

    const createBtn = this.btn('CREATE', 'rgba(68,255,136,0.2)', '#44ff88');
    createBtn.style.borderColor = 'rgba(68,255,136,0.4)';
    createBtn.addEventListener('click', () => { this.hide(); this.onCreate?.(); });

    btnRow.appendChild(browseBtn);
    btnRow.appendChild(createBtn);
    empty.appendChild(btnRow);

    // Close
    const closeBtn = this.btn('CLOSE', 'rgba(255,255,255,0.1)', '#fff');
    closeBtn.style.cssText += 'margin-top:20px;width:200px;';
    closeBtn.addEventListener('click', () => { this.hide(); this.onClose?.(); });
    empty.appendChild(closeBtn);

    this.contentArea.appendChild(empty);
  }

  // ── Header ──

  private buildHeader(): void {
    this.headerArea.innerHTML = '';
    if (!this.murmuration) return;

    const mur = this.murmuration;
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;gap:16px;padding-bottom:16px;' +
      'border-bottom:2px solid rgba(255,255,255,0.08);margin-bottom:16px;';

    // Emblem
    const emblem = createEmblemElement(
      mur.emblem_config || DEFAULT_EMBLEM,
      56,
      mur.formation_level >= 10,
    );
    row.appendChild(emblem);

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;';

    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:22px;font-weight:bold;';
    nameEl.textContent = mur.name;
    const tagEl = document.createElement('span');
    tagEl.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.5);';
    tagEl.textContent = `[${mur.tag}]`;
    nameRow.appendChild(nameEl);
    nameRow.appendChild(tagEl);
    info.appendChild(nameRow);

    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;';
    const maxMem = mur.formation_level >= 7 ? MURMURATION.MAX_MEMBERS_F7 : MURMURATION.MAX_MEMBERS;
    metaRow.textContent = `Formation ${mur.formation_level} · ${mur.member_count}/${maxMem} Members · ${mur.privacy === 'open' ? 'Open' : mur.privacy === 'invite_only' ? 'Invite Only' : 'Closed'}`;
    info.appendChild(metaRow);

    // Formation XP bar
    const xpThresholds = MURMURATION.FORMATION_XP_THRESHOLDS;
    const currentThreshold = xpThresholds[mur.formation_level - 1] || 0;
    const nextThreshold = xpThresholds[mur.formation_level] || xpThresholds[xpThresholds.length - 1];
    const xpInLevel = mur.formation_xp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    const progress = mur.formation_level >= 10 ? 1 : Math.min(1, xpInLevel / xpNeeded);

    const xpBar = document.createElement('div');
    xpBar.style.cssText = 'margin-top:8px;';
    const xpLabel = document.createElement('div');
    xpLabel.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px;';
    xpLabel.textContent = mur.formation_level >= 10
      ? 'MAX FORMATION'
      : `${mur.formation_xp.toLocaleString()} / ${nextThreshold.toLocaleString()} XP`;
    xpBar.appendChild(xpLabel);
    const barOuter = document.createElement('div');
    barOuter.style.cssText = 'height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;';
    const barInner = document.createElement('div');
    barInner.style.cssText =
      `height:100%;width:${Math.round(progress * 100)}%;` +
      'background:linear-gradient(90deg,#4488ff,#44ddff);border-radius:3px;transition:width 0.3s;';
    barOuter.appendChild(barInner);
    xpBar.appendChild(barOuter);
    info.appendChild(xpBar);

    row.appendChild(info);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText =
      'background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);' +
      'color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;' +
      'cursor:pointer;transition:all 0.2s;flex-shrink:0;';
    closeBtn.addEventListener('click', () => { this.hide(); this.onClose?.(); });
    row.appendChild(closeBtn);

    this.headerArea.appendChild(row);
  }

  // ── Tabs ──

  private buildTabs(): void {
    this.tabBar.innerHTML = '';
    this.tabBar.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';

    const tabs: { id: PanelTab; label: string; minFormation: number }[] = [
      { id: 'roster', label: 'ROSTER', minFormation: 1 },
      { id: 'stats', label: 'STATS', minFormation: 1 },
      { id: 'challenges', label: 'CHALLENGES', minFormation: 3 },
      { id: 'chat', label: 'CHAT', minFormation: 2 },
      { id: 'settings', label: 'SETTINGS', minFormation: 1 },
    ];

    const formLevel = this.murmuration?.formation_level || 1;

    for (const tab of tabs) {
      if (formLevel < tab.minFormation) continue;
      const isActive = tab.id === this.currentTab;
      const tabBtn = document.createElement('button');
      tabBtn.setAttribute('type', 'button');
      tabBtn.textContent = tab.label;
      tabBtn.style.cssText =
        `flex:1;padding:8px 0;border:2px solid ${isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'};` +
        `background:${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)'};` +
        'color:#fff;font-size:12px;font-weight:bold;letter-spacing:2px;' +
        'border-radius:6px;cursor:pointer;transition:all 0.2s;';
      tabBtn.addEventListener('click', () => {
        this.currentTab = tab.id;
        this.buildTabs();
        this.renderContent();
      });
      this.tabBar.appendChild(tabBtn);
    }
  }

  // ── Content Router ──

  private renderContent(): void {
    this.contentArea.innerHTML = '';
    this.contentArea.style.cssText = 'min-height:250px;';

    switch (this.currentTab) {
      case 'roster': this.renderRoster(); break;
      case 'stats': this.renderStats(); break;
      case 'challenges': this.renderChallenges(); break;
      case 'chat': this.renderChat(); break;
      case 'settings': this.renderSettings(); break;
    }
  }

  // ── Roster Tab ──

  private renderRoster(): void {
    const sorted = [...this.members].sort((a, b) => {
      const roleOrder: Record<MurmurationRole, number> = { alpha: 0, sentinel: 1, fledgling: 2 };
      return roleOrder[a.role] - roleOrder[b.role];
    });

    for (const member of sorted) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;padding:10px 12px;' +
        'background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px;';

      // Role badge
      const badge = document.createElement('div');
      const roleColor = member.role === 'alpha' ? '#ffdd44' : member.role === 'sentinel' ? '#88aaff' : 'rgba(255,255,255,0.4)';
      badge.style.cssText =
        `width:70px;font-size:10px;font-weight:bold;letter-spacing:1px;color:${roleColor};text-transform:uppercase;`;
      badge.textContent = member.role;
      row.appendChild(badge);

      // Name + level
      const nameCol = document.createElement('div');
      nameCol.style.cssText = 'flex:1;';
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:14px;font-weight:bold;';
      nameEl.textContent = member.username || 'Unknown';
      const levelEl = document.createElement('div');
      levelEl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
      levelEl.textContent = `Level ${member.level || '?'} · ${member.formation_xp_contributed.toLocaleString()} XP contributed`;
      nameCol.appendChild(nameEl);
      nameCol.appendChild(levelEl);
      row.appendChild(nameCol);

      // Actions (for alpha/sentinel)
      if (this.playerRole === 'alpha' && member.role !== 'alpha') {
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;';

        if (member.role === 'fledgling') {
          const promoteBtn = this.miniBtn('PROMOTE', '#88aaff');
          promoteBtn.addEventListener('click', () => this.onPromote?.(member.user_id, 'sentinel'));
          actions.appendChild(promoteBtn);
        } else if (member.role === 'sentinel') {
          const demoteBtn = this.miniBtn('DEMOTE', '#ffaa44');
          demoteBtn.addEventListener('click', () => this.onPromote?.(member.user_id, 'fledgling'));
          actions.appendChild(demoteBtn);
        }

        const kickBtn = this.miniBtn('KICK', '#ff6666');
        kickBtn.addEventListener('click', () => this.onKick?.(member.user_id));
        actions.appendChild(kickBtn);

        row.appendChild(actions);
      } else if (this.playerRole === 'sentinel' && member.role === 'fledgling') {
        const kickBtn = this.miniBtn('KICK', '#ff6666');
        kickBtn.addEventListener('click', () => this.onKick?.(member.user_id));
        row.appendChild(kickBtn);
      }

      this.contentArea.appendChild(row);
    }
  }

  // ── Stats Tab ──

  private renderStats(): void {
    if (!this.stats || !this.murmuration) return;
    const s = this.stats;
    const mur = this.murmuration;

    const statRows: [string, string, string?][] = [
      ['Total Coins Banked (All-Time)', mur.total_coins_banked.toLocaleString(), '#ffdd44'],
      ['Season Coins Banked', mur.season_coins_banked.toLocaleString(), '#ffdd44'],
      ['MvM Wins', mur.mvm_wins.toString(), '#44ff88'],
      ['MvM Losses', mur.mvm_losses.toString(), '#ff6666'],
      ['MvM Win Rate', `${s.mvm_win_rate}%`],
      ['Challenges Completed', s.challenges_completed.toString(), '#88aaff'],
      ['Average Member Level', s.average_member_level.toFixed(1)],
      ['Total Flight Distance', this.formatDistance(s.total_flight_distance), '#44ddff'],
    ];

    for (const [label, value, color] of statRows) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;padding:8px 12px;' +
        'background:rgba(255,255,255,0.02);border-radius:4px;margin-bottom:3px;';
      const labelEl = document.createElement('span');
      labelEl.style.cssText = 'color:rgba(255,255,255,0.55);font-size:14px;';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.style.cssText = `font-weight:bold;font-size:14px;color:${color ?? '#fff'};`;
      valueEl.textContent = value;
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      this.contentArea.appendChild(row);
    }
  }

  // ── Challenges Tab ──

  private renderChallenges(): void {
    if (this.challenges.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;padding:40px;color:rgba(255,255,255,0.4);';
      empty.textContent = 'No active challenges. Check back soon!';
      this.contentArea.appendChild(empty);
      return;
    }

    for (const challenge of this.challenges) {
      const card = document.createElement('div');
      card.style.cssText =
        'padding:14px;background:rgba(255,255,255,0.03);' +
        'border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:8px;';

      const typeColor = challenge.type === 'daily' ? '#ffdd44' : challenge.type === 'weekly' ? '#88aaff' : '#44ff88';
      const typeLabel = document.createElement('div');
      typeLabel.style.cssText = `font-size:10px;font-weight:bold;letter-spacing:2px;color:${typeColor};margin-bottom:6px;`;
      typeLabel.textContent = challenge.type.toUpperCase();
      card.appendChild(typeLabel);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:14px;margin-bottom:8px;';
      desc.textContent = challenge.objective.description;
      card.appendChild(desc);

      // Progress bar
      const progress = Math.min(1, challenge.objective.current / challenge.objective.target);
      const progressLabel = document.createElement('div');
      progressLabel.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;';
      progressLabel.textContent = `${challenge.objective.current.toLocaleString()} / ${challenge.objective.target.toLocaleString()}`;
      card.appendChild(progressLabel);

      const barOuter = document.createElement('div');
      barOuter.style.cssText = 'height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;';
      const barInner = document.createElement('div');
      barInner.style.cssText =
        `height:100%;width:${Math.round(progress * 100)}%;` +
        `background:${typeColor};border-radius:3px;transition:width 0.3s;`;
      barOuter.appendChild(barInner);
      card.appendChild(barOuter);

      if (challenge.expires_at) {
        const expires = document.createElement('div');
        expires.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.3);margin-top:6px;';
        const remaining = Math.max(0, new Date(challenge.expires_at).getTime() - Date.now());
        const hours = Math.floor(remaining / 3_600_000);
        expires.textContent = hours > 0 ? `${hours}h remaining` : 'Expiring soon';
        card.appendChild(expires);
      }

      this.contentArea.appendChild(card);
    }
  }

  // ── Chat Tab ──

  private renderChat(): void {
    this.contentArea.appendChild(this.chatWidget.getElement());
  }

  // ── Settings Tab ──

  private renderSettings(): void {
    if (!this.murmuration) return;
    const isAlpha = this.playerRole === 'alpha';

    // Edit emblem (alpha only)
    if (isAlpha) {
      const emblemBtn = this.btn('EDIT EMBLEM', 'rgba(68,136,255,0.2)', '#88aaff');
      emblemBtn.style.cssText += 'width:100%;margin-bottom:8px;';
      emblemBtn.addEventListener('click', () => this.onEditEmblem?.());
      this.contentArea.appendChild(emblemBtn);
    }

    // MvM PvP (Formation 5+, alpha or sentinel)
    if (this.murmuration.formation_level >= 5 && (this.playerRole === 'alpha' || this.playerRole === 'sentinel')) {
      const mvmBtn = this.btn('MvM PvP MATCHMAKER', 'rgba(255,136,68,0.2)', '#ff8844');
      mvmBtn.style.cssText += 'width:100%;margin-bottom:8px;';
      mvmBtn.addEventListener('click', () => { this.hide(); this.onMvM?.(); });
      this.contentArea.appendChild(mvmBtn);
    }

    // Transfer alpha (alpha only)
    if (isAlpha && this.members.length > 1) {
      const section = document.createElement('div');
      section.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);';

      const label = document.createElement('div');
      label.style.cssText = 'font-size:11px;font-weight:bold;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-bottom:8px;';
      label.textContent = 'TRANSFER ALPHA';

      const select = document.createElement('select');
      select.style.cssText =
        'width:100%;padding:8px;background:rgba(255,255,255,0.08);' +
        'border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#fff;font-size:13px;margin-bottom:8px;';
      for (const m of this.members.filter(m => m.role !== 'alpha')) {
        const opt = document.createElement('option');
        opt.value = m.user_id;
        opt.textContent = m.username || m.user_id;
        opt.style.cssText = 'background:#1a1a2e;';
        select.appendChild(opt);
      }

      const transferBtn = this.btn('TRANSFER', 'rgba(255,136,68,0.2)', '#ff8844');
      transferBtn.style.cssText += 'width:100%;';
      transferBtn.addEventListener('click', () => {
        if (select.value && confirm('Transfer Alpha role? This cannot be undone.')) {
          this.onTransferAlpha?.(select.value);
        }
      });

      section.appendChild(label);
      section.appendChild(select);
      section.appendChild(transferBtn);
      this.contentArea.appendChild(section);
    }

    // Leave / Disband
    const dangerZone = document.createElement('div');
    dangerZone.style.cssText = 'margin-top:30px;padding-top:16px;border-top:1px solid rgba(255,100,100,0.2);';

    const leaveBtn = this.btn('LEAVE MURMURATION', 'rgba(255,68,68,0.15)', '#ff6666');
    leaveBtn.style.cssText += 'width:100%;margin-bottom:8px;';
    leaveBtn.addEventListener('click', () => {
      if (confirm('Leave this Murmuration? You will have a 24h cooldown before joining another.')) {
        this.onLeave?.();
      }
    });
    dangerZone.appendChild(leaveBtn);

    if (isAlpha) {
      const disbandBtn = this.btn('DISBAND MURMURATION', 'rgba(255,0,0,0.2)', '#ff4444');
      disbandBtn.style.cssText += 'width:100%;';
      disbandBtn.addEventListener('click', () => {
        if (confirm('DISBAND this Murmuration? This is PERMANENT and cannot be undone!')) {
          this.onDisband?.();
        }
      });
      dangerZone.appendChild(disbandBtn);
    }

    this.contentArea.appendChild(dangerZone);
  }

  // ── Helpers ──

  private btn(label: string, bg: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.style.cssText =
      `padding:12px 20px;background:${bg};` +
      'border:1px solid rgba(255,255,255,0.2);border-radius:6px;' +
      `color:${color};font-size:14px;font-weight:bold;letter-spacing:2px;` +
      'cursor:pointer;transition:all 0.2s;';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    return btn;
  }

  private miniBtn(label: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.style.cssText =
      `padding:3px 8px;background:transparent;border:1px solid ${color};` +
      `border-radius:3px;color:${color};font-size:10px;font-weight:bold;` +
      'cursor:pointer;transition:all 0.2s;';
    return btn;
  }

  private formatDistance(d: number): string {
    if (d >= 1000) return (d / 1000).toFixed(1) + ' km';
    return Math.round(d) + ' m';
  }
}
