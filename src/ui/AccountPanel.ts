/**
 * AccountPanel
 * Modal overlay for account management: view profile, change username, sign out, delete account.
 * Follows the same modal pattern as CreditsPanel, AchievementsPanel, etc.
 */

import { signOut, updateUsername, deleteAccount, getCurrentProfile } from '../services/AuthService';
import { authStateManager } from '../services/AuthStateManager';

export class AccountPanel {
  private container: HTMLElement;
  private visible = false;
  private onClose: (() => void) | null = null;
  private onSignOut: (() => void) | null = null;

  // Dynamic elements
  private usernameDisplay: HTMLElement;
  private usernameInput: HTMLInputElement;
  private editBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private levelDisplay: HTMLElement;
  private coinsDisplay: HTMLElement;
  private feathersDisplay: HTMLElement;
  private errorMessage: HTMLElement;
  private deleteBtn: HTMLButtonElement;
  private deleteConfirmed = false;
  private editMode = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'account-panel';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Account settings');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.8);' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;z-index:2000;' +
      'pointer-events:auto;';

    const panel = document.createElement('div');
    panel.style.cssText =
      'background:linear-gradient(180deg,#1a2a3a,#2a4a6a);' +
      'border:2px solid rgba(255,255,255,0.3);border-radius:12px;' +
      'padding:30px;max-width:450px;width:90%;max-height:80vh;overflow-y:auto;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.5);';

    // Title
    const title = document.createElement('h2');
    title.style.cssText =
      'font-size:28px;font-weight:bold;text-align:center;margin:0 0 24px 0;' +
      'letter-spacing:3px;text-shadow:2px 2px 4px rgba(0,0,0,0.5);';
    title.textContent = 'ACCOUNT';
    panel.appendChild(title);

    // Profile section
    const profileSection = document.createElement('div');
    profileSection.style.cssText =
      'background:rgba(255,255,255,0.05);border-radius:8px;padding:20px;margin-bottom:20px;';

    // Username row
    const usernameRow = document.createElement('div');
    usernameRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px;';

    const usernameLabel = document.createElement('span');
    usernameLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:1px;';
    usernameLabel.textContent = 'USERNAME';

    this.usernameDisplay = document.createElement('span');
    this.usernameDisplay.style.cssText = 'font-size:20px;font-weight:bold;flex:1;';

    this.usernameInput = document.createElement('input');
    this.usernameInput.type = 'text';
    this.usernameInput.maxLength = 20;
    this.usernameInput.style.cssText =
      'flex:1;padding:8px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(135,206,235,0.5);border-radius:4px;' +
      'color:#fff;font-size:16px;font-family:"Segoe UI",system-ui,sans-serif;' +
      'outline:none;display:none;';

    this.editBtn = this.createSmallButton('EDIT', () => this.showEditMode(true));
    this.saveBtn = this.createSmallButton('SAVE', () => this.handleUsernameChange());
    this.saveBtn.style.display = 'none';
    this.cancelBtn = this.createSmallButton('CANCEL', () => this.showEditMode(false));
    this.cancelBtn.style.display = 'none';

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'margin-bottom:6px;';
    labelRow.appendChild(usernameLabel);
    profileSection.appendChild(labelRow);

    usernameRow.appendChild(this.usernameDisplay);
    usernameRow.appendChild(this.usernameInput);
    usernameRow.appendChild(this.editBtn);
    usernameRow.appendChild(this.saveBtn);
    usernameRow.appendChild(this.cancelBtn);
    profileSection.appendChild(usernameRow);

    // Stats grid
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;';

    this.levelDisplay = this.createStatBox(statsGrid, 'LEVEL', '1');
    this.coinsDisplay = this.createStatBox(statsGrid, 'COINS', '0');
    this.feathersDisplay = this.createStatBox(statsGrid, 'FEATHERS', '0');

    profileSection.appendChild(statsGrid);
    panel.appendChild(profileSection);

    // Error message
    this.errorMessage = document.createElement('div');
    this.errorMessage.style.cssText =
      'color:#ff6b6b;font-size:13px;text-align:center;margin-bottom:12px;' +
      'min-height:0;display:none;';
    panel.appendChild(this.errorMessage);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    // Sign Out button
    const signOutBtn = this.createActionButton('SIGN OUT', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.15)');
    signOutBtn.addEventListener('click', () => this.handleSignOut());
    actions.appendChild(signOutBtn);

