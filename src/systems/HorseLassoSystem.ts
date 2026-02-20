import * as THREE from 'three';
import { NPC } from '../entities/NPC';
import { RemotePlayer } from '../multiplayer/RemotePlayer';

const LASSO_RANGE = 18;
const LASSO_CONE_DOT = 0.78;
const LASSO_HEIGHT_WINDOW = 4;
const LASSO_COOLDOWN_HIT = 2.4;
const LASSO_COOLDOWN_MISS = 1.2;
const LASSO_WINDUP = 0.28;
const LASSO_NPC_DRAG_DISTANCE = 7;
const LASSO_NPC_DRAG_HEIGHT = 1.1;
const LASSO_PLAYER_PULL_DISTANCE = 9.5;
const LASSO_PLAYER_PULL_STRENGTH = 18;

export interface LassoAttachEvent {
  attackerId: string;
  victimId: string;
  durationMs: number;
  tetherLength: number;
  breakoutTarget?: number;
}

export interface LassoReleaseEvent {
  attackerId: string;
  victimId: string;
  reason?: string;
}

export interface LassoWindupEvent {
  attackerId: string;
  victimId: string;
  windupMs: number;
}

export interface LassoFeedbackEvent {
  playerId: string;
  status: string;
  reason?: string;
  cooldownMs?: number;
  victimId?: string;
  attackerId?: string;
  breakoutProgress?: number;
  breakoutTarget?: number;
  tension?: number;
  strain?: number;
}

interface CastContext {
  horsePosition: THREE.Vector3;
  horseForward: THREE.Vector3;
  localPlayerId: string | null;
  npcs: NPC[];
  remotePlayers: RemotePlayer[];
  sendPlayerCast: (targetPlayerId: string) => void;
}

interface UpdateContext {
  dt: number;
  isRidingHorse: boolean;
  horsePosition: THREE.Vector3;
  horseForward: THREE.Vector3;
  horseHeading: number;
  birdPosition: THREE.Vector3;
  birdForwardSpeed: number;
  setBirdForwardSpeed: (speed: number) => void;
  remotePlayers: RemotePlayer[];
  localPlayerId: string | null;
  npcs?: NPC[];
  sendPlayerCast?: (targetPlayerId: string) => void;
}

interface PendingCast {
  targetType: 'npc' | 'player';
  targetPlayerId: string | null;
  targetNPC: NPC | null;
  remaining: number;
}

export class HorseLassoSystem {
  private readonly ropeLine: THREE.Line;
  private readonly ropePoints: THREE.Vector3[];

  private cooldown = 0;
  private pendingCast: PendingCast | null = null;

  private activeNPC: NPC | null = null;
  private activeRemoteTargetId: string | null = null;
  private remoteAttachRemaining = 0;

  private localVictimById: string | null = null;
  private localVictimRemaining = 0;
  private breakoutProgress = 0;
  private breakoutTarget = 20;

  private attackerTension = 0;
  private tensionFeedbackTimer = 0;
  private feedbackQueue: string[] = [];

  constructor(scene: THREE.Scene) {
    this.ropePoints = [new THREE.Vector3(), new THREE.Vector3()];
    const ropeGeo = new THREE.BufferGeometry().setFromPoints(this.ropePoints);
    const ropeMat = new THREE.LineBasicMaterial({ color: 0xd6b26f, transparent: true, opacity: 0.95 });
    this.ropeLine = new THREE.Line(ropeGeo, ropeMat);
    this.ropeLine.visible = false;
    scene.add(this.ropeLine);
  }

  dispose(): void {
    this.releaseNPC();
    this.ropeLine.parent?.remove(this.ropeLine);
    this.ropeLine.geometry.dispose();
    (this.ropeLine.material as THREE.Material).dispose();
  }

  isActive(): boolean {
    return this.activeNPC !== null || this.activeRemoteTargetId !== null;
  }

  isWindingUp(): boolean {
    return this.pendingCast !== null;
  }

