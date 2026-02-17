/**
 * PoopTagMode - One player is "it" (tagged). Poop-hit another player to transfer the tag.
 * Being tagged drains coins. Timer ends → whoever is "it" loses.
 */

import * as THREE from 'three';
import { PvPMode, PvPPlayer, PvPResults, PvPStanding } from '../PvPMode';
import { PVP } from '../../utils/Constants';

export class PoopTagMode extends PvPMode {
  private taggedPlayerId = '';
  private tagHoldTimes = new Map<string, number>();

  // Visuals
  private auraGroup: THREE.Group | null = null;
  private auraMesh: THREE.Mesh | null = null;
  private auraLight: THREE.PointLight | null = null;
  private tagMarkerSprite: THREE.Sprite | null = null;

  getModeId(): string { return 'poop-tag'; }
  getModeName(): string { return 'Poop Tag'; }
  getModeDescription(): string { return 'Tag another player with poop to pass the curse! Whoever is "it" when time runs out loses.'; }
  getModeIcon(): string { return '\uD83C\uDFF7\uFE0F'; }
  getRoundDuration(): number { return PVP.TAG_ROUND_DURATION; }
  getMinPlayers(): number { return PVP.TAG_MIN_PLAYERS; }
  getMaxPlayers(): number { return PVP.TAG_MAX_PLAYERS; }

  onStart(players: PvPPlayer[]): void {
    super.onStart(players);

    // Reset hold times
    this.tagHoldTimes.clear();
    for (const p of players) {
      this.tagHoldTimes.set(p.id, 0);
    }

    // Random player is "it"
    const randomIndex = Math.floor(Math.random() * players.length);
    this.taggedPlayerId = players[randomIndex].id;

    // Create visual aura for tagged player
    this.createAuraVisuals();

    // Listen for tag transfers
    this.context.eventBus.on('tag-transfer', this.handleTagTransfer);
  }

  onUpdate(dt: number): void {
    this.elapsed += dt;

    // Update tag hold time
    if (this.taggedPlayerId) {
      const current = this.tagHoldTimes.get(this.taggedPlayerId) || 0;
      this.tagHoldTimes.set(this.taggedPlayerId, current + dt);
    }

    // Update aura position
    this.updateAuraVisuals();

    // Update scores for display (negative = time tagged)
    for (const p of this.players) {
      p.score = -(this.tagHoldTimes.get(p.id) || 0);
    }
  }

  onEnd(): PvPResults {
    this.context.eventBus.off('tag-transfer', this.handleTagTransfer);

    // Sort by tag hold time (lowest = best)
    const sorted = [...this.players].sort((a, b) => {
      const aTime = this.tagHoldTimes.get(a.id) || 0;
      const bTime = this.tagHoldTimes.get(b.id) || 0;
      return aTime - bTime;
    });

    const totalTime = this.elapsed;
    const standings: PvPStanding[] = sorted.map((p, i) => {
      const holdTime = this.tagHoldTimes.get(p.id) || 0;
      const isLastTagged = p.id === this.taggedPlayerId;
      const holdPct = totalTime > 0 ? ((holdTime / totalTime) * 100).toFixed(0) : '0';

      // Reward: less time tagged = bigger reward
      let reward = 0;
      if (!isLastTagged) {
        const avoidancePct = 1 - (holdTime / Math.max(totalTime, 1));
        reward = Math.floor(PVP.TAG_WINNER_BONUS * avoidancePct);
      }

      return {
        player: p,
        rank: i + 1,
        score: Math.round(-p.score),
        reward,
        label: isLastTagged ? `Tagged at end! (${holdPct}% tagged)` : `${holdPct}% time tagged`,
      };
    });

    // Clean up visuals
    this.disposeAura();

    return {
      modeId: this.getModeId(),
      modeName: this.getModeName(),
      standings,
      duration: this.elapsed,
    };
  }

