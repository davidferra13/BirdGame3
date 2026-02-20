/**
 * LoadingScreen - Professional loading screen with progress bar
 * Displays asset loading progress to prevent blank screens during initialization
 */
export class LoadingScreen {
  private container: HTMLElement;
  private progressBar: HTMLElement;
  private progressFill: HTMLElement;
  private progressText: HTMLElement;
  private statusText: HTMLElement;
  private loadingTips: string[];
  private tipElement: HTMLElement;
  private startTime: number = 0;
  private minDisplayTime: number = 500; // Minimum 500ms to prevent flash

  constructor() {
    this.loadingTips = [
      'Tip: Press SPACE to ascend and K to descend',
      'Tip: Hit NPCs to earn coins and build your streak',
      'Tip: Banking in the sanctuary saves your coins',
      'Tip: Watch your heat level - get wanted at 5+',
      'Tip: Dive bombing builds massive speed!',
      'Tip: Complete missions for bonus rewards',
      'Tip: Customize your bird in the shop',
      'Tip: Explore all 14 districts of the city',
    ];

    this.container = this.createLoadingUI();
    this.tipElement = this.container.querySelector('#loading-tip')!;
    this.progressBar = this.container.querySelector('#progress-bar')!;
    this.progressFill = this.container.querySelector('#progress-fill')!;
    this.progressText = this.container.querySelector('#progress-text')!;
    this.statusText = this.container.querySelector('#status-text')!;

    document.body.appendChild(this.container);

    // Rotate tips every 3 seconds
    setInterval(() => this.rotateTip(), 3000);
  }

  private createLoadingUI(): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #1a2a3a 0%, #0f4c81 50%, #87ceeb 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: 'Arial', sans-serif;
      color: #ffffff;
      opacity: 1;
      transition: opacity 0.5s ease-out;
    `;

    // Game Title with seagull icon
    const title = document.createElement('h1');
    title.style.cssText = `
      font-size: 64px;
      font-weight: bold;
      margin: 0 0 60px 0;
      text-shadow: 0 0 30px rgba(135, 206, 235, 0.8), 0 4px 10px rgba(0, 0, 0, 0.5);
      animation: pulse 2s ease-in-out infinite;
      display: flex;
      align-items: center;
      gap: 16px;
    `;

    // Inline SVG seagull icon
    const seagullSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    seagullSvg.setAttribute('viewBox', '0 0 64 64');
    seagullSvg.setAttribute('width', '72');
    seagullSvg.setAttribute('height', '72');
    seagullSvg.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))';
    seagullSvg.innerHTML = `
      <!-- Body -->
      <ellipse cx="32" cy="34" rx="14" ry="10" fill="#f5f5f5"/>
      <!-- Head -->
      <circle cx="46" cy="26" r="7" fill="#ffffff"/>
      <!-- Eye -->
      <circle cx="48" cy="25" r="1.5" fill="#222"/>
      <!-- Beak -->
      <polygon points="53,26 60,28 53,29" fill="#e8a020"/>
      <line x1="53" y1="27.5" x2="59" y2="28" stroke="#c4841a" stroke-width="0.5"/>
      <!-- Red beak spot -->
      <circle cx="55" cy="28.2" r="1" fill="#cc3333"/>
      <!-- Left wing (spread) -->
      <path d="M28,30 Q14,18 4,14 Q12,22 18,30 Z" fill="#8a9bae"/>
      <!-- Right wing (spread) -->
      <path d="M36,30 Q42,20 38,12 Q38,22 36,30 Z" fill="#8a9bae"/>
      <!-- Wing tips -->
      <path d="M4,14 Q2,13 1,11" stroke="#5a6a7a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M38,12 Q38,10 37,8" stroke="#5a6a7a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Tail -->
      <polygon points="18,36 10,40 12,34" fill="#9aa8b8"/>
      <!-- Feet -->
      <line x1="30" y1="44" x2="28" y2="52" stroke="#e8a020" stroke-width="1.5"/>
      <line x1="34" y1="44" x2="36" y2="52" stroke="#e8a020" stroke-width="1.5"/>
      <line x1="26" y1="52" x2="30" y2="52" stroke="#e8a020" stroke-width="1.5"/>
      <line x1="34" y1="52" x2="38" y2="52" stroke="#e8a020" stroke-width="1.5"/>
    `;
    title.appendChild(seagullSvg);

    const titleText = document.createElement('span');
    titleText.textContent = 'BIRD GAME 3D';
    title.appendChild(titleText);

    container.appendChild(title);

    // Progress Container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 500px;
      max-width: 80%;
      margin-bottom: 20px;
    `;