  isLocalPlayerLassoed(): boolean {
    return this.localVictimById !== null && this.localVictimRemaining > 0;
  }

  getMoveMultiplier(): number {
    const victimMult = this.isLocalPlayerLassoed() ? 0.76 : 1.0;
    const attackerMult = this.isActive()
      ? Math.max(0.66, 0.88 - this.attackerTension * 0.18)
      : 1.0;
    return victimMult * attackerMult;
  }

  getBreakoutProgress(): { active: boolean; progress: number; target: number } {
    return {
      active: this.isLocalPlayerLassoed(),
      progress: this.breakoutProgress,
      target: this.breakoutTarget,
    };
  }

  consumeFeedbackMessages(): string[] {
    if (this.feedbackQueue.length <= 0) return [];
    const out = [...this.feedbackQueue];
    this.feedbackQueue = [];
    return out;
  }

  tryCast(context: CastContext): void {
    if (this.cooldown > 0 || this.isActive() || this.pendingCast) return;

    const npcTarget = this.findBestNPCTarget(context.horsePosition, context.horseForward, context.npcs);
    const playerTarget = this.findBestPlayerTarget(
      context.horsePosition,
      context.horseForward,
      context.remotePlayers,
      context.localPlayerId,
    );

    if (!npcTarget && !playerTarget) {
      this.cooldown = LASSO_COOLDOWN_MISS;
      this.feedbackQueue.push('LASSO MISSED');
      return;
    }

    if (playerTarget && (!npcTarget || playerTarget.score <= npcTarget.score)) {
      this.pendingCast = {
        targetType: 'player',
        targetPlayerId: playerTarget.playerId,
        targetNPC: null,
        remaining: LASSO_WINDUP,
      };
      return;
    }

    this.pendingCast = {
      targetType: 'npc',
      targetPlayerId: null,
      targetNPC: npcTarget?.npc ?? null,
      remaining: LASSO_WINDUP,
    };
  }

  release(sendPlayerRelease?: () => void): void {
    this.pendingCast = null;
    if (this.activeNPC) {
      this.releaseNPC();
      this.cooldown = LASSO_COOLDOWN_HIT * 0.6;
    }
    if (this.activeRemoteTargetId) {
      sendPlayerRelease?.();
      this.activeRemoteTargetId = null;
      this.remoteAttachRemaining = 0;
      this.cooldown = LASSO_COOLDOWN_HIT * 0.6;
    }
    this.ropeLine.visible = false;
    this.attackerTension = 0;
  }

  onServerAttach(evt: LassoAttachEvent, localPlayerId: string | null): void {
    if (!localPlayerId) return;

    if (evt.attackerId === localPlayerId) {
      this.pendingCast = null;
      this.activeRemoteTargetId = evt.victimId;
      this.remoteAttachRemaining = Math.max(0.5, evt.durationMs / 1000);
      this.activeNPC = null;
      this.cooldown = LASSO_COOLDOWN_HIT;
      this.breakoutTarget = evt.breakoutTarget ?? this.breakoutTarget;
    }
    if (evt.victimId === localPlayerId) {
      this.localVictimById = evt.attackerId;
      this.localVictimRemaining = Math.max(0.5, evt.durationMs / 1000);
      this.breakoutProgress = 0;
      this.breakoutTarget = evt.breakoutTarget ?? this.breakoutTarget;
    }
  }

  onServerRelease(evt: LassoReleaseEvent, localPlayerId: string | null): void {
    if (!localPlayerId) return;

    if (evt.attackerId === localPlayerId) {
      this.activeRemoteTargetId = null;
      this.remoteAttachRemaining = 0;
      this.ropeLine.visible = false;
      this.attackerTension = 0;
      if (evt.reason === 'breakout') {
        this.feedbackQueue.push('TARGET BROKE FREE');
      } else if (evt.reason === 'broken') {
        this.feedbackQueue.push('ROPE SNAPPED');
      }
    }
    if (evt.victimId === localPlayerId) {
      this.localVictimById = null;
      this.localVictimRemaining = 0;
      this.breakoutProgress = 0;
      if (evt.reason === 'breakout') {
        this.feedbackQueue.push('YOU BROKE FREE');
      } else if (evt.reason === 'broken') {
        this.feedbackQueue.push('ROPE SNAPPED');
      }
    }
  }

