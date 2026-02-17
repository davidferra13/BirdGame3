/**
 * MurmurationBrowser — Browse/search Murmurations UI with filtering.
 * Any player can browse (guests read-only). Filterable by name, tag, Formation level, member count.
 * Follows existing imperative DOM pattern.
 */

import { MURMURATION } from '@/utils/Constants';
import type { Murmuration } from '@/types/murmuration';
import { createEmblemElement, DEFAULT_EMBLEM } from '@/ui/EmblemRenderer';

export class MurmurationBrowser {
  private container: HTMLElement;
  private panel: HTMLElement;
  private listContainer: HTMLElement;
  private searchInput: HTMLInputElement;
  private visible = false;
  private murmurations: Murmuration[] = [];

  private onJoin: ((murmurationId: string) => void) | null = null;
  private onView: ((murmuration: Murmuration) => void) | null = null;
  private onClose: (() => void) | null = null;
  private onSearch: ((query: string) => Promise<Murmuration[]>) | null = null;
  private isAuthenticated = false;

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
      'border-radius:12px;max-width:700px;width:90%;padding:30px;' +
      'max-height:80vh;overflow-y:auto;' +
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);' +
      'border:2px solid rgba(255,255,255,0.1);';

    // Title
    const title = document.createElement('div');
    title.style.cssText =
      'font-size:24px;font-weight:bold;text-align:center;margin-bottom:20px;letter-spacing:2px;';
    title.textContent = 'BROWSE MURMURATIONS';
    this.panel.appendChild(title);

    // Search bar
    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;gap:10px;margin-bottom:20px;';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search by name or tag...';
    this.searchInput.style.cssText =
      'flex:1;padding:10px 14px;background:rgba(255,255,255,0.08);' +
      'border:1px solid rgba(255,255,255,0.15);border-radius:6px;' +
      'color:#fff;font-size:14px;font-family:"Segoe UI",system-ui,sans-serif;outline:none;';
    this.searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.performSearch();
    });

    const searchBtn = document.createElement('button');
    searchBtn.setAttribute('type', 'button');
    searchBtn.textContent = 'SEARCH';
    searchBtn.style.cssText =
      'padding:10px 20px;background:rgba(68,136,255,0.3);' +
      'border:1px solid rgba(68,136,255,0.5);border-radius:6px;' +
      'color:#88aaff;font-size:13px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
    searchBtn.addEventListener('click', () => this.performSearch());

    searchRow.appendChild(this.searchInput);
    searchRow.appendChild(searchBtn);
    this.panel.appendChild(searchRow);

    // List container
    this.listContainer = document.createElement('div');
    this.listContainer.style.cssText = 'min-height:200px;';
    this.panel.appendChild(this.listContainer);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.textContent = 'CLOSE';
    closeBtn.style.cssText =
      'display:block;width:100%;margin-top:16px;padding:12px;' +
      'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);' +
      'border-radius:6px;color:#fff;font-size:14px;font-weight:bold;' +
      'cursor:pointer;transition:all 0.2s;';
    closeBtn.addEventListener('click', () => { this.hide(); this.onClose?.(); });
    this.panel.appendChild(closeBtn);

    this.container.appendChild(this.panel);
    document.body.appendChild(this.container);
  }

  setCallbacks(
    onJoin: (murmurationId: string) => void,
    onView: (murmuration: Murmuration) => void,
    onClose: () => void,
    onSearch: (query: string) => Promise<Murmuration[]>,
  ): void {
    this.onJoin = onJoin;
    this.onView = onView;
    this.onClose = onClose;
    this.onSearch = onSearch;
  }

  setAuthenticated(authed: boolean): void {
    this.isAuthenticated = authed;
  }

  show(initialData?: Murmuration[]): void {
    this.visible = true;
    this.container.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    this.searchInput.value = '';
    if (initialData) {
      this.murmurations = initialData;
      this.renderList();
    } else {
      this.performSearch();
    }
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private async performSearch(): Promise<void> {
    const query = this.searchInput.value.trim();
    this.listContainer.innerHTML =
      '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);">Searching...</div>';

    try {
      const results = await this.onSearch?.(query);
      this.murmurations = results || [];
      this.renderList();
    } catch {
      this.listContainer.innerHTML =
        '<div style="text-align:center;padding:20px;color:#ff6666;">Search failed. Try again.</div>';
    }
  }

  private renderList(): void {
    this.listContainer.innerHTML = '';

    if (this.murmurations.length === 0) {
      this.listContainer.innerHTML =
        '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">' +
        '<div style="font-size:32px;margin-bottom:12px;">🐦</div>' +
        '<div>No Murmurations found.</div></div>';
      return;
    }

    // Header row
    const headerRow = document.createElement('div');
    headerRow.style.cssText =
      'display:flex;padding:8px 12px;font-size:11px;font-weight:bold;' +
      'color:rgba(255,255,255,0.4);letter-spacing:1px;margin-bottom:4px;';
    headerRow.innerHTML =
      '<div style="width:40px;"></div>' +
      '<div style="flex:1;">NAME</div>' +
      '<div style="width:60px;text-align:center;">FORM.</div>' +
      '<div style="width:80px;text-align:center;">MEMBERS</div>' +
      '<div style="width:80px;text-align:right;">SEASON</div>' +
      '<div style="width:80px;"></div>';
    this.listContainer.appendChild(headerRow);

    for (const mur of this.murmurations) {
      this.listContainer.appendChild(this.createRow(mur));
    }
  }

  private createRow(mur: Murmuration): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;padding:10px 12px;' +
      'background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px;' +
      'transition:background 0.2s;cursor:pointer;';
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.03)'; });
    row.addEventListener('click', () => this.onView?.(mur));

    // Emblem
    const emblemWrap = document.createElement('div');
    emblemWrap.style.cssText = 'width:40px;display:flex;justify-content:center;';
    const emblem = createEmblemElement(
      mur.emblem_config || DEFAULT_EMBLEM,
      28,
      mur.formation_level >= 10,
    );
    emblemWrap.appendChild(emblem);

    // Name + tag
    const nameCol = document.createElement('div');
    nameCol.style.cssText = 'flex:1;min-width:0;';
    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'font-size:14px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    nameEl.textContent = mur.name;
    const tagEl = document.createElement('div');
    tagEl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
    tagEl.textContent = `[${mur.tag}] · ${mur.privacy === 'open' ? 'Open' : mur.privacy === 'invite_only' ? 'Invite Only' : 'Closed'}`;
    nameCol.appendChild(nameEl);
    nameCol.appendChild(tagEl);

    // Formation
    const formEl = document.createElement('div');
    formEl.style.cssText = 'width:60px;text-align:center;font-size:13px;color:#aaccff;font-weight:bold;';
    formEl.textContent = `F${mur.formation_level}`;

    // Members
    const maxMem = mur.formation_level >= 7 ? MURMURATION.MAX_MEMBERS_F7 : MURMURATION.MAX_MEMBERS;
    const membersEl = document.createElement('div');
    membersEl.style.cssText = 'width:80px;text-align:center;font-size:13px;color:rgba(255,255,255,0.7);';
    membersEl.textContent = `${mur.member_count}/${maxMem}`;

    // Season coins
    const seasonEl = document.createElement('div');
    seasonEl.style.cssText = 'width:80px;text-align:right;font-size:13px;color:#ffdd44;';
    seasonEl.textContent = this.formatNumber(mur.season_coins_banked);

    // Join button
    const actionCol = document.createElement('div');
    actionCol.style.cssText = 'width:80px;text-align:right;';

    if (mur.privacy === 'open' && this.isAuthenticated) {
      const joinBtn = document.createElement('button');
      joinBtn.setAttribute('type', 'button');
      joinBtn.textContent = 'JOIN';
      joinBtn.style.cssText =
        'padding:4px 12px;background:rgba(68,255,136,0.2);' +
        'border:1px solid rgba(68,255,136,0.4);border-radius:4px;' +
        'color:#44ff88;font-size:11px;font-weight:bold;cursor:pointer;transition:all 0.2s;';
      joinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onJoin?.(mur.id);
      });
      actionCol.appendChild(joinBtn);
    }

    row.appendChild(emblemWrap);
    row.appendChild(nameCol);
    row.appendChild(formEl);
    row.appendChild(membersEl);
    row.appendChild(seasonEl);
    row.appendChild(actionCol);
    return row;
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
}
