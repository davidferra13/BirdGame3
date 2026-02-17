/**
 * PoopCoverMode (Splat Attack) - Race to cover a statue with poop.
 * Most coverage when time runs out wins. Color-coded poop per player.
 */

import * as THREE from 'three';
import { PvPMode, PvPPlayer, PvPResults, PvPStanding } from '../PvPMode';
import { PVP } from '../../utils/Constants';

// Statue prefabs: simple geometric shapes
const STATUE_PREFABS = [
  // Obelisk: tall, narrow column
  {
    name: 'Obelisk',
    create: (): THREE.Group => {
      const group = new THREE.Group();
      // Base
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1, 3),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.5 }),
      );
      base.position.y = 0.5;
      group.add(base);
      // Column
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 12, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.4, roughness: 0.4 }),
      );
      col.position.y = 7;
      group.add(col);
      // Pyramid top
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 2, 4),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.5, roughness: 0.3 }),
      );
      top.position.y = 14;
      group.add(top);
      return group;
    },
    height: 15,
  },
  // Human figure: stylized geometric person
  {
    name: 'Hero Statue',
    create: (): THREE.Group => {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.4, roughness: 0.4 });
      // Pedestal
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), mat.clone());
      pedestal.position.y = 1;
      group.add(pedestal);
      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1.5), mat.clone());
      torso.position.y = 5;
      group.add(torso);
      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), mat.clone());
      head.position.y = 8;
      group.add(head);
      // Arms (outstretched)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 0.6), mat.clone());
      arm.position.y = 5.5;
      group.add(arm);
      return group;
    },
    height: 9,
  },
  // Horse and rider: simplified
  {
    name: 'Horse & Rider',
    create: (): THREE.Group => {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.5 });
      // Pedestal
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 3), mat.clone());
      pedestal.position.y = 0.75;
      group.add(pedestal);
      // Horse body
      const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1.8), mat.clone());
      body.position.y = 3.5;
      group.add(body);
      // Horse legs (4)
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), mat.clone());
        leg.position.set(
          (i < 2 ? -1.4 : 1.4),
          2,
          (i % 2 === 0 ? -0.5 : 0.5),
        );
        group.add(leg);
      }
      // Horse head
      const hHead = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), mat.clone());
      hHead.position.set(-2.5, 4.5, 0);
      hHead.rotation.z = 0.3;
      group.add(hHead);
      // Rider
      const rider = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 1), mat.clone());
      rider.position.y = 6;
      group.add(rider);
      // Rider head
      const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), mat.clone());
      rHead.position.y = 7.8;
      group.add(rHead);
      return group;
    },
    height: 8,
  },
];

// Spawn locations for statues (prominent intersections / open areas)
const STATUE_SPAWN_POSITIONS = [
  new THREE.Vector3(0, 0, 0),        // City center
  new THREE.Vector3(100, 0, 50),     // East district
  new THREE.Vector3(-80, 0, -60),    // West district
  new THREE.Vector3(50, 0, -120),    // South intersection
  new THREE.Vector3(-60, 0, 100),    // North park area
];

export class PoopCoverMode extends PvPMode {
  private hitCounts = new Map<string, number>();
  private statueGroup: THREE.Group | null = null;
  private statuePosition = new THREE.Vector3();
  private beaconLight: THREE.PointLight | null = null;
  private splatMeshes: THREE.Mesh[] = [];
  private splatPool: THREE.Mesh[] = [];

  // Shared geometry for poop splats on statue
  private static splatGeo = new THREE.CircleGeometry(0.4, 6);

  getModeId(): string { return 'poop-cover'; }
  getModeName(): string { return 'Splat Attack'; }
  getModeDescription(): string { return 'Cover the statue with poop! Most coverage wins.'; }
  getModeIcon(): string { return '\uD83D\uDCA9'; }
  getRoundDuration(): number { return PVP.COVER_ROUND_DURATION; }
  getMinPlayers(): number { return PVP.COVER_MIN_PLAYERS; }
  getMaxPlayers(): number { return PVP.COVER_MAX_PLAYERS; }

  onStart(players: PvPPlayer[]): void {
    super.onStart(players);

    this.hitCounts.clear();
    for (const p of players) {
      this.hitCounts.set(p.id, 0);
    }

    // Pick random statue and position
    this.spawnStatue();

    // Pre-allocate splat pool
    this.splatPool = [];
    for (let i = 0; i < 200; i++) {
      const mesh = new THREE.Mesh(
        PoopCoverMode.splatGeo,
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      );
      mesh.visible = false;
      if (this.statueGroup) this.statueGroup.add(mesh);
      this.splatPool.push(mesh);
    }

    this.context.eventBus.on('statue-hit', this.handleStatueHit);
  }

  onUpdate(dt: number): void {
    this.elapsed += dt;

    // Check if local player's poop hit the statue
    // (Real detection happens via CollisionSystem integration in Game.ts)

    // Pulsing beacon
    if (this.beaconLight) {
      this.beaconLight.intensity = 2 + Math.sin(this.elapsed * 3) * 1;
    }

    // Update player scores
    for (const p of this.players) {
      p.score = this.hitCounts.get(p.id) || 0;
    }
  }

