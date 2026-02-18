import * as THREE from 'three';

interface MinimapOptions {
  size?: number;
  worldSize?: number;
  position?: { top?: number; right?: number; bottom?: number; left?: number };
}

export class Minimap {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private worldSize: number;
  private visible = true;

  // Map markers
  private playerPos = new THREE.Vector2();
  private sanctuaryPos = new THREE.Vector2();
  private hotspots: THREE.Vector2[] = [];
  private otherPlayers: Array<{ pos: THREE.Vector2; name: string; id: string }> = [];

  // Poop Tag state
  private taggedPlayerId: string | null = null;
  private isLocalTagged = false;
  private animTime = 0;

  // Murmuration state
  private murmurationMemberIds: Set<string> = new Set();
  private roostPosition: THREE.Vector2 | null = null;

  // Heist state
  private heistActive = false;
  private heistTrophyPos: THREE.Vector2 | null = null;
  private heistTrophyCarrierId: string | null = null;
  private heistPedestals: Array<{ pos: THREE.Vector2; color: string; playerId: string }> = [];
  private heistLocalPlayerId: string | null = null;

  constructor(options: MinimapOptions = {}) {
    // Shrink minimap by ~60%: default 180 → 72, responsive to viewport
    const defaultSize = Math.max(64, Math.min(80, Math.round(window.innerWidth * 0.12)));
    this.size = options.size || defaultSize;
    this.worldSize = options.worldSize || 1500;

    // Container — transparent background, thin border only, extreme top-right
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 8px;
      right: 8px;
      width: ${this.size}px;
      height: ${this.size}px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
    `;

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size * 2; // 2x resolution for crispness
    this.canvas.height = this.size * 2;
    this.canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
    this.container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    this.ctx = ctx;
    this.ctx.scale(2, 2); // HiDPI scaling

    document.body.appendChild(this.container);
  }

  setPlayerPosition(pos: THREE.Vector3): void {
    this.playerPos.set(pos.x, pos.z);
  }

  setSanctuaryPosition(pos: THREE.Vector3): void {
    this.sanctuaryPos.set(pos.x, pos.z);
  }

  setHotspots(positions: THREE.Vector3[]): void {
    this.hotspots = positions.map(p => new THREE.Vector2(p.x, p.z));
  }

  setOtherPlayers(players: Array<{ position: THREE.Vector3; username: string; id?: string }>): void {
    this.otherPlayers = players.map(p => ({
      pos: new THREE.Vector2(p.position.x, p.position.z),
      name: p.username,
      id: p.id || '',
    }));
  }

  setTaggedPlayer(taggedId: string | null, isLocalTagged: boolean): void {
    this.taggedPlayerId = taggedId;
    this.isLocalTagged = isLocalTagged;
  }

  setMurmurationMembers(memberIds: string[]): void {
    this.murmurationMemberIds = new Set(memberIds);
  }

  setRoostPosition(pos: { x: number; z: number } | null): void {
    this.roostPosition = pos ? new THREE.Vector2(pos.x, pos.z) : null;
  }

  // --- Heist mode setters ---

  setHeistActive(active: boolean, localPlayerId?: string): void {
    this.heistActive = active;
    this.heistLocalPlayerId = localPlayerId ?? null;
    if (!active) {
      this.heistTrophyPos = null;
      this.heistTrophyCarrierId = null;
      this.heistPedestals = [];
    }
  }

  setHeistTrophy(pos: { x: number; z: number } | null, carrierId: string | null): void {
    this.heistTrophyPos = pos ? new THREE.Vector2(pos.x, pos.z) : null;
    this.heistTrophyCarrierId = carrierId;
  }

  setHeistPedestals(pedestals: Array<{ position: { x: number; z: number }; color: number; playerId: string }>): void {
    this.heistPedestals = pedestals.map(p => ({
      pos: new THREE.Vector2(p.position.x, p.position.z),
      color: `#${p.color.toString(16).padStart(6, '0')}`,
      playerId: p.playerId,
    }));
  }

  // Reusable point to avoid per-call object allocation
  private _mapPoint = { x: 0, y: 0 };

  private worldToMap(worldX: number, worldZ: number): { x: number; y: number } {
    const halfWorld = this.worldSize / 2;
    this._mapPoint.x = ((worldX + halfWorld) / this.worldSize) * this.size;
    this._mapPoint.y = ((worldZ + halfWorld) / this.worldSize) * this.size;
    return this._mapPoint;
  }

  update(): void {
    if (!this.visible) return;

    this.animTime += 0.016; // ~60fps approximation for pulse animation

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    // No grid background — transparent for zero-noise

    // Draw sanctuary (center, green circle — scaled down)
    const sanctuary = this.worldToMap(this.sanctuaryPos.x, this.sanctuaryPos.y);
    ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sanctuary.x, sanctuary.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw hotspots (red circles — compact)
    ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)';
    ctx.lineWidth = 1;
    for (const hotspot of this.hotspots) {
      const pos = this.worldToMap(hotspot.x, hotspot.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw roost icon (if set — compact)
    if (this.roostPosition) {
      const rp = this.worldToMap(this.roostPosition.x, this.roostPosition.y);
      ctx.fillStyle = 'rgba(136, 170, 255, 0.5)';
      ctx.strokeStyle = 'rgba(136, 170, 255, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#88aaff';
      ctx.font = 'bold 5px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', rp.x, rp.y);
    }

    // Draw other players (compact dots)
    for (const player of this.otherPlayers) {
      const pos = this.worldToMap(player.pos.x, player.pos.y);
      const isTagged = this.taggedPlayerId !== null && player.id === this.taggedPlayerId;
      const isMurmMember = this.murmurationMemberIds.has(player.id);

      if (isTagged) {
        const ringPulse = 4 + Math.sin(this.animTime * 4) * 1;
        ctx.strokeStyle = 'rgba(74, 140, 30, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, ringPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(74, 140, 30, 0.9)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (isMurmMember) {
        ctx.fillStyle = 'rgba(68, 255, 170, 0.8)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(100, 150, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw player (compact triangle)
    const player = this.worldToMap(this.playerPos.x, this.playerPos.y);
    ctx.save();
    ctx.translate(player.x, player.y);

    if (this.isLocalTagged) {
      const ringPulse = 5 + Math.sin(this.animTime * 4) * 1;
      ctx.strokeStyle = 'rgba(74, 140, 30, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, ringPulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.isLocalTagged ? '#4A8C1E' : '#ffff00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-2.5, 2.5);
    ctx.lineTo(2.5, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw Heist mode icons (compact)
    if (this.heistActive) {
      for (const ped of this.heistPedestals) {
        const pp = this.worldToMap(ped.pos.x, ped.pos.y);
        ctx.fillStyle = ped.color;
        ctx.save();
        ctx.translate(pp.x, pp.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2.5, -2.5, 5, 5);
        ctx.restore();
      }

      if (this.heistTrophyPos) {
        const tp = this.worldToMap(this.heistTrophyPos.x, this.heistTrophyPos.y);
        const trophyPulse = 3 + Math.sin(this.animTime * 5) * 1;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, trophyPulse + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, trophyPulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  show(): void {
    this.visible = true;
    this.container.style.display = 'block';
  }

  hide(): void {
    this.visible = false;
    this.container.style.display = 'none';
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    this.container.remove();
  }
}
