/**
 * HeistMode - 1v1 Aerial Keep-Away PvP Mode.
 * Extends PvPMode to integrate with PvPManager lifecycle.
 * Orchestrates trophy, pedestals, slam system, HUD, bot, and match state.
 */

import * as THREE from 'three';
import { PvPMode, PvPPlayer, PvPResults, PvPStanding } from '../PvPMode';
import { HeistTrophy } from './heist/HeistTrophy';
import { HeistPedestal } from './heist/HeistPedestal';
import { HeistSlamSystem, SlamResult } from './heist/HeistSlamSystem';
import { HeistHUD, TrophyStatusLabel } from './heist/HeistHUD';
import { HeistBot } from './heist/HeistBot';
import { HEIST, FLIGHT } from '../../utils/Constants';

export type HeistPhase = 'waiting' | 'countdown' | 'active' | 'overtime' | 'score_pause' | 'complete';

interface HeistPlayerData {
  player: PvPPlayer;
  score: number;
  slamCount: number;
  carryTime: number;
  longestCarry: number;
  currentCarryStart: number;
  isCarrying: boolean;
}

export class HeistMode extends PvPMode {
  // --- Match state ---
  private heistPhase: HeistPhase = 'waiting';
  private matchTimer = HEIST.MATCH_TIME_LIMIT;
  private scorePauseTimer = 0;
  private overtimeActive = false;

  // --- Entities ---
  private trophy: HeistTrophy | null = null;
  private pedestals: HeistPedestal[] = [];
  private slamSystem = new HeistSlamSystem();
  private hud: HeistHUD | null = null;

  // --- Player data ---
  private playerData = new Map<string, HeistPlayerData>();
  private carrierId: string | null = null;

  // --- Bot ---
  private bot: HeistBot | null = null;

  // --- Carrier trail VFX ---
  private carrierTrail: THREE.Line | null = null;
  private trailPoints: THREE.Vector3[] = [];
  private carrierGlow: THREE.PointLight | null = null;

  // --- Camera reference for HUD arrows ---
  private camera: THREE.Camera | null = null;

  // --- Local player references ---
  private localFlightSpeed = 0;

  // PvPMode interface
  getModeId(): string { return 'heist'; }
  getModeName(): string { return 'Heist'; }
  getModeDescription(): string { return '1v1 aerial keep-away! Grab the trophy and deliver it to your pedestal. Body-slam the carrier to steal it!'; }
  getModeIcon(): string { return '\uD83C\uDFC6'; } // trophy emoji
  getRoundDuration(): number { return HEIST.MATCH_TIME_LIMIT; }
  getMinPlayers(): number { return 2; }
  getMaxPlayers(): number { return 2; }

  /** Set camera reference for directional arrows */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /** Update local player's flight speed (called from Game.ts) */
  setLocalFlightSpeed(speed: number): void {
    this.localFlightSpeed = speed;
  }

