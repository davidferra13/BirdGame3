import { CosmeticsSystem, CosmeticItem } from '../systems/CosmeticsSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { AchievementsPanel } from './AchievementsPanel';
import { authStateManager } from '../services/AuthStateManager';

type TabId = 'overview' | 'stats' | 'cosmetics';

export class ProfilePage {
  private container: HTMLElement;
  private panel: HTMLElement;
  private headerArea: HTMLElement;
  private tabBar: HTMLElement;
  private contentArea: HTMLElement;
  private visible = false;
  private currentTab: TabId = 'overview';

  private murmurationInfo: { name: string; tag: string; role: string; formationLevel: number } | null = null;
  private onClose: (() => void) | null = null;
  private onOpenShop: (() => void) | null = null;
  private onEquip: ((itemId: string) => void) | null = null;
  private onViewAchievements: (() => void) | null = null;

  private cosmetics: CosmeticsSystem;
  private progression: ProgressionSystem;
  private score: ScoreSystem;
  private achievements: AchievementsPanel;

  constructor(
    cosmetics: CosmeticsSystem,
    progression: ProgressionSystem,
    score: ScoreSystem,
    achievements: AchievementsPanel,
  ) {
    this.cosmetics = cosmetics;
    this.progression = progression;
    this.score = score;
    this.achievements = achievements;

    // Overlay container
    this.container = document.createElement('div');
    this.container.id = 'profile-page';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-label', 'Player profile');
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

  /* ── Public API ── */

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

  refresh(): void {
    this.buildHeader();
    this.buildTabs();
    this.renderContent();
  }

  setData(cosmetics: CosmeticsSystem, progression: ProgressionSystem, score: ScoreSystem): void {
    this.cosmetics = cosmetics;
    this.progression = progression;
    this.score = score;
  }

  setOnClose(cb: () => void): void { this.onClose = cb; }
  setOnOpenShop(cb: () => void): void { this.onOpenShop = cb; }
  setEquipCallback(cb: (itemId: string) => void): void { this.onEquip = cb; }
  setOnViewAchievements(cb: () => void): void { this.onViewAchievements = cb; }

  setMurmurationInfo(info: { name: string; tag: string; role: string; formationLevel: number } | null): void {
    this.murmurationInfo = info;
  }

  get isVisible(): boolean { return this.visible; }

  destroy(): void {
    this.container.remove();
  }

  /* ── Header ── */

  private buildHeader(): void {
    this.headerArea.innerHTML = '';
    this.headerArea.style.cssText = 'margin-bottom:20px;';

    // Row 1: avatar + name + level + close button
    const topRow = document.createElement('div');
    topRow.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;' +
      'padding-bottom:16px;border-bottom:2px solid rgba(255,255,255,0.08);';

    const identity = document.createElement('div');
    identity.style.cssText = 'display:flex;align-items:center;gap:16px;';

    // Bird avatar circle
    const avatar = document.createElement('div');
    const hexColor = '#' + this.cosmetics.getBirdColor().toString(16).padStart(6, '0');
    avatar.style.cssText =
      `width:56px;height:56px;border-radius:50%;background:${hexColor};` +
      'border:3px solid rgba(255,255,255,0.3);display:flex;align-items:center;' +
      'justify-content:center;font-size:28px;flex-shrink:0;';
    avatar.textContent = '\uD83D\uDC26';

    const nameBlock = document.createElement('div');
    const authState = authStateManager.getState();
    const username = document.createElement('div');
    username.style.cssText = 'font-size:24px;font-weight:bold;letter-spacing:1px;';
    username.textContent = authState.isAuthenticated ? authState.username : 'Guest';
    const levelLabel = document.createElement('div');
    levelLabel.style.cssText = 'font-size:14px;color:#aaccff;margin-top:2px;';
    levelLabel.textContent = `Level ${this.progression.level}`;
    nameBlock.appendChild(username);
    nameBlock.appendChild(levelLabel);

    identity.appendChild(avatar);
    identity.appendChild(nameBlock);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Close profile');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText =
      'background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);' +
      'color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;' +
      'cursor:pointer;transition:all 0.2s;flex-shrink:0;';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.25)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.1)';
    });
    closeBtn.addEventListener('click', () => { this.hide(); this.onClose?.(); });

    topRow.appendChild(identity);
    topRow.appendChild(closeBtn);
    this.headerArea.appendChild(topRow);

    // Row 2: XP bar
    const xpRow = document.createElement('div');
    xpRow.style.cssText =
      'margin-top:16px;padding:12px 16px;background:rgba(0,0,0,0.3);border-radius:8px;';

    const xpLabels = document.createElement('div');
    xpLabels.style.cssText =
      'display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;';
    const progress = Math.max(0, Math.min(1, this.progression.xpProgress));
    xpLabels.innerHTML =
      `<span style="color:#aaccff;">Level ${this.progression.level}</span>` +
      `<span style="color:rgba(255,255,255,0.5);">${Math.round(progress * 100)}% to Level ${this.progression.level + 1}</span>`;

    const barOuter = document.createElement('div');
    barOuter.style.cssText =
      'height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;';
    const barInner = document.createElement('div');
    barInner.style.cssText =
      `height:100%;width:${Math.round(progress * 100)}%;` +
      'background:linear-gradient(90deg,#4488ff,#44ddff);border-radius:4px;transition:width 0.3s;';
    barOuter.appendChild(barInner);

    // Currency row
    const currencyRow = document.createElement('div');
    currencyRow.style.cssText =
      'display:flex;gap:24px;justify-content:center;margin-top:12px;font-size:15px;font-weight:bold;';
    currencyRow.innerHTML =
      `<span><span style="color:#ffdd44;">Coins</span> ${this.score.bankedCoins.toLocaleString()}</span>` +
      `<span><span style="color:#44ffaa;">Feathers</span> ${this.progression.feathers.toLocaleString()}</span>`;

    xpRow.appendChild(xpLabels);
    xpRow.appendChild(barOuter);
    xpRow.appendChild(currencyRow);
    this.headerArea.appendChild(xpRow);
  }

  /* ── Tabs ── */

  private buildTabs(): void {
    this.tabBar.innerHTML = '';
    this.tabBar.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;margin-top:20px;';

    const tabs: { id: TabId; label: string }[] = [
      { id: 'overview', label: 'OVERVIEW' },
      { id: 'stats', label: 'STATS' },
      { id: 'cosmetics', label: 'COSMETICS' },
    ];

    for (const tab of tabs) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-label', `${tab.label} tab`);
      btn.textContent = tab.label;
      const isActive = tab.id === this.currentTab;
      btn.style.cssText =
        `flex:1;padding:10px 0;border:2px solid ${isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'};` +
        `background:${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.03)'};` +
        'color:#fff;font-size:13px;font-weight:bold;letter-spacing:2px;' +
        'border-radius:6px;cursor:pointer;transition:all 0.2s;';
      btn.addEventListener('mouseenter', () => {
        if (tab.id !== this.currentTab) btn.style.background = 'rgba(255,255,255,0.1)';
      });
      btn.addEventListener('mouseleave', () => {
        if (tab.id !== this.currentTab) btn.style.background = 'rgba(255,255,255,0.03)';
      });
      btn.addEventListener('click', () => {
        this.currentTab = tab.id;
        this.buildTabs();
        this.renderContent();
      });
      this.tabBar.appendChild(btn);
    }
  }

  /* ── Content Router ── */

  private renderContent(): void {
    this.contentArea.innerHTML = '';
    this.contentArea.style.cssText = 'min-height:250px;';

    switch (this.currentTab) {
      case 'overview': this.renderOverview(); break;
      case 'stats': this.renderStats(); break;
      case 'cosmetics': this.renderCosmetics(); break;
    }
  }

  /* ── Overview Tab ── */

  private renderOverview(): void {
    // Equipped Loadout
    const loadoutSection = this.createSection('EQUIPPED LOADOUT');
    const loadoutGrid = document.createElement('div');
    loadoutGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;';

    const skinItem = this.cosmetics.items.find(i => i.id === 'skin_' + this.cosmetics.equippedSkin);
    const trailItem = this.cosmetics.items.find(i => i.id === 'trail_' + this.cosmetics.equippedTrail);
    const splatItem = this.cosmetics.items.find(i => i.id === 'splat_' + this.cosmetics.equippedSplat);

    loadoutGrid.appendChild(this.createEquippedCard('SKIN', skinItem?.name ?? 'Default', '#44ddff'));
    loadoutGrid.appendChild(this.createEquippedCard('TRAIL', trailItem?.name ?? 'None', '#ffdd44'));
    loadoutGrid.appendChild(this.createEquippedCard('SPLAT', splatItem?.name ?? 'Standard', '#ff88aa'));
    loadoutSection.appendChild(loadoutGrid);
    this.contentArea.appendChild(loadoutSection);

    // Murmuration info
    if (this.murmurationInfo) {
      const murmSection = this.createSection('MURMURATION');
      const murmGrid = document.createElement('div');
      murmGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;';
      murmGrid.appendChild(this.createEquippedCard('NAME', this.murmurationInfo.name, '#88aaff'));
      murmGrid.appendChild(this.createEquippedCard('TAG', `[${this.murmurationInfo.tag}]`, '#aaccff'));
      murmGrid.appendChild(this.createEquippedCard('ROLE', this.murmurationInfo.role.toUpperCase(), '#44ffaa'));
      murmSection.appendChild(murmGrid);

      const formBar = document.createElement('div');
      formBar.style.cssText = 'margin-top:8px;padding:10px 14px;background:rgba(0,0,0,0.3);border-radius:6px;';
      formBar.innerHTML =
        `<div style="font-size:12px;color:#aaccff;margin-bottom:4px;">Formation Level ${this.murmurationInfo.formationLevel}</div>` +
        `<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">` +
        `<div style="height:100%;width:${this.murmurationInfo.formationLevel * 10}%;background:linear-gradient(90deg,#4488ff,#44ddff);border-radius:3px;"></div></div>`;
      murmSection.appendChild(formBar);
      this.contentArea.appendChild(murmSection);
    }

    // Highlights
    const stats = this.progression.stats;
    const highlightsSection = this.createSection('HIGHLIGHTS');
    const highlightsGrid = document.createElement('div');
    highlightsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';

    highlightsGrid.appendChild(this.createHighlightCard('Total NPC Hits', stats.totalNPCHits.toLocaleString(), '#ff8844'));
    highlightsGrid.appendChild(this.createHighlightCard('Lifetime Coins', stats.lifetimeCoinsEarned.toLocaleString(), '#ffdd44'));
    highlightsGrid.appendChild(this.createHighlightCard('Distance Flown', this.formatDistance(stats.totalDistanceFlown), '#44ddff'));
    highlightsGrid.appendChild(this.createHighlightCard('Highest Streak', stats.highestStreak + 'x', '#ff4488'));
    highlightsSection.appendChild(highlightsGrid);
    this.contentArea.appendChild(highlightsSection);

    // Achievements summary
    const achieveSection = this.createSection('ACHIEVEMENTS');
    const unlocked = this.achievements.getUnlockedIds().length;
    const total = this.achievements.getTotalCount();
    const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    const achieveBar = document.createElement('div');
    achieveBar.style.cssText =
      'padding:14px 16px;background:rgba(0,0,0,0.3);border-radius:8px;';

    const achieveLabel = document.createElement('div');
    achieveLabel.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;';
    achieveLabel.innerHTML =
      `<span><strong>${unlocked}</strong> / ${total} unlocked</span>` +
      `<span style="color:#FFD700;">${pct}%</span>`;

    const achieveOuter = document.createElement('div');
    achieveOuter.style.cssText = 'height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;';
    const achieveInner = document.createElement('div');
    achieveInner.style.cssText =
      `height:100%;width:${pct}%;background:linear-gradient(90deg,#FFD700,#FFA500);border-radius:3px;`;
    achieveOuter.appendChild(achieveInner);

    achieveBar.appendChild(achieveLabel);
    achieveBar.appendChild(achieveOuter);

    // View All button
    const viewAllBtn = document.createElement('button');
    viewAllBtn.setAttribute('type', 'button');
    viewAllBtn.textContent = 'VIEW ALL ACHIEVEMENTS';
    viewAllBtn.style.cssText =
      'display:block;width:100%;padding:10px;margin-top:10px;' +
      'background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);' +
      'color:#FFD700;font-size:13px;font-weight:bold;letter-spacing:2px;' +
      'border-radius:6px;cursor:pointer;transition:all 0.2s;';
    viewAllBtn.addEventListener('mouseenter', () => {
      viewAllBtn.style.background = 'rgba(255,215,0,0.2)';
    });
    viewAllBtn.addEventListener('mouseleave', () => {
      viewAllBtn.style.background = 'rgba(255,215,0,0.1)';
    });
    viewAllBtn.addEventListener('click', () => {
      this.hide();
      this.onViewAchievements?.();
    });

    achieveSection.appendChild(achieveBar);
    achieveSection.appendChild(viewAllBtn);
    this.contentArea.appendChild(achieveSection);
  }

  /* ── Stats Tab ── */

  private renderStats(): void {
    const stats = this.progression.stats;

    // Combat
    const combat = this.createSection('COMBAT');
    this.addStatRows(combat, [
      ['Total NPC Hits', stats.totalNPCHits.toLocaleString()],
      ['Tourists Hit', stats.totalTouristsHit.toLocaleString()],
      ['Business Hit', stats.totalBusinessHit.toLocaleString()],
      ['Performers Hit', stats.totalPerformersHit.toLocaleString()],
      ['Police Hit', stats.totalPoliceHit.toLocaleString()],
      ['Chefs Hit', stats.totalChefsHit.toLocaleString()],
      ['Treemen Hit', stats.totalTreemenHit.toLocaleString()],
    ]);
    this.contentArea.appendChild(combat);

    // Banking
    const banking = this.createSection('BANKING');
    this.addStatRows(banking, [
      ['Lifetime Coins Earned', stats.lifetimeCoinsEarned.toLocaleString(), '#ffdd44'],
      ['Total Banks', stats.totalBanks.toLocaleString()],
      ['Largest Single Bank', stats.largestBank.toLocaleString(), '#ffdd44'],
    ]);
    this.contentArea.appendChild(banking);

    // Flight
    const flight = this.createSection('FLIGHT');
    this.addStatRows(flight, [
      ['Distance Flown', this.formatDistance(stats.totalDistanceFlown), '#44ddff'],
      ['Times Grounded', stats.totalTimesGrounded.toLocaleString(), '#ff6666'],
    ]);
    this.contentArea.appendChild(flight);

    // Personal Bests
    const records = this.createSection('PERSONAL BESTS');
    this.addStatRows(records, [
      ['Highest Heat', Math.round(stats.highestHeat).toString(), '#ff4444'],
      ['Highest Streak', stats.highestStreak + 'x', '#ff8844'],
      ['Largest Bank', stats.largestBank.toLocaleString(), '#ffdd44'],
    ]);
    this.contentArea.appendChild(records);
  }

  /* ── Cosmetics Tab ── */

  private renderCosmetics(): void {
    // Shop button
    const shopBtn = document.createElement('button');
    shopBtn.setAttribute('type', 'button');
    shopBtn.textContent = 'OPEN COSMETICS SHOP';
    shopBtn.style.cssText =
      'display:block;width:100%;padding:12px;margin-bottom:20px;' +
      'background:rgba(102,136,255,0.15);border:2px solid rgba(102,136,255,0.3);' +
      'border-radius:8px;color:#88aaff;font-size:15px;font-weight:bold;' +
      'letter-spacing:2px;cursor:pointer;transition:all 0.2s;';
    shopBtn.addEventListener('mouseenter', () => {
      shopBtn.style.background = 'rgba(102,136,255,0.25)';
    });
    shopBtn.addEventListener('mouseleave', () => {
      shopBtn.style.background = 'rgba(102,136,255,0.15)';
    });
    shopBtn.addEventListener('click', () => {
      this.hide();
      this.onOpenShop?.();
    });
    this.contentArea.appendChild(shopBtn);

    // Category grids
    this.renderCosmeticCategory(
      'SKINS', this.cosmetics.items.filter(i => i.category === 'skin'),
      'skin_' + this.cosmetics.equippedSkin,
    );
    this.renderCosmeticCategory(
      'TRAILS', this.cosmetics.items.filter(i => i.category === 'trail'),
      'trail_' + this.cosmetics.equippedTrail,
    );
    this.renderCosmeticCategory(
      'SPLATS', this.cosmetics.items.filter(i => i.category === 'splat'),
      'splat_' + this.cosmetics.equippedSplat,
    );
  }

  private renderCosmeticCategory(title: string, items: CosmeticItem[], equippedId: string): void {
    const section = this.createSection(title);
    const grid = document.createElement('div');
    grid.style.cssText =
      'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;';

    for (const item of items) {
      const isEquipped = item.id === equippedId;
      const isOwned = item.owned;

      const card = document.createElement('div');
      card.style.cssText =
        `background:${isEquipped ? 'rgba(68,255,136,0.08)' : 'rgba(255,255,255,0.03)'};` +
        `border:2px solid ${isEquipped ? '#44ff88' : 'rgba(255,255,255,0.08)'};` +
        `border-radius:8px;padding:14px;opacity:${isOwned ? '1' : '0.45'};` +
        'transition:all 0.2s;';

      const nameEl = document.createElement('div');
      nameEl.style.cssText =
        `font-size:14px;font-weight:bold;color:${isEquipped ? '#44ff88' : '#fff'};margin-bottom:6px;`;
      nameEl.textContent = item.name;
      card.appendChild(nameEl);

      const statusEl = document.createElement('div');
      statusEl.style.cssText = 'font-size:12px;';

      if (isEquipped) {
        statusEl.style.color = '#44ff88';
        statusEl.textContent = 'EQUIPPED';
        card.appendChild(statusEl);
      } else if (!isOwned) {
        statusEl.style.color = '#ff8888';
        statusEl.textContent = `Level ${item.unlockLevel}`;
        card.appendChild(statusEl);
      } else {
        // Owned but not equipped
        statusEl.style.color = 'rgba(255,255,255,0.5)';
        statusEl.textContent = 'OWNED';
        card.appendChild(statusEl);

        const equipBtn = document.createElement('button');
        equipBtn.setAttribute('type', 'button');
        equipBtn.textContent = 'EQUIP';
        equipBtn.style.cssText =
          'width:100%;padding:6px;margin-top:8px;background:#44ff88;color:#000;' +
          'border:none;border-radius:4px;font-weight:bold;font-size:12px;cursor:pointer;' +
          'transition:opacity 0.2s;';
        equipBtn.addEventListener('mouseenter', () => { equipBtn.style.opacity = '0.8'; });
        equipBtn.addEventListener('mouseleave', () => { equipBtn.style.opacity = '1'; });
        equipBtn.addEventListener('click', () => {
          this.onEquip?.(item.id);
          this.renderCosmetics();
        });
        card.appendChild(equipBtn);
      }

      grid.appendChild(card);
    }

    section.appendChild(grid);
    this.contentArea.appendChild(section);
  }

  /* ── Shared Helpers ── */

  private createSection(title: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:20px;';
    const heading = document.createElement('div');
    heading.style.cssText =
      'font-size:11px;font-weight:bold;letter-spacing:3px;' +
      'color:rgba(255,255,255,0.4);margin-bottom:10px;';
    heading.textContent = title;
    section.appendChild(heading);
    return section;
  }

  private createEquippedCard(label: string, value: string, accentColor: string): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText =
      'padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;text-align:center;';
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.4);margin-bottom:6px;';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.style.cssText = `font-size:16px;font-weight:bold;color:${accentColor};`;
    valueEl.textContent = value;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    return card;
  }

  private createHighlightCard(label: string, value: string, accentColor: string): HTMLElement {
    const card = document.createElement('div');
    card.style.cssText =
      'padding:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:8px;text-align:center;';
    const valueEl = document.createElement('div');
    valueEl.style.cssText = `font-size:24px;font-weight:bold;color:${accentColor};margin-bottom:4px;`;
    valueEl.textContent = value;
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);';
    labelEl.textContent = label;
    card.appendChild(valueEl);
    card.appendChild(labelEl);
    return card;
  }

  private addStatRows(section: HTMLElement, rows: [string, string, string?][]): void {
    for (const [label, value, color] of rows) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;padding:8px 12px;' +
        'background:rgba(255,255,255,0.02);border-radius:4px;margin-bottom:3px;' +
        'transition:background 0.2s;';
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.06)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.02)'; });

      const labelEl = document.createElement('span');
      labelEl.style.cssText = 'color:rgba(255,255,255,0.55);font-size:14px;';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.style.cssText = `font-weight:bold;font-size:14px;color:${color ?? '#fff'};`;
      valueEl.textContent = value;

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      section.appendChild(row);
    }
  }

  private formatDistance(d: number): string {
    if (d >= 1000) return (d / 1000).toFixed(1) + ' km';
    return Math.round(d) + ' m';
  }
}
