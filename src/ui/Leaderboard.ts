export interface LeaderBirdRun {
  date: string;
  coinsEarned: number;
  level: number;
  highestStreak: number;
  highestHeat: number;
  npcHits: number;
}

const LEADERBIRD_KEY = 'birdgame_leaderbird';

export class LeaderBird {
  private container: HTMLElement;
  private visible = false;
  private currentTab: 'best' | 'records' | 'murmurations' = 'best';
  private onClose: (() => void) | null = null;
  private onFetchMurmurations: (() => Promise<Array<{ name: string; tag: string; formation_level: number; season_coins_banked: number }>>) | null = null;
  private runs: LeaderBirdRun[] = [];

  constructor() {
    this.loadRuns();

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.8);
      z-index: 2000;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: linear-gradient(180deg, #1a2a3a 0%, #2a4a6a 100%);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      color: #fff;
      text-align: center;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'LEADERBIRD';
    panel.appendChild(title);

    // Tabs
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      justify-content: center;
    `;

    const bestTab = this.createTab('BEST RUNS', true);
    const recordsTab = this.createTab('RECORDS', false);
    const murmTab = this.createTab('MURMURATIONS', false);
    const allTabs = [bestTab, recordsTab, murmTab];

    bestTab.addEventListener('click', () => {
      this.currentTab = 'best';
      this.setActiveTabMulti(bestTab, allTabs);
      this.refresh();
    });

    recordsTab.addEventListener('click', () => {
      this.currentTab = 'records';
      this.setActiveTabMulti(recordsTab, allTabs);
      this.refresh();
    });

    murmTab.addEventListener('click', () => {
      this.currentTab = 'murmurations';
      this.setActiveTabMulti(murmTab, allTabs);
      this.refresh();
    });

    tabContainer.appendChild(bestTab);
    tabContainer.appendChild(recordsTab);
    tabContainer.appendChild(murmTab);
    panel.appendChild(tabContainer);

    // Content
    const content = document.createElement('div');
    content.id = 'leaderbird-content';
    content.style.cssText = `
      color: #fff;
      min-height: 300px;
    `;
    panel.appendChild(content);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      closeBtn.style.transform = 'scale(1.02)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      closeBtn.style.transform = 'scale(1)';
    });
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
    panel.appendChild(closeBtn);

    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  private createTab(label: string, active: boolean): HTMLElement {
    const tab = document.createElement('button');
    tab.style.cssText = `
      padding: 10px 24px;
      background: ${active ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
      border: 1px solid ${active ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)'};
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    `;
    tab.textContent = label;
    tab.dataset.active = active ? 'true' : 'false';
    tab.addEventListener('mouseenter', () => {
      tab.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    tab.addEventListener('mouseleave', () => {
      if (tab.dataset.active !== 'true') {
        tab.style.background = 'rgba(255, 255, 255, 0.05)';
      } else {
        tab.style.background = 'rgba(255, 255, 255, 0.2)';
      }
    });
    return tab;
  }

  private setActiveTab(active: HTMLElement, inactive: HTMLElement): void {
    active.style.background = 'rgba(255, 255, 255, 0.2)';
    active.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    active.dataset.active = 'true';
    inactive.style.background = 'rgba(255, 255, 255, 0.05)';
    inactive.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    inactive.dataset.active = 'false';
  }

  private setActiveTabMulti(active: HTMLElement, allTabs: HTMLElement[]): void {
    for (const tab of allTabs) {
      if (tab === active) {
        tab.style.background = 'rgba(255, 255, 255, 0.2)';
        tab.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        tab.dataset.active = 'true';
      } else {
        tab.style.background = 'rgba(255, 255, 255, 0.05)';
        tab.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        tab.dataset.active = 'false';
      }
    }
  }

  private loadRuns(): void {
    try {
      const saved = localStorage.getItem(LEADERBIRD_KEY);
      if (saved) {
        this.runs = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load leaderbird:', error);
      this.runs = [];
    }
  }

  private saveRuns(): void {
    try {
      localStorage.setItem(LEADERBIRD_KEY, JSON.stringify(this.runs));
    } catch (error) {
      console.warn('Failed to save leaderbird:', error);
    }
  }

  /**
   * Record a game run to the leaderboard
   */
  addRun(run: LeaderBirdRun): void {
    this.runs.push(run);
    this.runs.sort((a, b) => b.coinsEarned - a.coinsEarned);
    if (this.runs.length > 50) {
      this.runs = this.runs.slice(0, 50);
    }
    this.saveRuns();
  }

  async show(): Promise<void> {
    this.loadRuns();
    this.visible = true;
    this.container.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    await this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  async refresh(): Promise<void> {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;

    if (this.currentTab === 'best') {
      this.renderBestRuns(content);
    } else if (this.currentTab === 'records') {
      this.renderRecords(content);
    } else if (this.currentTab === 'murmurations') {
      await this.renderMurmurations(content);
    }
  }

  private renderBestRuns(content: HTMLElement): void {
    if (this.runs.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
          <div style="font-size: 48px; margin-bottom: 16px;">🐦</div>
          <div style="font-size: 16px; margin-bottom: 8px;">No runs yet!</div>
          <div style="font-size: 13px;">Play the game and bank some coins to see your best runs here.</div>
        </div>
      `;
      return;
    }

    const sorted = [...this.runs].sort((a, b) => b.coinsEarned - a.coinsEarned);
    const top10 = sorted.slice(0, 10);

    let html = `
      <div style="display: flex; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px; font-size: 12px; font-weight: bold; color: rgba(255,255,255,0.6);">
        <div style="width: 40px;">#</div>
        <div style="flex: 1;">DATE</div>
        <div style="width: 80px; text-align: right;">COINS</div>
        <div style="width: 60px; text-align: right;">LEVEL</div>
        <div style="width: 60px; text-align: right;">STREAK</div>
        <div style="width: 50px; text-align: right;">HITS</div>
      </div>
    `;

    for (let i = 0; i < top10.length; i++) {
      const run = top10[i];
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
      const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#fff';
      const dateStr = this.formatRunDate(run.date);

      html += `
        <div style="display: flex; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; align-items: center; transition: all 0.2s;"
             onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
             onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
          <div style="width: 40px; font-weight: bold; color: ${rankColor};">${medal}${medal ? '' : rank}</div>
          <div style="flex: 1; font-size: 13px; color: rgba(255,255,255,0.8);">${dateStr}</div>
          <div style="width: 80px; text-align: right; color: #FFD700; font-weight: bold;">${this.formatNumber(run.coinsEarned)}</div>
          <div style="width: 60px; text-align: right; color: rgba(255,255,255,0.7);">Lv${run.level}</div>
          <div style="width: 60px; text-align: right; color: #ff8844;">${run.highestStreak}x</div>
          <div style="width: 50px; text-align: right; color: rgba(255,255,255,0.7);">${run.npcHits}</div>
        </div>
      `;
    }

    content.innerHTML = html;
  }