  onStart(players: PvPPlayer[]): void {
    super.onStart(players);

    this.heistPhase = 'active';
    this.matchTimer = HEIST.MATCH_TIME_LIMIT;
    this.overtimeActive = false;
    this.carrierId = null;

    // Initialize player data
    this.playerData.clear();
    for (const p of this.players) {
      this.playerData.set(p.id, {
        player: p,
        score: 0,
        slamCount: 0,
        carryTime: 0,
        longestCarry: 0,
        currentCarryStart: 0,
        isCarrying: false,
      });
    }

    // Determine player colors (Player 1 = local = blue, Player 2 = opponent = red)
    const localPlayer = this.players.find(p => p.isLocal);
    const opponentPlayer = this.players.find(p => !p.isLocal);
    if (localPlayer) localPlayer.color = HEIST.PLAYER_1_COLOR;
    if (opponentPlayer) opponentPlayer.color = HEIST.PLAYER_2_COLOR;

    // Spawn trophy at city center
    const centerPos = new THREE.Vector3(0, HEIST.TROPHY_HOVER_HEIGHT, 0);
    this.trophy = new HeistTrophy(this.context.scene, centerPos);

    // Spawn pedestals
    if (localPlayer) {
      const localPedestalPos = new THREE.Vector3(
        -HEIST.PEDESTAL_DISTANCE_FROM_CENTER, HEIST.PEDESTAL_HEIGHT, 0,
      );
      this.pedestals.push(new HeistPedestal(
        this.context.scene, localPlayer.id, localPlayer.color, localPedestalPos,
      ));
    }
    if (opponentPlayer) {
      const opponentPedestalPos = new THREE.Vector3(
        HEIST.PEDESTAL_DISTANCE_FROM_CENTER, HEIST.PEDESTAL_HEIGHT, 0,
      );
      this.pedestals.push(new HeistPedestal(
        this.context.scene, opponentPlayer.id, opponentPlayer.color, opponentPedestalPos,
      ));
    }

    // Teleport players to spawn positions
    if (localPlayer) {
      localPlayer.position.set(
        -HEIST.PLAYER_SPAWN_DISTANCE, HEIST.PLAYER_SPAWN_HEIGHT, 0,
      );
    }
    if (opponentPlayer) {
      opponentPlayer.position.set(
        HEIST.PLAYER_SPAWN_DISTANCE, HEIST.PLAYER_SPAWN_HEIGHT, 0,
      );
    }

    // Create HUD
    this.hud = new HeistHUD();
    this.hud.show();

    // Create carrier trail
    this.initCarrierTrail();

    // Create bot if opponent is a bot
    if (opponentPlayer?.isBot) {
      this.bot = new HeistBot(opponentPlayer, this.context.scene);
      this.bot.setEventCallback((type, data) => this.handleBotEvent(type, data));
    }

    // Emit start event
    this.context.eventBus.emit('round-phase-change', {
      phase: 'active',
      modeId: 'heist',
      modeName: 'Heist',
    });
  }

  onUpdate(dt: number): void {
    this.elapsed += dt;

    if (!this.trophy) return;

    // Update trophy
    this.trophy.update(dt);

    // Update pedestals
    for (const pedestal of this.pedestals) {
      pedestal.update(dt);
    }

    // Update slam system
    this.slamSystem.update(dt);

    // Update based on phase
    switch (this.heistPhase) {
      case 'active':
      case 'overtime':
        this.updateActivePhase(dt);
        break;
      case 'score_pause':
        this.updateScorePause(dt);
        break;
      case 'complete':
        break;
    }

    // Update bot
    if (this.bot) {
      this.updateBotData();
      this.bot.update(dt);
    }

    // Update HUD
    this.updateHUD(dt);

    // Update carrier trail
    this.updateCarrierTrail();
  }

  private updateActivePhase(dt: number): void {
    if (!this.trophy) return;

    // Timer countdown (not during overtime)
    if (this.heistPhase === 'active') {
      this.matchTimer -= dt;

      if (this.matchTimer <= 0) {
        this.matchTimer = 0;
        this.handleTimeExpired();
        return;
      }
    }

    // Track carry time
    if (this.carrierId) {
      const data = this.playerData.get(this.carrierId);
      if (data) {
        data.carryTime += dt;
        const currentCarryDuration = (performance.now() - data.currentCarryStart) / 1000;
        if (currentCarryDuration > data.longestCarry) {
          data.longestCarry = currentCarryDuration;
        }
      }
    }

    // Check local player trophy grab
    if (!this.carrierId && this.trophy.canBeGrabbed) {
      const localPlayer = this.players.find(p => p.isLocal);
      if (localPlayer) {
        const distSq = localPlayer.position.distanceToSquared(this.trophy.getWorldPosition());
        if (distSq < 36) { // ~6 unit grab radius
          this.grabTrophy(localPlayer.id);
        }
      }
    }

    // Check slam (local player attacking carrier)
    if (this.carrierId) {
      const localPlayer = this.players.find(p => p.isLocal);
      const carrier = this.players.find(p => p.id === this.carrierId);

      if (localPlayer && carrier && localPlayer.id !== this.carrierId) {
        // Local player is the attacker
        const result = this.slamSystem.checkSlam(localPlayer, carrier, this.localFlightSpeed);
        if (result) {
          this.handleSlam(result);
        }
      }
    }

    // Update carried trophy position
    if (this.carrierId && this.trophy.state === 'carried') {
      const carrier = this.players.find(p => p.id === this.carrierId);
      if (carrier) {
        this.trophy.updateCarriedPosition(carrier.position, 0);

        // Check scoring: carrier enters their own pedestal
        const carrierPedestal = this.pedestals.find(p => p.playerId === this.carrierId);
        if (carrierPedestal?.isInTriggerZone(carrier.position)) {
          this.handleScore(this.carrierId);
        }
      }
    }
  }