  onEnd(): PvPResults {
    this.context.eventBus.off('statue-hit', this.handleStatueHit);

    // Sort by hits (most = best)
    const sorted = [...this.players].sort((a, b) => {
      return (this.hitCounts.get(b.id) || 0) - (this.hitCounts.get(a.id) || 0);
    });

    const standings: PvPStanding[] = sorted.map((p, i) => {
      const hits = this.hitCounts.get(p.id) || 0;
      const isWinner = i === 0;

      return {
        player: p,
        rank: i + 1,
        score: hits,
        reward: isWinner ? PVP.COVER_WINNER_BONUS : PVP.COVER_PARTICIPATION_REWARD,
        label: `${hits} splat${hits !== 1 ? 's' : ''}`,
      };
    });

    this.cleanupVisuals();

    return {
      modeId: this.getModeId(),
      modeName: this.getModeName(),
      standings,
      duration: this.elapsed,
    };
  }

  getModeData(): any {
    const localPlayer = this.players.find(p => p.isLocal);
    const localHits = localPlayer ? (this.hitCounts.get(localPlayer.id) || 0) : 0;

    // Compute rank
    const sorted = [...this.players].sort((a, b) =>
      (this.hitCounts.get(b.id) || 0) - (this.hitCounts.get(a.id) || 0)
    );
    const rank = sorted.findIndex(p => p.isLocal) + 1;
    const ordinal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

    return {
      statuePosition: { x: this.statuePosition.x, y: this.statuePosition.y, z: this.statuePosition.z },
      localHits,
      localRank: ordinal,
      hitCounts: Object.fromEntries(this.hitCounts),
    };
  }

  /** Check if a position is within hit range of the statue. */
  isNearStatue(position: THREE.Vector3): boolean {
    return position.distanceTo(this.statuePosition) < PVP.COVER_HIT_RADIUS;
  }

  getStatuePosition(): THREE.Vector3 {
    return this.statuePosition.clone();
  }

  /** Register a poop hit on the statue for a specific player. */
  registerHit(playerId: string, hitPosition: THREE.Vector3): void {
    const current = this.hitCounts.get(playerId) || 0;

    // Accuracy bonus: closer to center = more points
    const dist = hitPosition.distanceTo(this.statuePosition);
    const points = dist < PVP.COVER_HIT_RADIUS * 0.3
      ? PVP.COVER_CENTER_BONUS
      : PVP.COVER_EDGE_POINTS;

    this.hitCounts.set(playerId, current + points);

    // Visual: add colored splat to statue
    this.addSplatToStatue(playerId, hitPosition);
  }

  private handleStatueHit = (data: { playerId: string; accuracy: number; hitPosition?: THREE.Vector3 }): void => {
    const pos = data.hitPosition || this.statuePosition;
    this.registerHit(data.playerId, pos);
  };

  private spawnStatue(): void {
    // Pick random prefab and position
    const prefab = STATUE_PREFABS[Math.floor(Math.random() * STATUE_PREFABS.length)];
    const spawnPos = STATUE_SPAWN_POSITIONS[Math.floor(Math.random() * STATUE_SPAWN_POSITIONS.length)];

    this.statuePosition.copy(spawnPos);
    this.statuePosition.y = prefab.height / 2;

    this.statueGroup = prefab.create();
    this.statueGroup.position.copy(spawnPos);
    this.context.scene.add(this.statueGroup);

    // Beacon light (visible from far away)
    this.beaconLight = new THREE.PointLight(0xffd700, 3, PVP.COVER_STATUE_BEACON_HEIGHT * 2);
    this.beaconLight.position.set(spawnPos.x, PVP.COVER_STATUE_BEACON_HEIGHT, spawnPos.z);
    this.context.scene.add(this.beaconLight);

    // Beacon pillar (thin glowing column)
    const beaconGeo = new THREE.CylinderGeometry(0.2, 0.2, PVP.COVER_STATUE_BEACON_HEIGHT, 6);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.15,
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.set(spawnPos.x, PVP.COVER_STATUE_BEACON_HEIGHT / 2, spawnPos.z);
    this.context.scene.add(beaconMesh);
    // Store on group for cleanup
    this.statueGroup.userData.beacon = beaconMesh;
  }

  private addSplatToStatue(playerId: string, _hitPos: THREE.Vector3): void {
    // Find an available splat from pool
    const splat = this.splatPool.find(m => !m.visible);
    if (!splat) return;

    // Get player color
    const player = this.players.find(p => p.id === playerId);
    const color = player ? player.color : 0xf0ead6;

    (splat.material as THREE.MeshBasicMaterial).color.setHex(color);

    // Place randomly on the statue surface
    const angle = Math.random() * Math.PI * 2;
    const height = 1 + Math.random() * 10;
    const radius = 1 + Math.random() * 1.5;
    splat.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius,
    );
    splat.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    const scale = 0.8 + Math.random() * 1;
    splat.scale.setScalar(scale);
    splat.visible = true;
    this.splatMeshes.push(splat);
  }

  private cleanupVisuals(): void {
    if (this.statueGroup) {
      // Remove beacon
      const beacon = this.statueGroup.userData.beacon as THREE.Mesh | undefined;
      if (beacon) {
        beacon.parent?.remove(beacon);
        beacon.geometry?.dispose();
        (beacon.material as THREE.Material)?.dispose();
      }

      this.statueGroup.parent?.remove(this.statueGroup);
      this.statueGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      });
      this.statueGroup = null;
    }

    if (this.beaconLight) {
      this.beaconLight.parent?.remove(this.beaconLight);
      this.beaconLight = null;
    }

    this.splatMeshes = [];
    this.splatPool = [];
  }

  dispose(): void {
    this.cleanupVisuals();
    this.context?.eventBus.off('statue-hit', this.handleStatueHit);
  }
}
