/**
 * MurmurationCreate — Creation flow UI for new Murmurations.
 * Steps: name, tag, privacy, description → confirm.
 * Follows existing imperative DOM pattern.
 */

import { MURMURATION } from '@/utils/Constants';
import type { MurmurationPrivacy } from '@/types/murmuration';

export interface MurmurationCreateData {
  name: string;
  tag: string;
  privacy: MurmurationPrivacy;
  description: string;
}

export class MurmurationCreate {
  private container: HTMLElement;
  private panel: HTMLElement;
  private visible = false;

  private nameInput: HTMLInputElement;
  private tagInput: HTMLInputElement;
  private descInput: HTMLTextAreaElement;
  private privacySelect: HTMLSelectElement;
  private errorEl: HTMLElement;
  private costLabel: HTMLElement;

  private onCreate: ((data: MurmurationCreateData) => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor() {
    // Overlay
    this.container = document.createElement('div');
    this.container.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'display:none;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.85);z-index:2100;' +
      'font-family:"Segoe UI",system-ui,sans-serif;color:#fff;';

    // Panel
    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);' +
      'border-radius:12px;max-width:500px;width:90%;padding:30px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'border:2px solid rgba(255,255,255,0.1);';

    // Title
    const title = document.createElement('div');
    title.style.cssText =
      'font-size:24px;font-weight:bold;text-align:center;margin-bottom:24px;' +
      'letter-spacing:2px;';
    title.textContent = 'CREATE MURMURATION';
    this.panel.appendChild(title);

    // Name field
    this.nameInput = this.createTextField(
      'Murmuration Name',
      `${MURMURATION.NAME_MIN}-${MURMURATION.NAME_MAX} characters, alphanumeric + spaces`,
      MURMURATION.NAME_MAX,
    );
    this.panel.appendChild(this.createFieldGroup('NAME', this.nameInput));

    // Tag field
    this.tagInput = this.createTextField(
      'TAG',
      `${MURMURATION.TAG_MIN}-${MURMURATION.TAG_MAX} uppercase characters`,
      MURMURATION.TAG_MAX,
    );
    this.tagInput.style.textTransform = 'uppercase';
    this.tagInput.style.letterSpacing = '3px';
    this.tagInput.style.fontWeight = 'bold';
    this.tagInput.addEventListener('input', () => {
      this.tagInput.value = this.tagInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    this.panel.appendChild(this.createFieldGroup('TAG', this.tagInput));

    // Privacy selector
    this.privacySelect = document.createElement('select');
    this.privacySelect.style.cssText =
      'width:100%;padding:10px 12px;background:rgba(255,255,255,0.08);' +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:14px;font-family:"Segoe UI",system-ui,sans-serif;' +
      'outline:none;cursor:pointer;';
    const options: { value: MurmurationPrivacy; label: string }[] = [
      { value: 'open', label: 'Open — Anyone can join' },
      { value: 'invite_only', label: 'Invite Only — Requires invite or request' },
      { value: 'closed', label: 'Closed — Not accepting members' },
    ];
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      el.style.cssText = 'background:#1a1a2e;color:#fff;';
      this.privacySelect.appendChild(el);
    }
    this.panel.appendChild(this.createFieldGroup('PRIVACY', this.privacySelect));

    // Description
    this.descInput = document.createElement('textarea');
    this.descInput.placeholder = 'Optional description (max 200 chars)';
    this.descInput.maxLength = MURMURATION.DESCRIPTION_MAX;
    this.descInput.rows = 3;
    this.descInput.style.cssText =
      'width:100%;padding:10px 12px;background:rgba(255,255,255,0.08);' +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:14px;font-family:"Segoe UI",system-ui,sans-serif;' +
      'outline:none;resize:vertical;box-sizing:border-box;';
    this.descInput.addEventListener('keydown', (e) => e.stopPropagation());
    this.panel.appendChild(this.createFieldGroup('DESCRIPTION', this.descInput));

    // Cost label
    this.costLabel = document.createElement('div');
    this.costLabel.style.cssText =
      'text-align:center;font-size:14px;color:#ffdd44;margin:16px 0;';
    this.costLabel.textContent = `Cost: ${MURMURATION.CREATE_COST} banked coins`;
    this.panel.appendChild(this.costLabel);

    // Error message
    this.errorEl = document.createElement('div');
    this.errorEl.style.cssText =
      'text-align:center;font-size:13px;color:#ff6666;margin-bottom:12px;' +
      'min-height:18px;';
    this.panel.appendChild(this.errorEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;';

    const cancelBtn = this.createButton('CANCEL', 'rgba(255,255,255,0.1)', '#fff');
    cancelBtn.addEventListener('click', () => {
      this.hide();
      this.onCancel?.();
    });

    const createBtn = this.createButton('CREATE', 'rgba(68,255,136,0.2)', '#44ff88');
    createBtn.style.borderColor = 'rgba(68,255,136,0.4)';
    createBtn.addEventListener('click', () => this.handleCreate());

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(createBtn);
    this.panel.appendChild(btnRow);

    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);
  }

  setCallbacks(
    onCreate: (data: MurmurationCreateData) => void,
    onCancel: () => void,
  ): void {
    this.onCreate = onCreate;
    this.onCancel = onCancel;
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'flex';
    this.errorEl.textContent = '';
    this.nameInput.value = '';
    this.tagInput.value = '';
    this.descInput.value = '';
    this.privacySelect.value = 'open';
    if (document.pointerLockElement) document.exitPointerLock();
    this.nameInput.focus();
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
  }

  private handleCreate(): void {
    const name = this.nameInput.value.trim();
    const tag = this.tagInput.value.trim().toUpperCase();
    const privacy = this.privacySelect.value as MurmurationPrivacy;
    const description = this.descInput.value.trim();

    // Validate
    if (name.length < MURMURATION.NAME_MIN || name.length > MURMURATION.NAME_MAX) {
      this.errorEl.textContent = `Name must be ${MURMURATION.NAME_MIN}-${MURMURATION.NAME_MAX} characters.`;
      return;
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      this.errorEl.textContent = 'Name can only contain letters, numbers, and spaces.';
      return;
    }
    if (tag.length < MURMURATION.TAG_MIN || tag.length > MURMURATION.TAG_MAX) {
      this.errorEl.textContent = `Tag must be ${MURMURATION.TAG_MIN}-${MURMURATION.TAG_MAX} characters.`;
      return;
    }
    if (!/^[A-Z0-9]+$/.test(tag)) {
      this.errorEl.textContent = 'Tag can only contain uppercase letters and numbers.';
      return;
    }

    this.errorEl.textContent = '';
    this.onCreate?.({ name, tag, privacy, description });
  }

  private createTextField(placeholder: string, hint: string, maxLength: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = maxLength;
    input.style.cssText =
      'width:100%;padding:10px 12px;background:rgba(255,255,255,0.08);' +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:14px;font-family:"Segoe UI",system-ui,sans-serif;' +
      'outline:none;box-sizing:border-box;';
    input.addEventListener('focus', () => { input.style.borderColor = 'rgba(255,255,255,0.3)'; });
    input.addEventListener('blur', () => { input.style.borderColor = 'rgba(255,255,255,0.15)'; });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    return input;
  }

  private createFieldGroup(label: string, inputEl: HTMLElement): HTMLElement {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom:16px;';
    const labelEl = document.createElement('div');
    labelEl.style.cssText =
      'font-size:11px;font-weight:bold;letter-spacing:2px;' +
      'color:rgba(255,255,255,0.4);margin-bottom:6px;';
    labelEl.textContent = label;
    group.appendChild(labelEl);
    group.appendChild(inputEl);
    return group;
  }

  private createButton(label: string, bg: string, color: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.style.cssText =
      `flex:1;padding:12px;background:${bg};` +
      `border:1px solid rgba(255,255,255,0.2);border-radius:6px;` +
      `color:${color};font-size:14px;font-weight:bold;letter-spacing:2px;` +
      'cursor:pointer;transition:all 0.2s;';
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });
    return btn;
  }
}