  private updateScorePause(dt: number): void {
    this.scorePauseTimer -= dt;
    if (this.scorePauseTimer <= 0) {
      // Respawn trophy at center
      this.trophy?.resetToCenter();
      this.heistPhase = this.overtimeActive ? 'overtime' : 'active';
    }
  }

  private grabTrophy(playerId: string): void {
    if (!this.trophy || this.carrierId) return;

    this.carrierId = playerId;
    this.trophy.attachToCarrier();

    const data = this.playerData.get(playerId);
    if (data) {
      data.isCarrying = true;
      data.currentCarryStart = performance.now();
    }

    this.context.eventBus.emit('score-update', {
      type: 'heist-grab',
      playerId,
    });
  }

  private dropTrophy(carrierVelocity: THREE.Vector3): void {
    if (!this.trophy || !this.carrierId) return;

    const data = this.playerData.get(this.carrierId);
    if (data) {
      data.isCarrying = false;
    }

    this.trophy.drop(carrierVelocity);
    this.carrierId = null;
  }

  private handleSlam(result: SlamResult): void {
    if (!this.trophy) return;

    // Track slam stats
    const attackerData = this.playerData.get(result.attackerId);
    if (attackerData) {
      attackerData.slamCount++;
    }

    // Drop the trophy
    const carrier = this.players.find(p => p.id === result.carrierId);
    const carrierVelocity = carrier
      ? new THREE.Vector3(0, 0, -1).multiplyScalar(FLIGHT.BASE_SPEED)
      : new THREE.Vector3();
    this.dropTrophy(carrierVelocity);

    // Apply knockback to carrier position
    if (carrier) {
      carrier.position.add(result.carrierKnockback.clone().multiplyScalar(0.3));
    }

    // Apply recoil to attacker position
    const attacker = this.players.find(p => p.id === result.attackerId);
    if (attacker) {
      attacker.position.add(result.attackerRecoil.clone().multiplyScalar(0.3));
    }

    // VFX: feather burst at impact
    // (handled by Game.ts via event bus — VFX and audio are external systems)
    this.context.eventBus.emit('score-update', {
      type: 'heist-slam',
      attackerId: result.attackerId,
      carrierId: result.carrierId,
      impactPoint: result.impactPoint,
    });
  }

  private handleScore(playerId: string): void {
    if (!this.trophy) return;

    const data = this.playerData.get(playerId);
    if (!data) return;

    data.score++;
    data.isCarrying = false;
    this.carrierId = null;

    // Update PvPPlayer score
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.score = data.score;
    }

    // Celebration VFX
    const pedestal = this.pedestals.find(p => p.playerId === playerId);
    if (pedestal) {
      pedestal.playCelebration(this.context.scene);
    }

    // Hide trophy and pause
    this.trophy.hideForScore();
    this.scorePauseTimer = HEIST.SCORE_PAUSE_DURATION;
    this.heistPhase = 'score_pause';

    // Check win condition
    if (data.score >= HEIST.POINTS_TO_WIN) {
      this.heistPhase = 'complete';
    }