  onServerWindup(evt: LassoWindupEvent, localPlayerId: string | null): void {
    if (!localPlayerId) return;
    if (evt.attackerId !== localPlayerId && evt.victimId === localPlayerId) {
      this.feedbackQueue.push('INCOMING LASSO');
    }
  }

  onServerFeedback(evt: LassoFeedbackEvent, localPlayerId: string | null): void {
    if (!localPlayerId || evt.playerId !== localPlayerId) return;

    if (evt.status === 'cooldown' && evt.cooldownMs) {
      this.cooldown = Math.max(this.cooldown, evt.cooldownMs / 1000);
      return;
    }
    if (evt.status === 'miss' && evt.cooldownMs) {
      this.cooldown = Math.max(this.cooldown, evt.cooldownMs / 1000);
      this.pendingCast = null;
      this.feedbackQueue.push('LASSO MISSED');
      return;
    }
    if (evt.status === 'immune') {
      this.pendingCast = null;
      this.feedbackQueue.push('TARGET IMMUNE');
      return;
    }
    if (evt.status === 'breakout_progress') {
      this.breakoutProgress = evt.breakoutProgress ?? this.breakoutProgress;
      this.breakoutTarget = evt.breakoutTarget ?? this.breakoutTarget;
      return;
    }
    if (evt.status === 'tension_warning') {
      this.attackerTension = Math.max(this.attackerTension, evt.tension ?? 0);
      this.tensionFeedbackTimer = 0.25;
      return;
    }
    if (evt.status === 'snapback_stun') {
      this.feedbackQueue.push('SNAPBACK STUN');
      return;
    }
    if (evt.status === 'victim_escaped') {
      this.feedbackQueue.push('VICTIM ESCAPED');
    }
  }

  forceClearRemote(): void {
    this.pendingCast = null;
    this.activeRemoteTargetId = null;
    this.remoteAttachRemaining = 0;
    this.localVictimById = null;
    this.localVictimRemaining = 0;
    this.breakoutProgress = 0;
    this.ropeLine.visible = false;
    this.attackerTension = 0;
    this.feedbackQueue = [];
  }

  update(ctx: UpdateContext): void {
    this.cooldown = Math.max(0, this.cooldown - ctx.dt);

    if (this.pendingCast) {
      if (!ctx.isRidingHorse) {
        this.pendingCast = null;
      } else {
        this.pendingCast.remaining -= ctx.dt;
        if (this.pendingCast.remaining <= 0) {
          this.resolvePendingCast(ctx);
        }
      }
    }

    if (this.remoteAttachRemaining > 0) {
      this.remoteAttachRemaining -= ctx.dt;
      if (this.remoteAttachRemaining <= 0) {
        this.activeRemoteTargetId = null;
        this.attackerTension = 0;
      }
    }

    if (this.localVictimRemaining > 0) {
      this.localVictimRemaining -= ctx.dt;
      if (this.localVictimRemaining <= 0) {
        this.localVictimById = null;
        this.breakoutProgress = 0;
      }
    }

    if (this.tensionFeedbackTimer > 0) {
      this.tensionFeedbackTimer -= ctx.dt;
      if (this.tensionFeedbackTimer <= 0) {
        this.attackerTension = Math.max(0, this.attackerTension - 0.2);
      }
    } else {
      this.attackerTension = Math.max(0, this.attackerTension - 1.5 * ctx.dt);
    }

    this.updateNPCTether(ctx);
    this.applyLocalVictimPull(ctx);
    this.updateRopeVisual(ctx);
  }