    // Delete Account button
    this.deleteBtn = this.createActionButton('DELETE ACCOUNT', 'rgba(255,50,50,0.1)', 'rgba(255,50,50,0.25)');
    this.deleteBtn.style.color = '#ff6b6b';
    this.deleteBtn.addEventListener('click', () => this.handleDeleteAccount());
    actions.appendChild(this.deleteBtn);

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.1);margin:8px 0;';
    actions.appendChild(sep);

    // Close button
    const closeBtn = this.createActionButton('CLOSE', 'rgba(135,206,235,0.15)', 'rgba(135,206,235,0.3)');
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.onClose?.();
    });
    actions.appendChild(closeBtn);

    panel.appendChild(actions);
    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  setOnSignOut(callback: () => void): void {
    this.onSignOut = callback;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.clearError();
    this.showEditMode(false);
    this.refreshDisplay();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private refreshDisplay(): void {
    const state = authStateManager.getState();
    this.usernameDisplay.textContent = state.username;
    this.usernameInput.value = state.username;

    if (state.profile) {
      this.levelDisplay.textContent = String(state.profile.level);
      this.coinsDisplay.textContent = state.profile.coins.toLocaleString();
      this.feathersDisplay.textContent = state.profile.feathers.toLocaleString();
    }
  }

  private showEditMode(editing: boolean): void {
    this.editMode = editing;
    if (editing) {
      this.usernameDisplay.style.display = 'none';
      this.usernameInput.style.display = 'block';
      this.editBtn.style.display = 'none';
      this.saveBtn.style.display = 'inline-block';
      this.cancelBtn.style.display = 'inline-block';
      this.usernameInput.value = authStateManager.getState().username;
      this.usernameInput.focus();
    } else {
      this.usernameDisplay.style.display = 'inline';
      this.usernameInput.style.display = 'none';
      this.editBtn.style.display = 'inline-block';
      this.saveBtn.style.display = 'none';
      this.cancelBtn.style.display = 'none';
    }
  }

  private async handleUsernameChange(): Promise<void> {
    const newUsername = this.usernameInput.value.trim();
    if (!newUsername || newUsername.length < 3) {
      this.showError('Username must be at least 3 characters.');
      return;
    }
    if (newUsername.length > 20) {
      this.showError('Username must be 20 characters or less.');
      return;
    }

    this.clearError();
    const result = await updateUsername(newUsername);

    if (!result.success) {
      this.showError(result.error || 'Failed to update username.');
      return;
    }

    await authStateManager.refreshProfile();
    this.showEditMode(false);
    this.refreshDisplay();
  }

  private async handleSignOut(): Promise<void> {
    const result = await signOut();
    if (result.success) {
      await authStateManager.onSignOut();
      this.hide();
      this.onSignOut?.();
    } else {
      this.showError(result.error || 'Failed to sign out.');
    }
  }

  private async handleDeleteAccount(): Promise<void> {
    if (!this.deleteConfirmed) {
      this.deleteBtn.textContent = 'ARE YOU SURE? CLICK AGAIN';
      this.deleteBtn.style.background = 'rgba(255,50,50,0.3)';
      this.deleteConfirmed = true;
      setTimeout(() => {
        this.deleteConfirmed = false;
        this.deleteBtn.textContent = 'DELETE ACCOUNT';
        this.deleteBtn.style.background = 'rgba(255,50,50,0.1)';
      }, 5000);
      return;
    }

    const result = await deleteAccount();
    if (result.success) {
      await authStateManager.onSignOut();
      this.hide();
      this.onSignOut?.();
    } else {
      this.showError(result.error || 'Failed to delete account. This may require server-side support.');
      this.deleteConfirmed = false;
      this.deleteBtn.textContent = 'DELETE ACCOUNT';
      this.deleteBtn.style.background = 'rgba(255,50,50,0.1)';
    }
  }

  private showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
  }

  private clearError(): void {
    this.errorMessage.textContent = '';
    this.errorMessage.style.display = 'none';
  }

  private createSmallButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText =
      'padding:6px 12px;background:rgba(255,255,255,0.1);' +
      'border:1px solid rgba(255,255,255,0.25);border-radius:4px;' +
      'color:#fff;font-size:11px;font-weight:bold;letter-spacing:1px;' +
      'cursor:pointer;transition:background 0.2s;';
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.2)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.1)');
    btn.addEventListener('click', onClick);
    return btn;
  }

  private createActionButton(text: string, bg: string, hoverBg: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText =
      `display:block;width:100%;padding:12px;background:${bg};` +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:14px;font-weight:bold;letter-spacing:2px;' +
      'cursor:pointer;transition:background 0.2s;';
    btn.addEventListener('mouseenter', () => btn.style.background = hoverBg);
    btn.addEventListener('mouseleave', () => btn.style.background = bg);
    return btn;
  }

  private createStatBox(parent: HTMLElement, label: string, initialValue: string): HTMLElement {
    const box = document.createElement('div');
    box.style.cssText =
      'text-align:center;background:rgba(0,0,0,0.2);border-radius:6px;padding:12px 8px;';

    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size:22px;font-weight:bold;margin-bottom:4px;';
    valueEl.textContent = initialValue;
    box.appendChild(valueEl);

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;';
    labelEl.textContent = label;
    box.appendChild(labelEl);

    parent.appendChild(box);
    return valueEl;
  }
}