  private renderRecords(content: HTMLElement): void {
    if (this.runs.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
          <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
          <div style="font-size: 16px; margin-bottom: 8px;">No records yet!</div>
          <div style="font-size: 13px;">Play the game to start setting personal records.</div>
        </div>
      `;
      return;
    }

    const bestCoins = Math.max(...this.runs.map(r => r.coinsEarned));
    const bestStreak = Math.max(...this.runs.map(r => r.highestStreak));
    const bestHeat = Math.max(...this.runs.map(r => r.highestHeat));
    const bestHits = Math.max(...this.runs.map(r => r.npcHits));
    const highestLevel = Math.max(...this.runs.map(r => r.level));
    const totalRuns = this.runs.length;
    const totalCoins = this.runs.reduce((sum, r) => sum + r.coinsEarned, 0);
    const totalHits = this.runs.reduce((sum, r) => sum + r.npcHits, 0);

    const records = [
      { label: 'Most Coins (Single Run)', value: this.formatNumber(bestCoins), icon: '💰', color: '#FFD700' },
      { label: 'Highest Streak', value: `${bestStreak}x`, icon: '⚡', color: '#ff8844' },
      { label: 'Highest Heat', value: `${Math.round(bestHeat)}`, icon: '🔥', color: '#ff4444' },
      { label: 'Most NPC Hits (Single Run)', value: `${bestHits}`, icon: '💩', color: '#aa88ff' },
      { label: 'Highest Level Reached', value: `${highestLevel}`, icon: '⭐', color: '#44aaff' },
      { label: 'Total Runs Played', value: `${totalRuns}`, icon: '🎮', color: '#44ff88' },
      { label: 'All-Time Coins Earned', value: this.formatNumber(totalCoins), icon: '🏦', color: '#FFD700' },
      { label: 'All-Time NPC Hits', value: this.formatNumber(totalHits), icon: '🎯', color: '#ff6688' },
    ];

    let html = '';
    for (const record of records) {
      html += `
        <div style="display: flex; align-items: center; padding: 14px 16px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px; border-left: 3px solid ${record.color};"
             onmouseenter="this.style.background='rgba(255,255,255,0.08)'"
             onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
          <div style="font-size: 28px; margin-right: 16px;">${record.icon}</div>
          <div style="flex: 1;">
            <div style="font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 2px;">${record.label}</div>
            <div style="font-size: 22px; font-weight: bold; color: ${record.color};">${record.value}</div>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;
  }

  private formatRunDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  setOnFetchMurmurations(callback: () => Promise<Array<{ name: string; tag: string; formation_level: number; season_coins_banked: number }>>): void {
    this.onFetchMurmurations = callback;
  }

  private async renderMurmurations(content: HTMLElement): Promise<void> {
    content.innerHTML = `
      <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.5);">Loading...</div>
    `;

    try {
      const data = await this.onFetchMurmurations?.();
      if (!data || data.length === 0) {
        content.innerHTML = `
          <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
            <div style="font-size: 32px; margin-bottom: 12px;">🐦</div>
            <div>No Murmurations found.</div>
          </div>
        `;
        return;
      }

      let html = `
        <div style="display: flex; padding: 8px 12px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px; font-size: 12px; font-weight: bold; color: rgba(255,255,255,0.6);">
          <div style="width: 40px;">#</div>
          <div style="flex: 1;">NAME</div>
          <div style="width: 50px; text-align: center;">TAG</div>
          <div style="width: 50px; text-align: center;">FORM.</div>
          <div style="width: 80px; text-align: right;">SEASON</div>
        </div>
      `;

      for (let i = 0; i < data.length; i++) {
        const m = data[i];
        const rank = i + 1;
        const medal = rank === 1 ? '\uD83E\uDD47' : rank === 2 ? '\uD83E\uDD48' : rank === 3 ? '\uD83E\uDD49' : '';
        const rankColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#fff';

        html += `
          <div style="display: flex; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; align-items: center;"
               onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
               onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
            <div style="width: 40px; font-weight: bold; color: ${rankColor};">${medal}${medal ? '' : rank}</div>
            <div style="flex: 1; font-size: 13px; color: rgba(255,255,255,0.9); font-weight: bold;">${m.name}</div>
            <div style="width: 50px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.5);">[${m.tag}]</div>
            <div style="width: 50px; text-align: center; font-size: 13px; color: #aaccff; font-weight: bold;">F${m.formation_level}</div>
            <div style="width: 80px; text-align: right; color: #ffdd44; font-weight: bold;">${this.formatNumber(m.season_coins_banked)}</div>
          </div>
        `;
      }

      content.innerHTML = html;
    } catch {
      content.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ff6666;">Failed to load Murmurations leaderboard.</div>
      `;
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