    this.context.eventBus.emit('score-update', {
      type: 'heist-score',
      playerId,
      score: data.score,
    });
  }

  private handleTimeExpired(): void {
    // Find scores
    const scores = Array.from(this.playerData.values()).map(d => ({
      id: d.player.id,
      score: d.score,
    }));

    scores.sort((a, b) => b.score - a.score);

    if (scores.length >= 2 && scores[0].score === scores[1].score) {
      // Tied — enter overtime
      this.overtimeActive = true;
      this.heistPhase = 'overtime';
      // Drop trophy if carried and reset to center
      if (this.carrierId) {
        this.dropTrophy(new THREE.Vector3());
      }
      this.trophy?.resetToCenter();
    } else {
      // Higher score wins
      this.heistPhase = 'complete';
    }
  }

  private handleBotEvent(type: string, data: any): void {
    switch (type) {
      case 'heist-grab':
        if (this.trophy?.canBeGrabbed && !this.carrierId) {
          this.grabTrophy(data.playerId);
        }
        break;
      case 'heist-score': {
        // Bot reached their pedestal while carrying
        if (this.carrierId === data.playerId) {
          this.handleScore(data.playerId);
        }
        break;
      }
      case 'heist-slam': {
        // Bot attempting a slam on the carrier
        if (this.carrierId && this.carrierId !== data.attackerId) {
          const attacker = this.players.find(p => p.id === data.attackerId);
          const carrier = this.players.find(p => p.id === this.carrierId);
          if (attacker && carrier) {
            const result = this.slamSystem.checkSlam(attacker, carrier, data.speed);
            if (result) {
              this.handleSlam(result);
            }
          }
        }
        break;
      }
    }
  }

  private updateBotData(): void {
    if (!this.bot || !this.trophy) return;

    const localPlayer = this.players.find(p => p.isLocal);
    const botPedestal = this.pedestals.find(p => p.playerId === this.bot!.player.id);

    this.bot.updateModeData({
      trophyPosition: this.trophy.getWorldPosition(),
      trophyCarrierId: this.carrierId,
      pedestalPosition: botPedestal?.position ?? new THREE.Vector3(),
      opponentPosition: localPlayer?.position ?? new THREE.Vector3(),
      botCarryingTrophy: this.carrierId === this.bot.player.id,
    });
  }

  private updateHUD(_dt: number): void {
    if (!this.hud || !this.trophy) return;

    const localPlayer = this.players.find(p => p.isLocal);
    const opponentPlayer = this.players.find(p => !p.isLocal);
    const localData = localPlayer ? this.playerData.get(localPlayer.id) : null;
    const opponentData = opponentPlayer ? this.playerData.get(opponentPlayer.id) : null;

    // Score
    this.hud.updateScore(
      localData?.score ?? 0,
      opponentData?.score ?? 0,
      `#${(localPlayer?.color ?? 0x4488ff).toString(16).padStart(6, '0')}`,
      `#${(opponentPlayer?.color ?? 0xff4444).toString(16).padStart(6, '0')}`,
    );

    // Timer
    if (this.overtimeActive) {
      this.hud.updateTimer(-1); // Show "OT" indicator
    } else {
      this.hud.updateTimer(this.matchTimer);
    }

    // Trophy status
    let trophyStatus: TrophyStatusLabel;
    if (this.trophy.state === 'carried') {
      if (this.carrierId === localPlayer?.id) {
        trophyStatus = 'YOU HAVE IT';
      } else {
        trophyStatus = 'OPPONENT HAS IT';
      }
    } else if (this.trophy.state === 'falling' || (this.trophy.state === 'settling' || (this.trophy.state === 'idle' && this.trophy.getWorldPosition().distanceTo(new THREE.Vector3(0, HEIST.TROPHY_HOVER_HEIGHT, 0)) > 10))) {
      trophyStatus = 'LOOSE';
    } else {
      trophyStatus = 'CENTER';
    }
    this.hud.updateTrophyStatus(trophyStatus);

    // Slam cooldown
    if (localPlayer) {
      const cooldown = this.slamSystem.getCooldown(localPlayer.id);
      this.hud.updateSlamCooldown(cooldown, HEIST.SLAM_COOLDOWN);
    }

    // Directional arrows
    if (this.camera) {
      // Trophy arrow (always show when not looking at it)
      this.hud.updateTrophyArrow(this.trophy.getWorldPosition(), this.camera);

      // Pedestal arrow (show when carrying)
      if (this.carrierId === localPlayer?.id) {
        const myPedestal = this.pedestals.find(p => p.playerId === localPlayer?.id);
        if (myPedestal) {
          const colorHex = `#${(localPlayer?.color ?? 0x4488ff).toString(16).padStart(6, '0')}`;
          this.hud.updatePedestalArrow(myPedestal.position, this.camera, colorHex);
        }
      } else {
        this.hud.hidePedestalArrow();
      }
    }
  }

  // --- Carrier trail VFX ---

  private initCarrierTrail(): void {
    const maxPoints = 20;
    this.trailPoints = [];
    for (let i = 0; i < maxPoints; i++) {
      this.trailPoints.push(new THREE.Vector3());
    }

    const positions = new Float32Array(maxPoints * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.5,
    });

    this.carrierTrail = new THREE.Line(geometry, material);
    this.carrierTrail.frustumCulled = false;
    this.context.scene.add(this.carrierTrail);
  }

  private updateCarrierTrail(): void {
    if (!this.carrierTrail) return;

    const carrier = this.carrierId ? this.players.find(p => p.id === this.carrierId) : null;

    if (carrier) {
      // Update trail color to carrier's color
      (this.carrierTrail.material as THREE.LineBasicMaterial).color.setHex(carrier.color);
      (this.carrierTrail.material as THREE.LineBasicMaterial).opacity = 0.5;

      // Shift points and add new position
      for (let i = this.trailPoints.length - 1; i > 0; i--) {
        this.trailPoints[i].copy(this.trailPoints[i - 1]);
      }
      this.trailPoints[0].copy(carrier.position);

      // Update geometry
      const posAttr = this.carrierTrail.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.trailPoints.length; i++) {
        posAttr.setXYZ(i, this.trailPoints[i].x, this.trailPoints[i].y, this.trailPoints[i].z);
      }
      posAttr.needsUpdate = true;
      this.carrierTrail.geometry.setDrawRange(0, this.trailPoints.length);

      // Carrier glow
      if (!this.carrierGlow) {
        this.carrierGlow = new THREE.PointLight(0xffd700, 1.5, 20);
        this.context.scene.add(this.carrierGlow);
      }
      this.carrierGlow.position.copy(carrier.position);
      this.carrierGlow.color.setHex(carrier.color);
    } else {
      // No carrier — hide trail
      this.carrierTrail.geometry.setDrawRange(0, 0);
      if (this.carrierGlow) {
        this.carrierGlow.parent?.remove(this.carrierGlow);
        this.carrierGlow = null;
      }
    }
  }

  // --- PvPMode interface ---

  onEnd(): PvPResults {
    // Build standings
    const standings: PvPStanding[] = [];
    const dataList = Array.from(this.playerData.values());
    dataList.sort((a, b) => b.score - a.score);

    for (let i = 0; i < dataList.length; i++) {
      const d = dataList[i];
      standings.push({
        player: d.player,
        rank: i + 1,
        score: d.score,
        reward: 0, // Heist has no sandbox rewards
        label: i === 0 ? 'Winner!' : `${d.score} points`,
      });
    }

    // Clean up HUD
    this.hud?.hide();

    return {
      modeId: 'heist',
      modeName: 'Heist',
      standings,
      duration: this.elapsed,
    };
  }

  getModeData(): any {
    return {
      heistPhase: this.heistPhase,
      carrierId: this.carrierId,
      trophyPosition: this.trophy?.getWorldPosition() ?? new THREE.Vector3(),
      trophyState: this.trophy?.state ?? 'idle',
      matchTimer: this.matchTimer,
      overtimeActive: this.overtimeActive,
      scores: Object.fromEntries(
        Array.from(this.playerData.entries()).map(([id, d]) => [id, d.score]),
      ),
      stats: Object.fromEntries(
        Array.from(this.playerData.entries()).map(([id, d]) => [id, {
          slamCount: d.slamCount,
          carryTime: d.carryTime,
          longestCarry: d.longestCarry,
        }]),
      ),
      pedestals: this.pedestals.map(p => ({
        playerId: p.playerId,
        position: p.position,
        color: p.playerColor,
      })),
    };
  }

  /** Check if the mode is complete (used by PvPManager to trigger ending) */
  isComplete(): boolean {
    return this.heistPhase === 'complete';
  }

  dispose(): void {
    // Trophy
    this.trophy?.dispose();
    this.trophy = null;

    // Pedestals
    for (const pedestal of this.pedestals) {
      pedestal.dispose();
    }
    this.pedestals = [];

    // HUD
    this.hud?.dispose();
    this.hud = null;

    // Bot
    this.bot?.dispose();
    this.bot = null;

    // Trail
    if (this.carrierTrail) {
      this.carrierTrail.parent?.remove(this.carrierTrail);
      this.carrierTrail.geometry.dispose();
      (this.carrierTrail.material as THREE.Material).dispose();
      this.carrierTrail = null;
    }

    // Carrier glow
    if (this.carrierGlow) {
      this.carrierGlow.parent?.remove(this.carrierGlow);
      this.carrierGlow = null;
    }

    // Slam system
    this.slamSystem.reset();

    // Clear data
    this.playerData.clear();
    this.carrierId = null;
  }
}