    // Progress Bar Background
    const progressBar = document.createElement('div');
    progressBar.id = 'progress-bar';
    progressBar.style.cssText = `
      width: 100%;
      height: 30px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3), inset 0 2px 5px rgba(0, 0, 0, 0.5);
      position: relative;
    `;

    // Progress Bar Fill
    const progressFill = document.createElement('div');
    progressFill.id = 'progress-fill';
    progressFill.style.cssText = `
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #4CAF50 0%, #81C784 100%);
      border-radius: 15px;
      transition: width 0.3s ease-out;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);
    `;
    progressBar.appendChild(progressFill);

    // Progress Text (percentage)
    const progressText = document.createElement('div');
    progressText.id = 'progress-text';
    progressText.textContent = '0%';
    progressText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      pointer-events: none;
    `;
    progressBar.appendChild(progressText);

    progressContainer.appendChild(progressBar);
    container.appendChild(progressContainer);

    // Status Text (current asset name)
    const statusText = document.createElement('div');
    statusText.id = 'status-text';
    statusText.textContent = 'Initializing...';
    statusText.style.cssText = `
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
      margin-bottom: 40px;
      min-height: 24px;
      text-align: center;
    `;
    container.appendChild(statusText);

    // Loading Tip
    const tipElement = document.createElement('div');
    tipElement.id = 'loading-tip';
    tipElement.textContent = this.getRandomTip();
    tipElement.style.cssText = `
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      max-width: 500px;
      padding: 0 20px;
      font-style: italic;
    `;
    container.appendChild(tipElement);

    // Add pulsing animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
      }
    `;
    document.head.appendChild(style);

    return container;
  }

  /**
   * Update loading progress
   * @param loaded - Number of bytes/assets loaded
   * @param total - Total bytes/assets to load
   * @param assetName - Name of current asset being loaded
   */
  public updateProgress(loaded: number, total: number, assetName: string = ''): void {
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;

    this.progressFill.style.width = `${percentage}%`;
    this.progressText.textContent = `${percentage}%`;

    if (assetName) {
      // Extract filename from path
      const filename = assetName.split('/').pop() || assetName;
      this.statusText.textContent = `Loading ${filename}...`;
    }
  }

  /**
   * Show the loading screen
   */
  public show(): void {
    this.container.style.display = 'flex';
    this.container.style.opacity = '1';
    this.startTime = Date.now();
    this.rotateTip(); // Show initial tip
  }

  /**
   * Hide the loading screen with smooth fade out
   */
  public async hide(): Promise<void> {
    // Ensure minimum display time
    const elapsed = Date.now() - this.startTime;
    if (elapsed < this.minDisplayTime) {
      await new Promise(resolve => setTimeout(resolve, this.minDisplayTime - elapsed));
    }

    // Fade out
    this.container.style.opacity = '0';

    // Wait for fade animation, then hide
    await new Promise(resolve => setTimeout(resolve, 500));
    this.container.style.display = 'none';
  }

  /**
   * Show error state
   */
  public showError(message: string, onRetry?: () => void): void {
    this.statusText.textContent = message;
    this.statusText.style.color = '#ff6666';
    this.progressFill.style.background = 'linear-gradient(90deg, #f44336 0%, #e57373 100%)';

    if (onRetry) {
      // Add retry button
      const retryBtn = document.createElement('button');
      retryBtn.textContent = '🔄 Retry';
      retryBtn.style.cssText = `
        margin-top: 20px;
        padding: 12px 32px;
        font-size: 16px;
        font-weight: bold;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        transition: all 0.2s;
      `;
      retryBtn.onmouseenter = () => {
        retryBtn.style.transform = 'scale(1.05)';
        retryBtn.style.boxShadow = '0 6px 15px rgba(0, 0, 0, 0.4)';
      };
      retryBtn.onmouseleave = () => {
        retryBtn.style.transform = 'scale(1)';
        retryBtn.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.3)';
      };
      retryBtn.onclick = onRetry;

      this.container.appendChild(retryBtn);
    }
  }

  /**
   * Get a random loading tip
   */
  private getRandomTip(): string {
    return this.loadingTips[Math.floor(Math.random() * this.loadingTips.length)];
  }

  /**
   * Rotate to a new tip
   */
  private rotateTip(): void {
    if (this.container.style.display !== 'flex') return;

    this.tipElement.style.opacity = '0';
    setTimeout(() => {
      this.tipElement.textContent = this.getRandomTip();
      this.tipElement.style.opacity = '0.7';
    }, 300);

    this.tipElement.style.transition = 'opacity 0.3s';
  }

  /**
   * Remove the loading screen from DOM
   */
  public dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

