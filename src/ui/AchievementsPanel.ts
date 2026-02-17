interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  icon?: string;
}

const ACHIEVEMENTS_KEY = 'birdgame_achievements';

export class AchievementsPanel {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;
  private achievements: Achievement[] = [];

  constructor() {
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
      max-width: 700px;
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
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    title.textContent = 'ACHIEVEMENTS';
    panel.appendChild(title);

    // Stats summary
    const summary = document.createElement('div');
    summary.id = 'achievements-summary';
    summary.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 24px;
      font-size: 14px;
    `;
    panel.appendChild(summary);

    // Achievements grid
    const grid = document.createElement('div');
    grid.id = 'achievements-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    `;
    panel.appendChild(grid);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      display: block;
      width: 100%;
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

    // Initialize default achievements then load saved state
    this.initializeDefaultAchievements();
    this.loadAchievements();
  }

  private initializeDefaultAchievements(): void {
    this.achievements = [
      { id: 'first_hit', name: 'First Strike', description: 'Hit your first NPC', unlocked: false, icon: '💩' },
      { id: 'heat_10', name: 'Hot Streak', description: 'Reach Heat level 10', unlocked: false, icon: '🔥' },
      { id: 'heat_20', name: 'Blazing', description: 'Reach Heat level 20', unlocked: false, icon: '🔥🔥' },
      { id: 'streak_10', name: 'Combo Master', description: 'Achieve a 10x hit streak', unlocked: false, icon: '⚡' },
      { id: 'bank_1000', name: 'Banker', description: 'Earn 1,000 lifetime coins', unlocked: false, icon: '💰' },
      { id: 'bank_10000', name: 'Tycoon', description: 'Earn 10,000 lifetime coins', unlocked: false, icon: '💎' },
      { id: 'distance_10km', name: 'Wanderer', description: 'Fly a total of 10km', unlocked: false, icon: '🛫' },
      { id: 'distance_100km', name: 'Explorer', description: 'Fly a total of 100km', unlocked: false, icon: '🌍' },
      { id: 'level_10', name: 'Experienced', description: 'Reach level 10', unlocked: false, icon: '⭐' },
      { id: 'level_25', name: 'Master Bird', description: 'Reach level 25', unlocked: false, icon: '🌟' },
      { id: 'tourist_hunter', name: 'Tourist Trap', description: 'Hit 100 tourists', unlocked: false, icon: '📸' },
      { id: 'chef_menace', name: "Chef's Nightmare", description: 'Hit 50 chefs', unlocked: false, icon: '👨‍🍳' },
    ];
  }

  private loadAchievements(): void {
    try {
      const saved = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (saved) {
        const savedData: { id: string; unlocked: boolean; unlockedAt?: string }[] = JSON.parse(saved);
        for (const entry of savedData) {
          const achievement = this.achievements.find(a => a.id === entry.id);
          if (achievement) {
            achievement.unlocked = entry.unlocked;
            if (entry.unlockedAt) {
              achievement.unlockedAt = entry.unlockedAt;
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load achievements:', error);
    }
  }

  private saveAchievements(): void {
    try {
      const data = this.achievements.map(a => ({
        id: a.id,
        unlocked: a.unlocked,
        unlockedAt: a.unlockedAt,
      }));
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save achievements:', error);
    }
  }

  async show(): Promise<void> {
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
    const summary = document.getElementById('achievements-summary');
    const grid = document.getElementById('achievements-grid');
    if (!summary || !grid) return;

    const totalAchievements = this.achievements.length;
    const unlockedCount = this.achievements.filter(a => a.unlocked).length;
    const percentage = Math.round((unlockedCount / totalAchievements) * 100);

    summary.innerHTML = `
      <strong>${unlockedCount}</strong> / ${totalAchievements} unlocked
      <span style="color: #FFD700;">(${percentage}%)</span>
    `;

    grid.innerHTML = '';
    for (const achievement of this.achievements) {
      const card = this.createAchievementCard(achievement);
      grid.appendChild(card);
    }
  }

  private createAchievementCard(achievement: Achievement): HTMLElement {
    const card = document.createElement('div');
    const opacity = achievement.unlocked ? 1 : 0.4;
    const bgColor = achievement.unlocked ? 'rgba(50, 200, 100, 0.1)' : 'rgba(100, 100, 100, 0.1)';
    const borderColor = achievement.unlocked ? 'rgba(50, 200, 100, 0.4)' : 'rgba(100, 100, 100, 0.3)';

    card.style.cssText = `
      background: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 8px;
      padding: 16px;
      opacity: ${opacity};
      transition: all 0.2s;
      cursor: default;
    `;

    if (achievement.unlocked) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 4px 12px rgba(50, 200, 100, 0.3)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      });
    }

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 32px;
      filter: ${achievement.unlocked ? 'none' : 'grayscale(100%)'};
    `;
    icon.textContent = achievement.icon || '🏆';

    const titleContainer = document.createElement('div');
    titleContainer.style.flex = '1';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: ${achievement.unlocked ? '#fff' : 'rgba(255,255,255,0.6)'};
      margin-bottom: 2px;
    `;
    titleEl.textContent = achievement.name;

    const desc = document.createElement('div');
    desc.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    `;
    desc.textContent = achievement.description;

    titleContainer.appendChild(titleEl);
    titleContainer.appendChild(desc);

    header.appendChild(icon);
    header.appendChild(titleContainer);
    card.appendChild(header);

    if (achievement.unlocked && achievement.unlockedAt) {
      const date = document.createElement('div');
      date.style.cssText = `
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 8px;
        text-align: right;
      `;
      date.textContent = `Unlocked ${this.formatDate(new Date(achievement.unlockedAt))}`;
      card.appendChild(date);
    }

    return card;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /**
   * Check and unlock an achievement - persists to localStorage
   */
  async checkAndUnlock(achievementId: string): Promise<boolean> {
    const achievement = this.achievements.find(a => a.id === achievementId);
    if (!achievement || achievement.unlocked) return false;

    achievement.unlocked = true;
    achievement.unlockedAt = new Date().toISOString();
    this.saveAchievements();
    return true;
  }

  /**
   * Get list of achievement IDs that are unlocked
   */
  getUnlockedIds(): string[] {
    return this.achievements.filter(a => a.unlocked).map(a => a.id);
  }

  getTotalCount(): number {
    return this.achievements.length;
  }
}