  private resolvePendingCast(ctx: UpdateContext): void {
    const cast = this.pendingCast;
    this.pendingCast = null;
    if (!cast || !ctx.isRidingHorse) return;

    if (cast.targetType === 'player') {
      if (cast.targetPlayerId && ctx.sendPlayerCast) {
        ctx.sendPlayerCast(cast.targetPlayerId);
        this.cooldown = 0.35;
      } else {
        this.cooldown = LASSO_COOLDOWN_MISS;
      }
      return;
    }

    const target = cast.targetNPC;
    if (!target || target.shouldDespawn || target.isHit || target.isGrabbed || !target.mesh.parent) {
      this.cooldown = LASSO_COOLDOWN_MISS;
      this.feedbackQueue.push('LASSO MISSED');
      return;
    }

    const to = target.mesh.position.clone().sub(ctx.horsePosition);
    const vertical = Math.abs(to.y);
    to.y = 0;
    const dist = to.length();
    if (dist > LASSO_RANGE || vertical > LASSO_HEIGHT_WINDOW || dist < 0.001) {
      this.cooldown = LASSO_COOLDOWN_MISS;
      this.feedbackQueue.push('LASSO MISSED');
      return;
    }

    const forwardFlat = new THREE.Vector3(ctx.horseForward.x, 0, ctx.horseForward.z).normalize();
    to.normalize();
    if (forwardFlat.dot(to) < LASSO_CONE_DOT) {
      this.cooldown = LASSO_COOLDOWN_MISS;
      this.feedbackQueue.push('LASSO MISSED');
      return;
    }

    this.attachNPC(target);
    this.cooldown = LASSO_COOLDOWN_HIT;
  }

  private attachNPC(npc: NPC): void {
    this.releaseNPC();
    this.activeRemoteTargetId = null;
    this.remoteAttachRemaining = 0;
    this.attackerTension = 0;

    this.activeNPC = npc;
    npc.isGrabbed = true;
  }

  private releaseNPC(): void {
    if (!this.activeNPC) return;
    this.activeNPC.isGrabbed = false;
    this.activeNPC = null;
  }

  private updateNPCTether(ctx: UpdateContext): void {
    if (!this.activeNPC) return;

    if (this.activeNPC.shouldDespawn || !this.activeNPC.mesh.parent) {
      this.releaseNPC();
      return;
    }

    if (!ctx.isRidingHorse) {
      this.releaseNPC();
      return;
    }

    const desired = ctx.horsePosition.clone()
      .add(ctx.horseForward.clone().multiplyScalar(-LASSO_NPC_DRAG_DISTANCE));
    desired.y = Math.max(0.6, ctx.horsePosition.y + LASSO_NPC_DRAG_HEIGHT);

    this.activeNPC.mesh.position.lerp(desired, Math.min(1, 8 * ctx.dt));
    this.activeNPC.mesh.rotation.y = ctx.horseHeading;

    const ropeDist = this.activeNPC.mesh.position.distanceTo(ctx.horsePosition);
    const tension = Math.max(0, (ropeDist - LASSO_PLAYER_PULL_DISTANCE) / 12);
    this.attackerTension = Math.max(this.attackerTension, Math.min(1, tension));
  }

  private applyLocalVictimPull(ctx: UpdateContext): void {
    if (!this.localVictimById || this.localVictimRemaining <= 0) return;

    const attacker = ctx.remotePlayers.find((rp) => rp.id === this.localVictimById);
    if (!attacker) return;

    const attackerPos = attacker.getPosition();
    const toAttacker = attackerPos.sub(ctx.birdPosition);
    const dist = toAttacker.length();

    if (dist <= LASSO_PLAYER_PULL_DISTANCE) return;

    toAttacker.normalize();
    const pull = Math.min(
      LASSO_PLAYER_PULL_STRENGTH * ctx.dt,
      (dist - LASSO_PLAYER_PULL_DISTANCE) * 0.3,
    );

    ctx.birdPosition.addScaledVector(toAttacker, pull);
    ctx.setBirdForwardSpeed(Math.max(0, ctx.birdForwardSpeed * (1 - 0.85 * ctx.dt)));
  }