  getModeData(): any {
    const localPlayer = this.players.find(p => p.isLocal);
    return {
      taggedPlayerId: this.taggedPlayerId,
      localPlayerId: localPlayer?.id || '',
      tagHoldTimes: Object.fromEntries(this.tagHoldTimes),
    };
  }

  private handleTagTransfer = (data: { shooterId: string; targetId: string }): void => {
    // Only the tagged player can transfer
    if (data.shooterId !== this.taggedPlayerId) return;
    // Target must be a participant
    if (!this.players.find(p => p.id === data.targetId)) return;

    this.taggedPlayerId = data.targetId;
    this.context.eventBus.emit('score-update', {
      type: 'tag-transfer',
      from: data.shooterId,
      to: data.targetId,
    });
  };

  private createAuraVisuals(): void {
    if (!this.context.scene) return;

    this.auraGroup = new THREE.Group();

    // Aura shell — semi-transparent toxic green sphere surrounding the bird
    const shellGeo = new THREE.SphereGeometry(3, 12, 8);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x4a7a20,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    this.auraMesh = new THREE.Mesh(shellGeo, shellMat);
    this.auraGroup.add(this.auraMesh);

    // Glow light — sickly green illumination on nearby surfaces
    this.auraLight = new THREE.PointLight(0x6B9B30, 1.5, 15);
    this.auraGroup.add(this.auraLight);

    // Overhead poop marker — billboarded sprite, visible from far away
    this.tagMarkerSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.createPoopTexture(), transparent: true }),
    );
    this.tagMarkerSprite.scale.set(2.5, 2.5, 1);
    this.tagMarkerSprite.position.y = 5;
    this.auraGroup.add(this.tagMarkerSprite);

    this.context.scene.add(this.auraGroup);
  }

  /** Canvas-rendered poop pile icon for the overhead marker. */
  private createPoopTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Toxic green poop — high contrast against white seagulls and sky
    ctx.fillStyle = '#4A7A20';
    ctx.beginPath();
    // Base mound
    ctx.ellipse(32, 52, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Middle mound
    ctx.beginPath();
    ctx.ellipse(32, 40, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Top mound
    ctx.beginPath();
    ctx.ellipse(32, 30, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tip swirl
    ctx.beginPath();
    ctx.ellipse(34, 22, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark outline for readability at distance
    ctx.strokeStyle = '#1a3a00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(32, 52, 18, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(32, 40, 14, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(32, 30, 10, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(34, 22, 5, 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bright highlight for depth/sheen
    ctx.fillStyle = 'rgba(140, 220, 60, 0.4)';
    ctx.beginPath();
    ctx.ellipse(28, 38, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(29, 49, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  private updateAuraVisuals(): void {
    if (!this.auraGroup) return;

    const tagged = this.players.find(p => p.id === this.taggedPlayerId);
    if (tagged) {
      this.auraGroup.position.copy(tagged.position);
      this.auraGroup.visible = true;

      // Unified pulse on ~2s cycle
      const pulse = 1 + Math.sin(this.elapsed * 3.14) * 0.15;
      if (this.auraMesh) {
        this.auraMesh.scale.setScalar(pulse);
        (this.auraMesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(this.elapsed * 3.14) * 0.1;
      }

      // Glow light intensity pulse
      if (this.auraLight) {
        this.auraLight.intensity = 1.5 + Math.sin(this.elapsed * 3.14) * 1.0;
      }

      // Overhead marker bobs up and down
      if (this.tagMarkerSprite) {
        this.tagMarkerSprite.position.y = 5 + Math.sin(this.elapsed * 4.2) * 0.5;
      }
    } else {
      this.auraGroup.visible = false;
    }
  }

  private disposeAura(): void {
    if (this.auraGroup) {
      this.auraGroup.parent?.remove(this.auraGroup);
      this.auraGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      this.auraGroup = null;
      this.auraMesh = null;
      this.auraLight = null;
      this.tagMarkerSprite = null;
    }
  }

  dispose(): void {
    this.disposeAura();
    this.context?.eventBus.off('tag-transfer', this.handleTagTransfer);
  }
}
