import { CosmeticsSystem, CosmeticItem } from '../systems/CosmeticsSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { ScoreSystem } from '../systems/ScoreSystem';

export class ShopMenu {
  private container: HTMLElement;
  private isVisible = false;

  private categorySkins: HTMLElement;
  private categoryTrails: HTMLElement;
  private categorySplats: HTMLElement;

  private cosmetics: CosmeticsSystem;
  private progression: ProgressionSystem;
  private score: ScoreSystem;

  private onPurchase: (itemId: string) => void = () => {};
  private onEquip: (itemId: string) => void = () => {};
  private onClose: (() => void) | null = null;

  constructor(cosmetics: CosmeticsSystem, progression: ProgressionSystem, score: ScoreSystem) {
    this.cosmetics = cosmetics;
    this.progression = progression;
    this.score = score;

    this.container = this.createShopUI();
    document.body.appendChild(this.container);

    this.categorySkins = this.container.querySelector('#shop-skins')!;
    this.categoryTrails = this.container.querySelector('#shop-trails')!;
    this.categorySplats = this.container.querySelector('#shop-splats')!;

    this.refresh();
  }

  private createShopUI(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 40px;
      box-sizing: border-box;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      max-width: 900px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 32px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.1);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h1');
    title.textContent = '🛍️ COSMETICS SHOP';
    title.style.cssText = `
      margin: 0;
      font-size: 32px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 0 0 20px #6688ff;
    `;
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-size: 24px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255, 100, 100, 0.3)';
      closeBtn.style.borderColor = '#ff6464';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      closeBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    };
    closeBtn.onclick = () => { this.hide(); this.onClose?.(); };
    header.appendChild(closeBtn);

    modal.appendChild(header);

    // Currency Display
    const currencyBar = document.createElement('div');
    currencyBar.id = 'shop-currency';
    currencyBar.style.cssText = `
      display: flex;
      gap: 24px;
      justify-content: center;
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
    `;
    modal.appendChild(currencyBar);

    // Categories
    const categoriesContainer = document.createElement('div');
    categoriesContainer.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

    categoriesContainer.appendChild(this.createCategory('Skins', 'shop-skins'));
    categoriesContainer.appendChild(this.createCategory('Trails', 'shop-trails'));
    categoriesContainer.appendChild(this.createCategory('Splats', 'shop-splats'));

    modal.appendChild(categoriesContainer);
    container.appendChild(modal);

    return container;
  }

  private createCategory(title: string, id: string): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom: 16px;';

    const header = document.createElement('h2');
    header.textContent = title;
    header.style.cssText = `
      color: #aaccff;
      font-size: 20px;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.id = id;
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    `;
    section.appendChild(grid);

    return section;
  }

  private createItemCard(item: CosmeticItem): HTMLElement {
    const card = document.createElement('div');
    const isLocked = this.progression.level < item.unlockLevel;
    const isOwned = item.owned;
    const canAfford =
      item.currency === 'coins' ? this.score.totalCoins >= item.cost :
      item.currency === 'worms' ? (this.score.totalWorms + this.progression.worms) >= item.cost :
      item.currency === 'golden_eggs' ? this.progression.goldenEggs >= item.cost :
      this.progression.feathers >= item.cost;

    card.style.cssText = `
      background: ${isOwned ? 'rgba(100, 200, 100, 0.1)' : 'rgba(255, 255, 255, 0.05)'};
      border: 2px solid ${isOwned ? '#44ff88' : 'rgba(255, 255, 255, 0.1)'};
      border-radius: 8px;
      padding: 16px;
      transition: all 0.2s;
      cursor: ${isLocked ? 'not-allowed' : 'pointer'};
      opacity: ${isLocked ? '0.5' : '1'};
    `;

    if (!isLocked) {
      card.onmouseenter = () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.3)';
      };
      card.onmouseleave = () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = 'none';
      };
    }

    // Name
    const name = document.createElement('div');
    name.textContent = item.name;
    name.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: ${isOwned ? '#44ff88' : '#ffffff'};
      margin-bottom: 8px;
    `;
    card.appendChild(name);

    // Status/Price
    const info = document.createElement('div');
    info.style.cssText = 'font-size: 14px; margin-bottom: 12px;';

    if (isLocked) {
      info.innerHTML = `<span style="color: #ff8888;">🔒 Level ${item.unlockLevel}</span>`;
    } else if (isOwned) {
      info.innerHTML = '<span style="color: #44ff88;">✓ Owned</span>';
    } else {
      const currencyIcon = item.currency === 'coins' ? '💰' : item.currency === 'worms' ? '🪱' : item.currency === 'golden_eggs' ? '🥚' : '🪶';
      const color = canAfford ? '#ffdd44' : '#ff8888';
      info.innerHTML = `<span style="color: ${color};">${currencyIcon} ${item.cost}</span>`;
    }
    card.appendChild(info);

    // Action Button
    const button = document.createElement('button');
    button.style.cssText = `
      width: 100%;
      padding: 8px;
      border-radius: 4px;
      border: none;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    if (isLocked) {
      button.textContent = 'LOCKED';
      button.style.background = '#666';
      button.style.color = '#aaa';
      button.disabled = true;
    } else if (isOwned) {
      button.textContent = 'EQUIP';
      button.style.background = '#44ff88';
      button.style.color = '#000';
      button.onclick = () => {
        this.onEquip(item.id);
        this.refresh();
      };
      button.onmouseenter = () => {
        button.style.background = '#66ffaa';
      };
      button.onmouseleave = () => {
        button.style.background = '#44ff88';
      };
    } else if (canAfford) {
      button.textContent = 'PURCHASE';
      button.style.background = '#6688ff';
      button.style.color = '#fff';
      button.onclick = () => {
        this.onPurchase(item.id);
        this.refresh();
      };
      button.onmouseenter = () => {
        button.style.background = '#88aaff';
      };
      button.onmouseleave = () => {
        button.style.background = '#6688ff';
      };
    } else {
      button.textContent = 'TOO EXPENSIVE';
      button.style.background = '#ff6666';
      button.style.color = '#fff';
      button.disabled = true;
    }

    card.appendChild(button);
    return card;
  }

  refresh(): void {
    // Update currency display
    const currencyBar = this.container.querySelector('#shop-currency')!;
    currencyBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: bold;">
        <span style="color: #ffdd44;">💰</span>
        <span style="color: #ffffff;">${this.score.totalCoins} Coins</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: bold;">
        <span style="color: #dd8844;">🪱</span>
        <span style="color: #ffffff;">${this.score.totalWorms + this.progression.worms} Worms</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: bold;">
        <span style="color: #44ffaa;">🪶</span>
        <span style="color: #ffffff;">${this.progression.feathers} Feathers</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: bold;">
        <span style="color: #ffdd44;">🥚</span>
        <span style="color: #ffffff;">${this.progression.goldenEggs} Golden Eggs</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: bold;">
        <span style="color: #aaccff;">⭐</span>
        <span style="color: #ffffff;">Level ${this.progression.level}</span>
      </div>
    `;

    // Refresh item grids
    const skins = this.cosmetics.items.filter(i => i.category === 'skin');
    const trails = this.cosmetics.items.filter(i => i.category === 'trail');
    const splats = this.cosmetics.items.filter(i => i.category === 'splat');

    this.categorySkins.innerHTML = '';
    skins.forEach(item => this.categorySkins.appendChild(this.createItemCard(item)));

    this.categoryTrails.innerHTML = '';
    trails.forEach(item => this.categoryTrails.appendChild(this.createItemCard(item)));

    this.categorySplats.innerHTML = '';
    splats.forEach(item => this.categorySplats.appendChild(this.createItemCard(item)));
  }

  show(): void {
    this.refresh();
    this.container.style.display = 'flex';
    this.isVisible = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  hide(): void {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  setPurchaseCallback(callback: (itemId: string) => void): void {
    this.onPurchase = callback;
  }

  setEquipCallback(callback: (itemId: string) => void): void {
    this.onEquip = callback;
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  get visible(): boolean {
    return this.isVisible;
  }
}