  private updateRopeVisual(ctx: UpdateContext): void {
    const showWindup = ctx.isRidingHorse && this.pendingCast !== null;
    const showActive = ctx.isRidingHorse && (this.activeNPC !== null || this.activeRemoteTargetId !== null);
    const shouldDraw = showWindup || showActive;
    if (!shouldDraw) {
      this.ropeLine.visible = false;
      return;
    }

    const start = ctx.horsePosition.clone().add(ctx.horseForward.clone().multiplyScalar(1.4));
    start.y += 1.85;

    let end: THREE.Vector3 | null = null;

    if (showWindup) {
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.03);
      end = start.clone().add(ctx.horseForward.clone().multiplyScalar(5.5 * pulse));
      end.y += 0.3;
    } else if (this.activeNPC) {
      end = this.activeNPC.mesh.position.clone();
      end.y += 1.0;
    } else if (this.activeRemoteTargetId) {
      const target = ctx.remotePlayers.find((rp) => rp.id === this.activeRemoteTargetId);
      if (target) {
        end = target.getPosition();
        end.y += 1.2;
        const ropeDist = end.distanceTo(start);
        const tension = Math.max(0, (ropeDist - LASSO_PLAYER_PULL_DISTANCE) / 14);
        this.attackerTension = Math.max(this.attackerTension, Math.min(1, tension));
      }
    }

    if (!end) {
      this.ropeLine.visible = false;
      return;
    }

    this.ropePoints[0].copy(start);
    this.ropePoints[1].copy(end);
    (this.ropeLine.geometry as THREE.BufferGeometry).setFromPoints(this.ropePoints);

    const mat = this.ropeLine.material as THREE.LineBasicMaterial;
    if (showWindup) {
      mat.color.setHex(0xffd787);
      mat.opacity = 0.9;
    } else if (this.attackerTension > 0.7) {
      mat.color.setHex(0xff8b6b);
      mat.opacity = 1.0;
    } else {
      mat.color.setHex(0xd6b26f);
      mat.opacity = 0.95;
    }
    this.ropeLine.visible = true;
  }

  private findBestNPCTarget(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    npcs: NPC[],
  ): { npc: NPC; score: number } | null {
    let best: { npc: NPC; score: number } | null = null;
    const forwardFlat = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    for (const npc of npcs) {
      if (npc.isHit || npc.isGrabbed || npc.shouldDespawn) continue;

      const to = npc.mesh.position.clone().sub(origin);
      const vertical = Math.abs(to.y);
      to.y = 0;
      const dist = to.length();
      if (dist > LASSO_RANGE || vertical > LASSO_HEIGHT_WINDOW) continue;
      if (dist < 0.001) continue;

      to.normalize();
      const dot = forwardFlat.dot(to);
      if (dot < LASSO_CONE_DOT) continue;

      const score = dist + (1 - dot) * 14;
      if (!best || score < best.score) {
        best = { npc, score };
      }
    }

    return best;
  }

  private findBestPlayerTarget(
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    remotePlayers: RemotePlayer[],
    localPlayerId: string | null,
  ): { playerId: string; score: number } | null {
    let best: { playerId: string; score: number } | null = null;
    const forwardFlat = new THREE.Vector3(forward.x, 0, forward.z).normalize();

    for (const rp of remotePlayers) {
      if (localPlayerId && rp.id === localPlayerId) continue;

      const pos = rp.getPosition();
      const to = pos.sub(origin);
      const vertical = Math.abs(to.y);
      to.y = 0;
      const dist = to.length();
      if (dist > LASSO_RANGE || vertical > LASSO_HEIGHT_WINDOW) continue;
      if (dist < 0.001) continue;

      to.normalize();
      const dot = forwardFlat.dot(to);
      if (dot < LASSO_CONE_DOT) continue;

      const score = dist + (1 - dot) * 14;
      if (!best || score < best.score) {
        best = { playerId: rp.id, score };
      }
    }

    return best;
  }
}
