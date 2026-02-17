/**
 * SystemManager — Container for all game systems.
 * Groups related systems and provides typed access.
 * Extracted from Game.ts to reduce field sprawl and improve organization.
 */

import * as THREE from 'three';
import { CollisionSystem } from '../systems/CollisionSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { BankingSystem } from '../systems/BankingSystem';
import { PlayerStateMachine } from '../systems/PlayerStateMachine';
import { HotspotSystem } from '../systems/HotspotSystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { CosmeticsSystem } from '../systems/CosmeticsSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { VFXSystem } from '../systems/VFXSystem';
import { EmoteSystem } from '../systems/EmoteSystem';
import { FlightRingSystem } from '../systems/FlightRingSystem';
import { CollectibleSystem } from '../systems/CollectibleSystem';
import { TimeWeatherSystem } from '../systems/TimeWeatherSystem';
import { AirTrafficSystem } from '../systems/AirTrafficSystem';
import { ComboSystem } from '../systems/ComboSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { GrabSystem } from '../systems/GrabSystem';
import { VehicleSystem } from '../systems/VehicleSystem';
import { StreetLifeSystem } from '../systems/StreetLifeSystem';
import { AbilityManager } from '../systems/abilities/AbilityManager';
import { ABILITY_CHARGE } from '../systems/abilities/AbilityTypes';
import { City } from '../world/City';

const WORLD_BOUNDS = { minX: -750, maxX: 750, minZ: -750, maxZ: 750 };

export class SystemManager {
  // --- Gameplay ---
  readonly score: ScoreSystem;
  readonly banking: BankingSystem;
  readonly playerState: PlayerStateMachine;
  readonly combo: ComboSystem;
  readonly mission: MissionSystem;
  readonly grab: GrabSystem;
  readonly collision: CollisionSystem;
  readonly progression: ProgressionSystem;

  // --- Presentation ---
  readonly cosmetics: CosmeticsSystem;
  readonly audio: AudioSystem;
  readonly vfx: VFXSystem;
  readonly emote: EmoteSystem;

  // --- World ---
  readonly hotspot: HotspotSystem;
  readonly flightRings: FlightRingSystem;
  readonly collectibles: CollectibleSystem;
  readonly timeWeather: TimeWeatherSystem;
  readonly airTraffic: AirTrafficSystem;
  readonly vehicle: VehicleSystem;
  readonly streetLife: StreetLifeSystem;
  readonly ability: AbilityManager;

  constructor(
    scene: THREE.Scene,
    city: City,
    sun: THREE.DirectionalLight,
    camera: THREE.Camera,
    progressionLevel: number,
  ) {
    // Gameplay systems
    this.score = new ScoreSystem();
    this.banking = new BankingSystem();
    this.playerState = new PlayerStateMachine();
    this.combo = new ComboSystem();
    this.mission = new MissionSystem();
    this.grab = new GrabSystem();
    this.collision = new CollisionSystem();
    this.progression = new ProgressionSystem();

    // Presentation
    this.cosmetics = new CosmeticsSystem();
    this.audio = new AudioSystem();
    this.vfx = new VFXSystem(scene);
    this.vfx.setCamera(camera);
    this.emote = new EmoteSystem();

    // World systems
    this.hotspot = new HotspotSystem();
    scene.add(this.hotspot.group);

    this.flightRings = new FlightRingSystem(WORLD_BOUNDS);
    scene.add(this.flightRings.group);

    this.collectibles = new CollectibleSystem(city.buildings, WORLD_BOUNDS);
    scene.add(this.collectibles.group);

    this.timeWeather = new TimeWeatherSystem(scene, sun, city);

    this.airTraffic = new AirTrafficSystem(WORLD_BOUNDS);
    scene.add(this.airTraffic.group);

    this.vehicle = new VehicleSystem(city.streetPaths);
    scene.add(this.vehicle.group);

    this.streetLife = new StreetLifeSystem(WORLD_BOUNDS, city.streetPaths);
    scene.add(this.streetLife.group);

    // Ability system
    this.ability = new AbilityManager();
    this.ability.initPools(scene);
    this.ability.setPlayerLevel(progressionLevel);
    scene.add(this.ability.group);
  }

  /** Wire the combo tier audio callback */
  wireComboAudio(): void {
    this.combo.onComboTierAchieved = (tierName: string) => {
      const tierMap: Record<string, number> = {
        'DOUBLE!': 1, 'TRIPLE!': 2, 'MULTI KILL!': 3,
        'MEGA COMBO!': 4, 'ULTRA COMBO!': 5, 'LEGENDARY!!!': 6,
      };
      this.audio.playComboTierUp(tierMap[tierName] || 1);
    };
  }

  /** Wire the flip callback to charge the ability meter */
  wireFlipCharge(onFlip: (chargeAmount: number) => void): (type: string, isDouble: boolean) => void {
    return (type: string, isDouble: boolean) => {
      const charge = ABILITY_CHARGE.PER_FLIP * (isDouble ? 2 : 1);
      this.ability.addCharge(charge);
      this.ability.notifyPlayerFlip(type);
      onFlip(charge);
    };
  }
}
