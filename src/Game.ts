import * as THREE from 'three';
import { assetLoader } from './systems/AssetLoader';
import { InputManager } from './core/InputManager';
import { Bird } from './entities/Bird';
import { PoopManager } from './entities/PoopManager';
import { NPCManager } from './entities/NPCManager';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { CameraEffects } from './camera/CameraEffects';
import { DropCamera } from './camera/DropCamera';
import { City } from './world/City';
import { createGround } from './world/Ground';
import { Sanctuary } from './world/Sanctuary';
import { CollisionSystem } from './systems/CollisionSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { BankingSystem } from './systems/BankingSystem';
import { PlayerStateMachine } from './systems/PlayerStateMachine';
import { HotspotSystem } from './systems/HotspotSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { CosmeticsSystem } from './systems/CosmeticsSystem';
import { AudioSystem } from './systems/AudioSystem';
import { VFXSystem } from './systems/VFXSystem';
import { EmoteSystem } from './systems/EmoteSystem';
import { FlightRingSystem } from './systems/FlightRingSystem';
import { CollectibleSystem } from './systems/CollectibleSystem';
import { TimeWeatherSystem } from './systems/TimeWeatherSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { AirTrafficSystem } from './systems/AirTrafficSystem';
import { ComboSystem } from './systems/ComboSystem';
import { MissionSystem } from './systems/MissionSystem';
import { GrabSystem } from './systems/GrabSystem';
import { VehicleSystem } from './systems/VehicleSystem';
import { DrivingSystem } from './systems/DrivingSystem';
import { StreetLifeSystem } from './systems/StreetLifeSystem';
import { AbilityManager } from './systems/abilities/AbilityManager';
import { ABILITY_CHARGE } from './systems/abilities/AbilityTypes';
import { HUD } from './ui/HUD';
import { CoinPopupManager } from './ui/CoinPopup';
import { TutorialSystem } from './ui/TutorialSystem';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsMenu } from './ui/SettingsMenu';
import { ShopMenu } from './ui/ShopMenu';
import { Minimap } from './ui/Minimap';
import { LeaderBird } from './ui/Leaderboard';
import { AchievementsPanel } from './ui/AchievementsPanel';
import { KeyboardHelper } from './ui/KeyboardHelper';
import { SharePrompt } from './ui/SharePrompt';
import { SpeedEffects } from './ui/SpeedEffects';
import { SCORE, FLIGHT, WORLD, ALTITUDE_WARNING, NPC_CONFIG, ECONOMY } from './utils/Constants';
import { BuildingData } from './world/City';
import { SANCTUARY } from './world/Sanctuary';
import { MultiplayerManager } from './multiplayer/MultiplayerManager';
import { ChatUI } from './ui/ChatUI';
// PostProcessing removed for performance — rendering directly now
import { CloudSystem } from './world/Clouds';
import { Ocean } from './world/Ocean';
import { createRenderer, createScene, setupLighting, createSky } from './core/GameInitializer';
import { PvPManager } from './pvp/PvPManager';
import { PoopTagMode } from './pvp/modes/PoopTagMode';
import { RaceMode } from './pvp/modes/RaceMode';
import { PoopCoverMode } from './pvp/modes/PoopCoverMode';
import { HeistMode } from './pvp/modes/HeistMode';
import { MurmurationSystem } from './systems/MurmurationSystem';
import { MvMPvPManager } from './systems/MvMPvPManager';
import { MurmurationPanel } from './ui/MurmurationPanel';

export class Game {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly input: InputManager;
  readonly cameraController: ThirdPersonCamera;
  private cameraEffects: CameraEffects;
  private dropCamera: DropCamera;

  private bird: Bird;
  private poopManager: PoopManager;
  private npcManager: NPCManager;
  private collisionSystem: CollisionSystem;
  private scoreSystem: ScoreSystem;
  private bankingSystem: BankingSystem;
  private playerState: PlayerStateMachine;
  private comboSystem: ComboSystem;
  private missionSystem!: MissionSystem;
  private grabSystem: GrabSystem;
  private hotspotSystem: HotspotSystem;
  readonly progression: ProgressionSystem;
  private cosmetics: CosmeticsSystem;
  readonly audio: AudioSystem;
  private vfx: VFXSystem;
  private emoteSystem: EmoteSystem;
  private flightRings: FlightRingSystem;
  private collectibles: CollectibleSystem;
  private timeWeather: TimeWeatherSystem;
  private airTraffic: AirTrafficSystem;
  private vehicleSystem: VehicleSystem;
  private drivingSystem: DrivingSystem;
  private streetLife: StreetLifeSystem;
  private abilityManager: AbilityManager;
  private hud: HUD;
  private coinPopups: CoinPopupManager;
  private sanctuary: Sanctuary;
  private tutorial: TutorialSystem;
  readonly pauseMenu: PauseMenu;
  readonly settingsMenu: SettingsMenu;
  readonly shopMenu: ShopMenu;
  readonly minimap: Minimap;
  readonly leaderbird: LeaderBird;
  readonly achievementsPanel: AchievementsPanel;
  readonly keyboardHelper: KeyboardHelper;
  private multiplayer: MultiplayerManager | null = null;
  private pvpManager!: PvPManager;
  private murmurationSystem!: MurmurationSystem;
  private mvmManager!: MvMPvPManager;
  private murmurationPanel!: MurmurationPanel;
  private chatUI: ChatUI;
  private sharePrompt: SharePrompt;
  private speedEffects: SpeedEffects;
  private sun!: THREE.DirectionalLight;
  private city!: City;
  // postProcessing removed for performance
  private clouds!: CloudSystem;
  private ocean!: Ocean;
  private environmentSystem!: EnvironmentSystem;
  private skyController: { setSunPosition: (elevation: number, azimuth: number) => void } | null = null;
  private gameElapsed = 0;
  private paused = false;
  private audioInitialized = false;
  private multiplayerEnabled = true;  // Enable multiplayer by default

  // Performance monitoring
  private fpsCounter: HTMLDivElement | null = null;
  private frameCount = 0;
  private lastFPSUpdate = 0;

  // Intro / first-spawn state
  private introPhase = true;
  private firstDropDone = false;

  // Safe respawn perches (building rooftops at city edges)
  private spawnPerches: THREE.Vector3[] = [];
  private lastGroundingPos = new THREE.Vector3();

  // Altitude warning grace period
  private groundingGraceTimer = 0;

  // Frustum culling for buildings (Phase 1 optimization)
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();
  private _cullSphere = new THREE.Sphere();

  // Reusable scratch vectors to avoid per-frame allocations
  private _tmpVec3A = new THREE.Vector3();
  private _tmpVec3B = new THREE.Vector3();

  constructor() {
    this.renderer = createRenderer();
    this.scene = createScene();
    this.environmentSystem = new EnvironmentSystem(this.renderer);
    this.input = new InputManager();
    this.cameraController = new ThirdPersonCamera(
      window.innerWidth / window.innerHeight,
    );
    this.cameraEffects = new CameraEffects(this.cameraController.camera);
    this.sun = setupLighting(this.scene);

    // Atmospheric sky shader (replaces flat background)
    const { setSunPosition } = createSky(this.scene);
    this.skyController = { setSunPosition };

    // World - Procedural ground plane
    this.scene.add(createGround());

    // City (procedural buildings, districts, landmarks)
    this.city = new City();
    this.scene.add(this.city.group);

    // Animated ocean (replaces City's old flat plane)
    this.ocean = new Ocean();
    this.scene.add(this.ocean.mesh);

    this.sanctuary = new Sanctuary();
    this.scene.add(this.sanctuary.group);

    // Clouds
    this.clouds = new CloudSystem();
    this.scene.add(this.clouds.group);

    // Post-processing removed for performance — direct rendering
    // Tone mapping still applied via renderer
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Hotspots
    this.hotspotSystem = new HotspotSystem();
    this.scene.add(this.hotspotSystem.group);

    // Compute spawn perches from buildings
    this.computeSpawnPerches(this.city.buildings);

    // Bird — first spawn on rooftop near Sanctuary
    this.bird = new Bird();
    this.bird.controller.setBuildings(this.city.buildings);
    this.scene.add(this.bird.mesh);
    this.setupFirstSpawn(this.city.buildings);

    // Poop
    this.poopManager = new PoopManager(this.scene);

    // NPCs
    this.npcManager = new NPCManager(this.scene, this.city.streetPaths);
    this.npcManager.setBuildings(this.city.buildings);
    this.npcManager.setHotspots(this.hotspotSystem.getPositions(), 40);

    // Spawn a tourist NPC below the bird's starting building for scripted hook
    this.npcManager.spawnNPCAt(new THREE.Vector3(
      this.bird.controller.position.x,
      0,
      this.bird.controller.position.z,
    ), 'tourist');

    // Systems
    this.collisionSystem = new CollisionSystem();
    this.scoreSystem = new ScoreSystem();
    this.bankingSystem = new BankingSystem();
    this.playerState = new PlayerStateMachine();
    this.comboSystem = new ComboSystem();
    this.comboSystem.onComboTierAchieved = (tierName: string) => {
      const tierMap: Record<string, number> = {
        'DOUBLE!': 1, 'TRIPLE!': 2, 'MULTI KILL!': 3,
        'MEGA COMBO!': 4, 'ULTRA COMBO!': 5, 'LEGENDARY!!!': 6,
      };
      const tier = tierMap[tierName] || 1;
      this.audio.playComboTierUp(tier);
      // Screen flash on combo tier-ups (gold flash, intensity scales with tier)
      if (this.speedEffects) {
        this.speedEffects.triggerFlash(Math.min(tier * 0.2, 1), 'gold');
      }
    };
    this.missionSystem = new MissionSystem();
    this.grabSystem = new GrabSystem();
    this.progression = new ProgressionSystem();
    this.cosmetics = new CosmeticsSystem();
    this.audio = new AudioSystem();
    this.vfx = new VFXSystem(this.scene);
    this.vfx.setCamera(this.cameraController.camera);  // PHASE 5: For distance-based particle culling
    this.emoteSystem = new EmoteSystem();

    // New gameplay systems
    this.flightRings = new FlightRingSystem({ minX: -750, maxX: 750, minZ: -750, maxZ: 750 });
    this.scene.add(this.flightRings.group);

    this.collectibles = new CollectibleSystem(this.city.buildings, { minX: -750, maxX: 750, minZ: -750, maxZ: 750 });
    this.scene.add(this.collectibles.group);

    this.timeWeather = new TimeWeatherSystem(this.scene, this.sun, this.city);

    // Connect sky, post-processing, and ocean to the time/weather system
    if (this.skyController) {
      this.timeWeather.setSkyController(this.skyController.setSunPosition);
    }
    // postProcessing removed — no color grading hookup needed
    this.timeWeather.setOcean(this.ocean);

    this.airTraffic = new AirTrafficSystem({ minX: -750, maxX: 750, minZ: -750, maxZ: 750 });
    this.scene.add(this.airTraffic.group);

    this.vehicleSystem = new VehicleSystem(this.city.streetPaths);
    this.vehicleSystem.setNPCs(this.npcManager.npcs);
    this.scene.add(this.vehicleSystem.group);

    // Drivable convertibles (bird driving mechanic)
    this.drivingSystem = new DrivingSystem(this.city.buildings, this.city.streetPaths);
    this.scene.add(this.drivingSystem.group);

    this.streetLife = new StreetLifeSystem(
      { minX: -750, maxX: 750, minZ: -750, maxZ: 750 },
      this.city.streetPaths,
    );
    this.scene.add(this.streetLife.group);

    // Ability system (Flock Frenzy, Poop Storm, Sonic Screech, etc.)
    this.abilityManager = new AbilityManager();
    this.abilityManager.initPools(this.scene);
    this.abilityManager.setPlayerLevel(this.progression.level);
    this.scene.add(this.abilityManager.group);

    // Wire flip callback for ability charge
    this.bird.controller.onFlipPerformed = (type: string, isDouble: boolean) => {
      this.abilityManager.addCharge(ABILITY_CHARGE.PER_FLIP * (isDouble ? 2 : 1));
      this.abilityManager.notifyPlayerFlip(type);
    };

    // UI
    this.hud = new HUD();
    this.coinPopups = new CoinPopupManager();
    this.coinPopups.setCamera(this.cameraController.camera);
    this.tutorial = new TutorialSystem();

    // If intro was already skipped (no suitable building found), dismiss the hook immediately
    if (!this.introPhase) {
      this.tutorial.dismissHook();
    }

    // Pause & Settings & Shop
    this.pauseMenu = new PauseMenu();
    this.settingsMenu = new SettingsMenu();
    this.shopMenu = new ShopMenu(this.cosmetics, this.progression, this.scoreSystem);

    // New UI components
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.minimap = new Minimap({
      worldSize: WORLD.CITY_SIZE,
    });
    this.minimap.setSanctuaryPosition(SANCTUARY.POSITION);
    this.leaderbird = new LeaderBird();
    this.achievementsPanel = new AchievementsPanel();
    this.keyboardHelper = new KeyboardHelper();

    // Speed effects overlay (speed lines, screen flash, danger vignette)
    this.speedEffects = new SpeedEffects();

    // PiP drop camera (shows NPC falling when dropped from height)
    this.dropCamera = new DropCamera();

    // Global chat UI
    this.chatUI = new ChatUI();

    // Share prompt for viral sharing moments
    this.sharePrompt = new SharePrompt();
    this.sharePrompt.setOnShare((text) => {
      const openShare = (window as any).__openSharePanel;
      if (typeof openShare === 'function') openShare(text);
    });

    this.pauseMenu.setCallbacks(
      () => this.resume(),
      () => { this.pauseMenu.hide(); this.shopMenu.show(); },
      () => { this.settingsMenu.show(); },
      () => { window.location.reload(); },
      () => { this.pauseMenu.hide(); this.resume(); this.murmurationPanel.show(); },
    );

    this.settingsMenu.setCallbacks(
      () => { this.settingsMenu.hide(); },
      (s) => this.applySettings(s),
      () => { this.tutorial.reset(); },
    );

    // Shop callbacks
    this.shopMenu.setPurchaseCallback((itemId) => this.handlePurchase(itemId));
    this.shopMenu.setEquipCallback((itemId) => this.handleEquip(itemId));

    // Apply default cosmetics
    this.bird.setColor(this.cosmetics.getBirdColor());

    // Cosmetics trail
    this.cosmetics.initTrail(this.scene);

    // VFX: Sanctuary shimmer
    this.vfx.createSanctuaryShimmer(12, 1, SANCTUARY.POSITION);

    // Initialize multiplayer if enabled
    const wsUrl = this.resolveMultiplayerUrl();
    if (wsUrl && this.multiplayerEnabled) {
      this.initMultiplayer(wsUrl);
    }

    // PvP system
    this.pvpManager = new PvPManager();
    this.pvpManager.registerMode(new PoopTagMode());
    this.pvpManager.registerMode(new RaceMode());
    this.pvpManager.registerMode(new PoopCoverMode());
    const heistMode = new HeistMode();
    heistMode.setCamera(this.cameraController.camera);
    this.pvpManager.registerMode(heistMode);
    this.pvpManager.init({
      scene: this.scene,
      bird: this.bird,
      collisionSystem: this.collisionSystem,
      poopManager: this.poopManager,
      flightRings: this.flightRings,
      multiplayer: this.multiplayer,
    });

    // Heist slam VFX/audio listener
    this.pvpManager.eventBus.on('score-update', (data: any) => {
      if (data?.type === 'heist-slam' && data.impactPoint) {
        const pos = new THREE.Vector3(data.impactPoint.x, data.impactPoint.y, data.impactPoint.z);
        this.vfx.spawnScatterBurst(pos, 40, 5);
        this.cameraEffects.triggerScreenShake(0.25);
        this.audio.playHit(30);
      }
      if (data?.type === 'heist-score') {
        this.audio.playBank();
      }
    });

    // Murmuration system (clan/group feature)
    this.murmurationSystem = new MurmurationSystem();
    this.mvmManager = new MvMPvPManager();
    this.murmurationPanel = new MurmurationPanel();

    // Resize
    window.addEventListener('resize', this.onResize);

    // Create FPS counter for performance monitoring
    this.createFPSCounter();

    // CRITICAL: Validate entire scene right after construction to prevent
    // "can't access property 'boundingSphere', geometry is undefined" crash
    this.validateSceneGeometries();
  }

  /**
   * Async initialization - loads persisted cosmetics and applies them
   * Call this after constructing Game instance
   */
  async init(): Promise<void> {
    // Load equipped cosmetics from persistence (Supabase or localStorage)
    const { loadEquippedCosmetics } = await import('./services/PersistenceService');
    const equipped = await loadEquippedCosmetics();

    // Apply loaded cosmetics
    this.cosmetics.equippedSkin = equipped.skin;
    this.cosmetics.equippedTrail = equipped.trail;
    this.cosmetics.equippedSplat = equipped.splat;

    // Apply visual changes
    this.bird.setColor(this.cosmetics.getBirdColor());

    // Reinitialize trail with loaded settings
    this.cosmetics.resetTrail(this.scene);

    console.log('✅ Cosmetics loaded:', equipped);
  }

  private async initMultiplayer(wsUrl: string): Promise<void> {
    try {
      this.multiplayer = new MultiplayerManager(this.scene, this.bird, wsUrl);

      // Wire chat: send messages through multiplayer
      this.chatUI.setOnSend((message) => {
        this.multiplayer?.sendChat(message);
      });

      // Wire chat: receive messages from server
      this.multiplayer.setEventCallbacks({
        onChatMessage: (data) => {
          this.chatUI.addMessage(data.username, data.message);
        },
      });

      // Use authenticated identity, and ensure guests get unique multiplayer IDs per tab.
      const { authStateManager } = await import('./services/AuthStateManager');
      const authState = authStateManager.getState();
      const rawUsername = (authState.username || '').trim();
      const safeUsername = rawUsername || ('Bird_' + Math.random().toString(36).substring(2, 6));

      const MP_SESSION_KEY = 'birdgame_mp_session';
      let sessionId = sessionStorage.getItem(MP_SESSION_KEY);
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2, 8);
        sessionStorage.setItem(MP_SESSION_KEY, sessionId);
      }

      // Always use per-tab multiplayer IDs so multiple windows can appear simultaneously.
      const baseId = authState.isAuthenticated && authState.userId
        ? authState.userId
        : ((authState.userId || '').trim().startsWith('guest_')
          ? (authState.userId || '').trim()
          : ('guest_' + Math.random().toString(36).substring(2, 11)));
      const playerId = `${baseId}_${sessionId}`;

      await this.multiplayer.connect(playerId, safeUsername);
      console.log('Multiplayer initialized as:', safeUsername);
    } catch (error) {
      console.error('Failed to initialize multiplayer:', error);
      this.multiplayer = null;
    }
  }


  private initAudio(): void {
    if (this.audioInitialized) return;
    this.audio.init();
    this.audioInitialized = true;
  }

  update(dt: number): void {
    // Update FPS counter
    this.updateFPS(dt);

    // Update camera effects (before time scaling)
    this.cameraEffects.update(dt);

    // Apply time scale for slow-mo effects
    dt = dt * this.cameraEffects.getTimeScale();

    // Init audio on first interaction
    if (!this.audioInitialized && this.input.isPointerLocked) {
      this.initAudio();
    }

    if (this.updateMenuToggles()) return;

    // --- Intro phase: bird perched on rooftop, "Drop it." prompt ---
    if (this.introPhase) {
      // Allow poop drop even during intro (bird is stationary)
      if (this.input.isPoop() && !this.firstDropDone) {
        this.firstDropDone = true;
        this.tutorial.hasDropped = true;
        this.tutorial.dismissHook();
        this.audio.playPoop();
        this.audio.playLaugh();

        // Spawn poop from stationary bird
        this.poopManager.update(dt, this.bird, this.input);

        // End intro after a brief moment
        setTimeout(() => {
          this.introPhase = false;
          this.bird.controller.forwardSpeed = FLIGHT.BASE_SPEED;
          this.cameraController.clearIntro();
        }, 800);
        return;
      }

      // Update NPCs even during intro so they're visible
      this.npcManager.update(dt, this.bird.controller.position);

      // Update poops in flight during intro (for the first drop)
      if (this.firstDropDone) {
        this.poopManager.update(dt, this.bird, this.input);
        this.collisionSystem.update(
          this.poopManager, this.npcManager, this.scoreSystem,
          this.playerState, this.coinPopups, this.bird, this.vfx, this.cameraController,
        );
      }
      this.sanctuary.update(dt);
      this.tutorial.update(dt);
      this.coinPopups.update(dt);
      this.cameraController.update(dt, this.bird, this.input);
      this.hud.update(
        this.scoreSystem, this.playerState, this.bird, this.poopManager,
        this.bankingSystem, this.progression, false, dt, this.city,
      );
      return;
    }

    // Emotes
    const emoteKey = this.input.getEmoteKey();
    if (emoteKey > 0) {
      const emote = this.emoteSystem.getEmoteFromKey(emoteKey);
      if (emote) {
        this.emoteSystem.triggerEmote(emote);
        this.audio.playEmote();
      }
    }
    this.emoteSystem.update(dt);

    // State machine tick
    this.playerState.update(dt);

    // Driving system — runs before bird movement to intercept controls
    const drivingResult = this.drivingSystem.update(dt, this.bird, this.input);
    if (drivingResult.entered) {
      this.playerState.enterDriving();
      this.cameraController.setDrivingMode(true);
      this.audio.playCarEnter();
    }
    if (drivingResult.exited) {
      this.playerState.exitDriving();
      this.cameraController.setDrivingMode(false);
      this.audio.playCarExit();
    }

    // Movement
    if (this.playerState.canMove) {
      this.bird.update(dt, this.input);

      // Tutorial: movement tracking
      if (this.input.getAxis('horizontal') !== 0 || this.input.getAxis('vertical') !== 0) {
        this.tutorial.hasMoved = true;
      }
      if (this.bird.controller.forwardSpeed > 5) {
        this.tutorial.hasFlown = true;
      }
    } else if (this.playerState.isDriving) {
      // While driving: DrivingSystem already moved bird controller position.
      // Just sync the bird mesh visuals (wings folded since isGrounded = true).
      this.bird.mesh.position.copy(this.bird.controller.position);
      this.bird.mesh.quaternion.copy(this.bird.controller.getQuaternion());
    }

    // Poop
    if (this.playerState.canDrop && this.input.isPoop()) {
      this.tutorial.hasDropped = true;
    }
    this.poopManager.update(dt, this.bird, this.input, this.grabSystem.getGrabbedNPC());

    // Audio (drop assist disabled - was causing annoying camera nudge)
    if (this.input.isPoop() && this.playerState.canDrop) {
      this.audio.playPoop();
      this.abilityManager.notifyPlayerPoop();
    }

    this.updateGrabSystem(dt);
    this.dropCamera.update(dt);

    // Hotspot
    this.hotspotSystem.update(dt);
    const inHotspot = this.hotspotSystem.isInsideHotspot(this.bird.controller.position);
    this.scoreSystem.inHotspot = inHotspot;

    // Collisions
    const prevCoins = this.scoreSystem.coins;
    this.collisionSystem.update(
      this.poopManager,
      this.npcManager,
      this.scoreSystem,
      this.playerState,
      this.coinPopups,
      this.bird,
      this.vfx,
      this.cameraController,
    );

    // Bird-body scatter: fly through NPCs to knock them around
    const scatterResult = this.collisionSystem.checkBirdScatter(
      this.bird, this.npcManager, this.vfx,
    );
    if (scatterResult.npcs.length > 0) {
      const count = scatterResult.npcs.length;
      const speed = this.bird.controller.forwardSpeed;

      // Small coin reward per NPC scattered
      let scatterCoins = count * NPC_CONFIG.SCATTER_COINS;

      // Cluster bonus for bowling through groups
      if (count >= NPC_CONFIG.SCATTER_CLUSTER_THRESHOLD) {
        scatterCoins += NPC_CONFIG.SCATTER_CLUSTER_BONUS;
        const label = count >= 5 ? 'BOWLING STRIKE!' : 'SCATTER!';
        this._tmpVec3A.copy(scatterResult.centerPos);
        this._tmpVec3A.y += 3;
        this.coinPopups.spawn(this._tmpVec3A, scatterCoins, 1.0, label);

        // Worm reward for scatter strikes
        this.scoreSystem.worms += ECONOMY.WORMS_PER_SCATTER_STRIKE;
      } else {
        this._tmpVec3A.copy(scatterResult.centerPos);
        this._tmpVec3A.y += 2;
        this.coinPopups.spawn(this._tmpVec3A, scatterCoins, 1.0);
      }

      this.scoreSystem.coins += scatterCoins;

      // Swoosh audio — quick ascending tone
      this.audio.playScatter(speed, count);

      // Camera shake scales with count and speed
      const shakeIntensity = 0.04 + count * 0.03 + (speed / 80) * 0.05;
      this.cameraController.triggerShake(Math.min(shakeIntensity, 0.3), 0.12);

      // Alert nearby NPCs to flee from the scatter point
      this.npcManager.alertNearby(scatterResult.centerPos);
    }

    // Audio + progression: hit detection
    if (this.scoreSystem.coins > prevCoins) {
      // IMPROVEMENT #4: Momentum-based hit audio
      const speed = this.bird.controller.forwardSpeed;
      const altitude = this.bird.controller.position.y;
      const momentumFactor = (speed / 80) * 0.7 + (altitude / 100) * 0.3;
      this.audio.playHit(momentumFactor);
      this.tutorial.hasHitNPC = true;
      this.progression.recordHit(this.scoreSystem.lastHitNPCType || undefined);
      this.progression.recordStreak(this.scoreSystem.streak);

      // Combo system
      const currentTime = performance.now() / 1000;
      this.comboSystem.onHit(currentTime);

      // Mission system
      this.missionSystem.recordHit(this.scoreSystem.lastHitNPCType || undefined);
      this.missionSystem.recordStreak(this.scoreSystem.streak);

      // Impact cam & screen shake on big hits
      const hitValue = this.scoreSystem.lastHitPoints;
      this.cameraEffects.triggerImpactCam(hitValue);
      this.cameraEffects.triggerScreenShake(Math.min(hitValue / 20, 2));

      // Screen flash on significant hits
      if (hitValue >= 15) {
        this.speedEffects.triggerFlash(Math.min(hitValue / 40, 1), hitValue >= 30 ? 'gold' : 'white');
      }

      // Achievement checks on hit
      this.checkAchievements();

      // Ability charge from NPC hits
      this.abilityManager.addCharge(ABILITY_CHARGE.PER_NPC_HIT);
    }

    // Update combo system and apply bonuses
    const currentTime = performance.now() / 1000;
    this.comboSystem.update(dt, this.scoreSystem.streak, currentTime);
    this.scoreSystem.comboBonus = this.comboSystem.getBonusMultiplier();

    // Update mission system
    this.missionSystem.update(dt);

    // Heat changes
    this.scoreSystem.update(dt);

    this.sanctuary.update(dt);

    // Banking
    if (this.playerState.state === 'NORMAL' || this.playerState.state === 'SANCTUARY' || this.playerState.state === 'BANKING') {
      this.bankingSystem.update(dt, this.bird, this.sanctuary, this.scoreSystem, this.playerState);

      if (this.bankingSystem.isComplete && this.playerState.state === 'BANKING') {
        const amount = this.scoreSystem.bank();
        if (amount > 0) {
          const xpGained = Math.floor(amount / 5);
          const levelsGained = this.progression.addXP(xpGained);
          this.progression.recordBank(amount);
          this.missionSystem.recordBank(amount);
          this.hud.showBankMessage(amount, xpGained);
          this.audio.playBankingSuccess();
          this.vfx.spawnBankingBurst(this.bird.controller.position, amount);
          this.tutorial.hasBanked = true;

          // Award feathers for big banks (500+)
          if (amount >= ECONOMY.MEGA_BANK_THRESHOLD) {
            this.progression.feathers += ECONOMY.FEATHERS_PER_MEGA_BANK;
            this.progression.goldenEggs += ECONOMY.GOLDEN_EGGS_PER_MEGA_BANK;
          } else if (amount >= ECONOMY.BIG_BANK_THRESHOLD) {
            this.progression.feathers += ECONOMY.FEATHERS_PER_BIG_BANK;
          }

          // Murmuration Formation XP: 10% of banked coins
          this.murmurationSystem.onCoinsBanked(amount);

          if (levelsGained > 0) {
            this.hud.showLevelUp(this.progression.level);
            this.audio.playLevelUp();
            if (this.progression.level >= 5) {
              this.sharePrompt.prompt({ type: 'level', level: this.progression.level });
            }

            // Murmuration Formation XP: +200 per level-up
            this.murmurationSystem.onLevelUp();
          }

          // Share prompt for significant banks (50+ coins)
          if (amount >= 50) {
            this.sharePrompt.prompt({ type: 'banking', amount });
          }

          // Check challenges
          for (const c of [...this.progression.dailyChallenges, ...this.progression.weeklyChallenges]) {
            if (c.completed) {
              this.hud.showChallengeComplete(c.description);
            }
          }

          // Achievement checks after banking
          this.checkAchievements();

          // Save game state and leaderbird run after every bank.
          void (async () => {
            await this.saveState();
            this.saveLeaderBirdRun();
          })();
        }
        this.playerState.completeBanking();
        this.bankingSystem.reset();
      }
    }

    // Grounding check (with altitude warning + grace period)
    this.checkGrounding(dt);

    // Respawn teleport — safe perch selection
    if (this.playerState.state === 'SPAWN_SHIELD') {
      if (this.bird.controller.position.y < 40) {
        const perch = this.pickSafeRespawn();
        this.bird.controller.position.copy(perch);
        this.bird.controller.pitchAngle = 0;
        this.bird.controller.forwardSpeed = FLIGHT.BASE_SPEED;
      }
    }

    // Tutorial: heat threshold (spec says Heat 5)
    if (this.scoreSystem.heat >= 5) {
      this.tutorial.hasReachedHighHeat = true;
    }

    // Tutorial
    this.tutorial.update(dt);

    // Camera
    this.cameraController.update(dt, this.bird, this.input);

    // Apply camera effects (shake and zoom from impacts)
    const shakeOffset = this.cameraEffects.getShakeOffset();
    const impactZoom = this.cameraEffects.getImpactCamZoom();
    this.cameraController.camera.position.add(shakeOffset);
    // Apply slight zoom-in during impact cam
    if (impactZoom > 0) {
      this._tmpVec3A.subVectors(this.bird.controller.position, this.cameraController.camera.position).normalize();
      this.cameraController.camera.position.addScaledVector(this._tmpVec3A, impactZoom);
    }

    // Cosmetics trail
    this.cosmetics.updateTrail(this.bird.controller.position);

    // VFX
    this.vfx.update(dt);

    // Coin popups
    this.coinPopups.update(dt);

    this.updateWorldSystems(dt);

    this.updateAbilities(dt);

    // PvP system
    this.pvpManager.updateLocalPlayerPosition(this.bird.controller.position);
    if (this.pvpManager.isInRound()) {
      const roundState = this.pvpManager.getRoundState();
      const poops = this.poopManager.getActivePoops();

      // Poop Tag: check poop-vs-PvP-player hits
      if (roundState.mode === 'poop-tag' && roundState.phase === 'active') {
        const pvpHits = this.collisionSystem.checkPvPPoopHits(
          poops, 'local', roundState.players,
        );
        for (const hit of pvpHits) {
          this.pvpManager.onPoopHitPlayer(hit.shooterId, hit.targetId);
          this.poopManager.spawnImpact(hit.position);
        }
      }

      // Poop Cover: check poop-vs-statue hits
      if (roundState.mode === 'poop-cover' && roundState.phase === 'active') {
        const statuePos = roundState.modeData?.statuePosition;
        if (statuePos) {
          this._tmpVec3A.set(statuePos.x, statuePos.y, statuePos.z);
          const statueHits = this.collisionSystem.checkPvPStatueHits(
            poops, 'local', this._tmpVec3A,
          );
          for (const hit of statueHits) {
            this.pvpManager.onPoopHitStatue(hit.playerId, hit.accuracy, hit.position);
            this.poopManager.spawnImpact(hit.position);
          }
        }
      }

      // Poop Tag: update tagged visuals on entities
      if (roundState.mode === 'poop-tag') {
        const taggedId = roundState.modeData?.taggedPlayerId;
        const localId = roundState.modeData?.localPlayerId;
        const isLocalTagged = taggedId === localId;

        this.bird.setTagged(isLocalTagged);

        if (this.multiplayer) {
          for (const rp of this.multiplayer.getRemotePlayers()) {
            rp.setTagged(rp.id === taggedId);
          }
        }

        this.minimap.setTaggedPlayer(taggedId, isLocalTagged);
      }

      // Heist: feed flight speed and update minimap, manage player state
      if (roundState.mode === 'heist' && roundState.phase === 'active') {
        const activeMode = this.pvpManager.getCurrentMode();
        if (activeMode && 'setLocalFlightSpeed' in activeMode) {
          (activeMode as HeistMode).setLocalFlightSpeed(this.bird.controller.forwardSpeed);
        }

        // Enter HEIST player state (disables pooping, abilities, NPC interaction)
        if (!this.playerState.inHeist) {
          this.playerState.enterHeist();
        }

        // Update minimap with heist data
        const modeData = roundState.modeData;
        if (modeData) {
          this.minimap.setHeistActive(true, 'local');
          this.minimap.setHeistTrophy(
            modeData.trophyPosition ? { x: modeData.trophyPosition.x, z: modeData.trophyPosition.z } : null,
            modeData.carrierId,
          );
          if (modeData.pedestals) {
            this.minimap.setHeistPedestals(modeData.pedestals);
          }
        }

        // Trigger VFX and audio on slam events via event bus
        // (HeistMode emits 'score-update' events with type 'heist-slam')
      }
    } else {
      // Not in a PvP round — clear tagged state
      this.bird.setTagged(false);
      this.minimap.setTaggedPlayer(null, false);

      // Exit HEIST state if active
      if (this.playerState.inHeist) {
        this.playerState.exitHeist();
        this.minimap.setHeistActive(false);
      }
    }
    this.pvpManager.update(dt);

    // Murmuration & MvM updates
    this.murmurationSystem.update(dt);
    this.mvmManager.update(dt);

    // Multiplayer updates
    if (this.multiplayer && this.multiplayer.isConnected()) {
      this.multiplayer.update(dt);

      // Send player position every 50ms (20 updates/sec)
      if (this.playerState.canMove) {
        this.multiplayer.sendPlayerUpdate();
      }
    }

    // Audio wind
    this.audio.updateWind(this.bird.controller.forwardSpeed, this.bird.controller.position.y);

    // IMPROVEMENT #6: Ground proximity audio
    this.audio.updateGroundRush(this.bird.controller.position.y, this.bird.controller.forwardSpeed);

    // Ambient city volume (louder at low altitude)
    this.audio.updateAmbientCity(this.bird.controller.position.y);

    // Adaptive music intensity: ramps up with streak, combo, and speed
    {
      const streakFactor = Math.min(this.scoreSystem.streak / 8, 0.5);
      const comboFactor = this.comboSystem.getBonusMultiplier() > 1 ? 0.3 : 0;
      const speedFactor = Math.max(0, (this.bird.controller.forwardSpeed - 40) / 60) * 0.2;
      this.audio.setMusicIntensity(streakFactor + comboFactor + speedFactor);
    }

    // Speed effects overlay (speed lines, screen flash, danger vignette)
    this.speedEffects.update(
      dt,
      this.bird.controller.forwardSpeed,
      FLIGHT.DIVE_SPEED,
      this.bird.controller.isDiving,
      this.bird.controller.isBoosting,
    );

    // Danger vignette when low with coins
    {
      const alt = this.bird.controller.position.y;
      const hasCoins = this.scoreSystem.coins > 0;
      if (hasCoins && this.playerState.canBeGrounded && alt <= ALTITUDE_WARNING.DANGER_ALTITUDE) {
        const danger = 1 - (alt - SCORE.GROUNDING_ALTITUDE) / (ALTITUDE_WARNING.DANGER_ALTITUDE - SCORE.GROUNDING_ALTITUDE);
        this.speedEffects.setDangerVignette(Math.max(0, Math.min(0.6, danger * 0.6)));
      } else {
        this.speedEffects.setDangerVignette(0);
      }
    }

    // Progression distance
    this.progression.recordDistance(this.bird.controller.forwardSpeed * dt);

    this.updateHUD(dt, inHotspot);

    this.updateCulling();

    // Update shadow map periodically (not every frame) and follow the player.
    // Sun direction is managed by TimeWeatherSystem (relative to target),
    // so we only update the target position here — no sun.position override.
    if (this.frameCount % 10 === 0) {
      const playerPos = this.bird.controller.position;
      this.sun.target.position.copy(playerPos);
      this.sun.target.updateMatrixWorld();
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  /** Handle pause, shop, leaderbird, achievements, minimap, and keyboard helper toggles. Returns true if update should bail. */
  private updateMenuToggles(): boolean {
    if (this.input.wasPausePressed()) {
      if (this.settingsMenu.isVisible) {
        this.settingsMenu.hide();
      } else if (this.shopMenu.visible) {
        this.shopMenu.hide();
      } else if (this.leaderbird.isVisible) {
        this.leaderbird.hide();
      } else if (this.achievementsPanel.isVisible) {
        this.achievementsPanel.hide();
      } else if (this.paused) {
        // If in fullscreen, exit fullscreen first instead of resuming
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          this.resume();
        }
      } else {
        this.pause();
      }
    }

    if (this.input.wasPressed('KeyB') && !this.paused && !this.settingsMenu.isVisible) {
      this.shopMenu.toggle();
    }
    if (this.input.wasPressed('KeyL') && !this.paused && !this.settingsMenu.isVisible && !this.shopMenu.visible) {
      this.leaderbird.isVisible ? this.leaderbird.hide() : this.leaderbird.show();
    }
    if (this.input.wasPressed('KeyH') && !this.paused && !this.settingsMenu.isVisible && !this.shopMenu.visible) {
      this.achievementsPanel.isVisible ? this.achievementsPanel.hide() : this.achievementsPanel.show();
    }
    if (this.input.wasPressed('KeyM')) this.minimap.toggle();
    if (this.input.wasPressed('KeyP') && !this.paused && !this.settingsMenu.isVisible && !this.shopMenu.visible) this.pvpManager.toggleHub();
    if (this.input.wasPressed('KeyG') && !this.paused && !this.settingsMenu.isVisible && !this.shopMenu.visible) {
      this.murmurationPanel.isVisible ? this.murmurationPanel.hide() : this.murmurationPanel.show();
    }
    if (this.input.wasPressed('F1')) this.keyboardHelper.toggle();

    return this.paused || this.shopMenu.visible || this.chatUI.isActive() || this.murmurationPanel.isVisible;
  }

  /** Talon grab: input handling, pet/NPC pickup & release, weight penalty, NPC despawn safety. */
  private updateGrabSystem(dt: number): void {
    if (this.input.wasRightMouseClicked()) {
      if (this.grabSystem.isCarrying()) {
        if (this.grabSystem.isCarryingPet()) {
          const result = this.grabSystem.tryReleasePet(this.bird.controller);
          if (result === 'placed') {
            const pet = this.grabSystem.releasePet();
            if (pet) {
              this.streetLife.placeAnimal(pet, this.bird.controller.position);
              this.hud.hidePetWarning();
              this.audio.playHit();
            }
          } else {
            const petType = this.grabSystem.getCarriedPetType();
            if (petType) {
              this.hud.showPetWarning(petType, true);
              this.cameraController.triggerShake(0.08, 0.15);
            }
          }
        } else {
          // Capture NPC ref before release() nulls it (needed for drop cam tracking)
          const npcToTrack = this.grabSystem.getGrabbedNPC();
          const throwResult = this.grabSystem.release(this.bird.controller);
          this.audio.playPoop();
          if (throwResult) {
            const { coins, heat, multiplierBonus, npcType, throwPos, heightBonus } = throwResult;
            if (multiplierBonus > 0) this.scoreSystem.multiplier += multiplierBonus;
            // Apply height bonus to coin value before scoring
            const boostedCoins = Math.floor(coins * heightBonus);
            this.scoreSystem.onHitWithValues(boostedCoins, heat, npcType);
            this._tmpVec3A.copy(throwPos);
            this._tmpVec3A.y += 2;
            const popupPos = this._tmpVec3A;
            const label = heightBonus > 1.01 ? `HEIGHT DROP x${heightBonus.toFixed(1)}` : undefined;
            this.coinPopups.spawn(popupPos, this.scoreSystem.lastHitPoints, this.scoreSystem.lastHitMultiplier, label);
            this.vfx.spawnBankingBurst(throwPos, 15);
            // Bigger shake for high drops
            const shakeIntensity = heightBonus > 1.5 ? 0.25 : 0.15;
            this.cameraController.triggerShake(shakeIntensity, 0.2);

            // PiP drop camera: show the NPC falling from dramatic heights
            if (throwPos.y >= DropCamera.MIN_HEIGHT && npcToTrack) {
              this._tmpVec3B.copy(this.bird.controller.getForward());
              this.dropCamera.activate(npcToTrack, this._tmpVec3B, throwPos.y);
            }
          }
        }
      } else {
        const targetNPC = this.grabSystem.canGrab(this.bird.controller.position, this.npcManager, this.bird.controller.getForward());
        if (targetNPC) {
          this.grabSystem.grab(targetNPC);
          this.audio.playHit();
          this.vfx.spawnBankingBurst(targetNPC.mesh.position, 10);
        } else {
          const targetAnimal = this.grabSystem.canGrabAnimal(
            this.bird.controller.position,
            this.streetLife.getAnimals(),
            this.bird.controller.getForward(),
          );
          if (targetAnimal) {
            this.grabSystem.grabAnimal(targetAnimal);
            this.audio.playHit();
            this.vfx.spawnBankingBurst(targetAnimal.mesh.position, 8);
          }
        }
      }
    }

    const wasPetWarning = this.grabSystem.petWarningActive;
    this.grabSystem.update(dt, this.bird.controller);

    if (this.grabSystem.petWarningActive && !wasPetWarning) {
      const petType = this.grabSystem.getCarriedPetType();
      if (petType) this.hud.showPetWarning(petType, false);
    }
    if (!this.grabSystem.petWarningActive && wasPetWarning) {
      this.hud.hidePetWarning();
    }

    if (this.grabSystem.isCarrying()) {
      this.bird.controller.forwardSpeed *= this.grabSystem.getSpeedMultiplier();
    }

    this.npcManager.update(dt, this.bird.controller.position);

    const grabbedNPC = this.grabSystem.getGrabbedNPC();
    if (grabbedNPC && (grabbedNPC.shouldDespawn || !this.npcManager.npcs.includes(grabbedNPC))) {
      this.grabSystem.forceRelease();
    }
  }

  /** Flight rings, collectibles, thermals, weather, clouds, traffic, vehicles, street life, world poop hits. */
  private updateWorldSystems(dt: number): void {
    this.flightRings.update(dt);
    this.flightRings.checkCollision(this.bird.controller.position, (reward) => {
      this.scoreSystem.coins += reward;
      this.scoreSystem.worms += ECONOMY.WORMS_PER_RING_CHAIN;
      this.coinPopups.spawn(this.bird.controller.position, reward, 1.0);
      this.audio.playHit();
      this.missionSystem.recordRingCollection();
    });

    this.collectibles.update(dt, this.bird.controller.position);
    this.collectibles.checkFeatherCollection(this.bird.controller.position, (coins, feathers) => {
      this.scoreSystem.coins += coins;
      this.progression.feathers += feathers;
      this.coinPopups.spawn(this.bird.controller.position, coins, 1.5);
      this.audio.playHit();
      console.log(`✨ Golden Feather! +${coins} coins, +${feathers} feathers`);
    });
    this.collectibles.checkBalloonCollection(this.bird.controller.position, (coins) => {
      this.scoreSystem.coins += coins;
      this.scoreSystem.worms += ECONOMY.WORMS_PER_BALLOON;
      this.coinPopups.spawn(this.bird.controller.position, coins, 1.0);
      this.audio.playHit();
    });

    const thermal = this.collectibles.checkThermalUpdraft(this.bird.controller.position);
    if (thermal.lift > 0) {
      this.bird.controller.position.y += thermal.lift * dt;
      const spiralBankTarget = thermal.spiralStrength * FLIGHT.MAX_BANK_ANGLE * 0.6;
      const currentRoll = this.bird.controller.rollAngle;
      this.bird.controller.rollAngle += (spiralBankTarget - currentRoll) * 2.0 * dt;
    }

    this.timeWeather.update(dt, this.bird.controller.position);
    const wind = this.timeWeather.getWindEffect();
    if (wind.strength > 0) {
      this.bird.controller.position.x += Math.cos(wind.direction) * wind.strength * dt;
      this.bird.controller.position.z += Math.sin(wind.direction) * wind.strength * dt;
    }

    this.clouds.update(dt, this.bird.controller.position);
    this.gameElapsed += dt;
    this.ocean.update(this.gameElapsed);
    this.airTraffic.update(dt, this.bird.controller.position, this.scoreSystem.isWanted);
    this.vehicleSystem.update(dt, this.bird.controller.position);
    this.streetLife.update(dt, this.bird.controller.position);

    // Poop vs vehicles, food carts, and drones
    const activePoops = this.poopManager.getActivePoops();

    this.vehicleSystem.checkPoopHits(activePoops, (result) => {
      this.scoreSystem.onHitWithValues(result.coins, result.heat, 'tourist');
      this.scoreSystem.worms += ECONOMY.WORMS_PER_DRIVING_HIT;
      this._tmpVec3A.copy(result.position);
      this._tmpVec3A.y += 3;
      this.coinPopups.spawn(this._tmpVec3A, result.coins, 1.0);
      this.audio.playHit();
      this.streetLife.scarePigeonsNear(result.position);
      this.abilityManager.addCharge(ABILITY_CHARGE.PER_VEHICLE_HIT);
    });

    this.streetLife.checkPoopHits(activePoops, (result) => {
      this.scoreSystem.onHitWithValues(result.coins, result.heat, 'tourist');
      this._tmpVec3A.copy(result.position);
      this._tmpVec3A.y += 4;
      this.coinPopups.spawn(this._tmpVec3A, result.coins, 1.2);
      this.audio.playHit();
      this.abilityManager.addCharge(ABILITY_CHARGE.PER_VEHICLE_HIT);
    });

    this.airTraffic.checkDroneHits(activePoops, (result) => {
      this.scoreSystem.onHitWithValues(result.coins, result.heat, 'tourist');
      this.scoreSystem.worms += ECONOMY.WORMS_PER_DRONE;
      this._tmpVec3A.copy(result.position);
      this._tmpVec3A.y += 2;
      this.coinPopups.spawn(this._tmpVec3A, result.coins, 1.5);
      this.audio.playHit();
      this.abilityManager.addCharge(ABILITY_CHARGE.PER_VEHICLE_HIT);
    });
  }

  /** Ability activation, cycling, update, coin multiplier, and ability-poop collisions. */
  private updateAbilities(dt: number): void {
    if (this.input.wasAbilityPressed()) {
      const ctrl = this.bird.controller;
      const activated = this.abilityManager.tryActivate({
        playerPosition: ctrl.position,
        playerForward: ctrl.getForward(),
        playerSpeed: ctrl.forwardSpeed,
        playerPitch: ctrl.pitchAngle,
        playerRoll: ctrl.rollAngle,
        playerAltitude: ctrl.position.y,
        scene: this.scene,
      });
      if (activated) {
        this.vfx.spawnBankingBurst(ctrl.position, 50);
        this.cameraController.triggerShake(0.3, 0.3);
        this.audio.playLevelUp();
      }
    }

    if (this.input.wasAbilityCyclePressed()) {
      this.abilityManager.cycleAbility(1);
    }

    this.abilityManager.notifyPlayerDive(this.bird.controller.isDiving);

    {
      const ctrl = this.bird.controller;
      this.abilityManager.update(dt, {
        playerPosition: ctrl.position,
        playerForward: ctrl.getForward(),
        playerSpeed: ctrl.forwardSpeed,
        playerPitch: ctrl.pitchAngle,
        playerRoll: ctrl.rollAngle,
        playerAltitude: ctrl.position.y,
        scene: this.scene,
      });
    }

    this.abilityManager.setPlayerLevel(this.progression.level);
    this.scoreSystem.comboBonus *= this.abilityManager.getCoinMultiplier();

    // Ability poop collisions vs world targets
    const abilityPoops = this.abilityManager.getAllActivePoops();
    if (abilityPoops.length > 0) {
      const scale = 0.5;

      this.vehicleSystem.checkPoopHits(abilityPoops, (result) => {
        this.scoreSystem.onHitWithValues(Math.round(result.coins * scale), result.heat, 'tourist');
        this._tmpVec3A.copy(result.position); this._tmpVec3A.y += 3;
        this.coinPopups.spawn(this._tmpVec3A, Math.round(result.coins * scale), 1.0);
        this.audio.playHit();
        this.abilityManager.addCharge(ABILITY_CHARGE.PER_VEHICLE_HIT * 0.5);
      });

      this.streetLife.checkPoopHits(abilityPoops, (result) => {
        this.scoreSystem.onHitWithValues(Math.round(result.coins * scale), result.heat, 'tourist');
        this._tmpVec3A.copy(result.position); this._tmpVec3A.y += 4;
        this.coinPopups.spawn(this._tmpVec3A, Math.round(result.coins * scale), 1.0);
        this.audio.playHit();
      });

      this.airTraffic.checkDroneHits(abilityPoops, (result) => {
        this.scoreSystem.onHitWithValues(Math.round(result.coins * scale), result.heat, 'tourist');
        this._tmpVec3A.copy(result.position); this._tmpVec3A.y += 2;
        this.coinPopups.spawn(this._tmpVec3A, Math.round(result.coins * scale), 1.0);
        this.audio.playHit();
      });

      for (const poop of abilityPoops) {
        const poopPos = poop.mesh.position;
        for (const npc of this.npcManager.npcs) {
          if (npc.isHit || npc.isGrabbed || npc.shouldDespawn) continue;
          const distSq = poopPos.distanceToSquared(npc.mesh.position);
          if (distSq < (npc.boundingRadius + 0.3) ** 2) {
            this._tmpVec3A.copy(npc.mesh.position); this._tmpVec3A.y += 2;
            const hitPos = this._tmpVec3A;
            this._tmpVec3B.copy(poop.mesh.position);
            const impactPos = this._tmpVec3B;
            const hitResult = npc.onHit();
            poop.kill();
            this.poopManager.spawnImpact(impactPos);
            this.poopManager.spawnSplatDecal(impactPos);
            this.npcManager.alertNearby(impactPos);
            this.scoreSystem.onHitWithValues(Math.round(hitResult.coins * scale), hitResult.heat, npc.npcType);
            this.coinPopups.spawn(hitPos, this.scoreSystem.lastHitPoints, this.scoreSystem.lastHitMultiplier);
            this.audio.playHit();
            this.abilityManager.addCharge(ABILITY_CHARGE.PER_NPC_HIT * 0.5);
            break;
          }
        }
      }
    }
  }

  /** Minimap, HUD, combo announcer, mission objective UI. */
  private updateHUD(dt: number, inHotspot: boolean): void {
    this.minimap.setPlayerPosition(this.bird.controller.position);
    this.minimap.setHotspots(this.hotspotSystem.getPositions());
    if (this.multiplayer && this.multiplayer.isConnected()) {
      const remotePlayers = this.multiplayer.getRemotePlayers().map(rp => ({
        position: rp.getPosition(),
        username: rp.username,
        id: rp.id,
      }));
      this.minimap.setOtherPlayers(remotePlayers);
    }
    this.minimap.update();

    this.hud.update(
      this.scoreSystem, this.playerState, this.bird, this.poopManager,
      this.bankingSystem, this.progression, inHotspot, dt, this.city,
      this.abilityManager,
    );

    // Driving HUD: enter prompt + speedometer
    if (this.drivingSystem.isNearCar && this.playerState.state === 'NORMAL') {
      this.hud.showDrivingPrompt(this.drivingSystem.promptText);
    } else {
      this.hud.hideDrivingPrompt();
    }
    const activeDrivingCar = this.drivingSystem.getActiveCar();
    if (this.playerState.isDriving && activeDrivingCar) {
      this.hud.updateDrivingHUD(activeDrivingCar.speed);
    } else {
      this.hud.hideDrivingHUD();
    }

    const tierInfo = this.comboSystem.getCurrentTierInfo();
    this.hud.updateComboAnnouncer(
      this.comboSystem.announcerText, this.comboSystem.announcerColor,
      this.comboSystem.announcerOpacity, this.comboSystem.announcerScale,
    );
    this.hud.updateStreakCounter(this.scoreSystem.streak, tierInfo.color, tierInfo.glowIntensity);

    const activeMission = this.missionSystem.getActiveMission();
    if (activeMission) {
      this.hud.updateMissionObjective(
        activeMission.title, activeMission.description,
        activeMission.current, activeMission.target, this.missionSystem.getProgress(),
      );
    } else {
      this.hud.updateMissionObjective('', '', 0, 0, 0);
    }
    this.hud.updateMissionCompleted(
      this.missionSystem.missionCompletedText, this.missionSystem.missionCompletedOpacity,
    );
  }

  private updateCulling(): void {
    this.cameraController.camera.updateMatrixWorld();
    this.projScreenMatrix.multiplyMatrices(
      this.cameraController.camera.projectionMatrix,
      this.cameraController.camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const SHADOW_DISTANCE_SQ = 200 * 200;
    const BUILDING_VISIBLE_DISTANCE_SQ = 650 * 650;
    const playerPos = this.bird.controller.position;

    for (const building of this.city.buildings) {
      if (building.mesh) {
        this._cullSphere.set(building.mesh.position, building.cullRadius);
        const dx = building.mesh.position.x - playerPos.x;
        const dy = building.mesh.position.y - playerPos.y;
        const dz = building.mesh.position.z - playerPos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        building.mesh.visible =
          distSq < BUILDING_VISIBLE_DISTANCE_SQ &&
          this.frustum.intersectsSphere(this._cullSphere);

        if (building.mesh.visible) {
          building.mesh.castShadow = distSq < SHADOW_DISTANCE_SQ;
        } else {
          building.mesh.castShadow = false;
        }
      }
    }
  }

  private checkGrounding(dt: number): void {
    const pos = this.bird.controller.position;
    const hasCoins = this.scoreSystem.coins > 0;
    const canBeGrounded = this.playerState.canBeGrounded;

    // --- Altitude warning (shown when carrying coins near ground) ---
    if (hasCoins && canBeGrounded && pos.y <= ALTITUDE_WARNING.CRITICAL_ALTITUDE) {
      this.hud.updateAltitudeWarning('critical');
    } else if (hasCoins && canBeGrounded && pos.y <= ALTITUDE_WARNING.DANGER_ALTITUDE) {
      this.hud.updateAltitudeWarning('danger');
    } else {
      this.hud.updateAltitudeWarning('none');
    }

    // --- Grounding with grace period ---
    if (canBeGrounded && hasCoins && pos.y <= SCORE.GROUNDING_ALTITUDE) {
      this.groundingGraceTimer += dt;

      if (this.groundingGraceTimer >= ALTITUDE_WARNING.GRACE_PERIOD) {
        this.lastGroundingPos.copy(pos);
        const lost = this.scoreSystem.onGrounded();
        if (lost > 0) {
          this.hud.showGroundedMessage(lost);
          this.audio.playGrounded();
          this.vfx.spawnGroundedShockRing(pos);
          this.speedEffects.triggerFlash(0.7, 'red');
          this.progression.recordGrounding();
        }
        this.playerState.triggerGrounding();
        this.groundingGraceTimer = 0;
      }
    } else {
      this.groundingGraceTimer = 0;
    }
  }

  /** Collect building rooftops at city edges for safe respawn. */
  private computeSpawnPerches(buildings: BuildingData[]): void {
    const edgeMargin = 30;
    const halfSize = WORLD.CITY_SIZE / 2;

    for (const b of buildings) {
      const pos = b.position;
      const isEdge =
        Math.abs(pos.x) > halfSize - edgeMargin ||
        Math.abs(pos.z) > halfSize - edgeMargin;
      if (!isEdge) continue;

      // Not too close to sanctuary
      const dx = pos.x - SANCTUARY.POSITION.x;
      const dz = pos.z - SANCTUARY.POSITION.z;
      if (Math.sqrt(dx * dx + dz * dz) < 50) continue;

      // Must be tall enough to fly from
      if (b.height < 8) continue;

      this.spawnPerches.push(new THREE.Vector3(pos.x, b.height + 1, pos.z));
    }

    // Fallback if no edge buildings found
    if (this.spawnPerches.length === 0) {
      this.spawnPerches.push(new THREE.Vector3(0, 50, 0));
    }
  }

  /** Place bird on a building near Sanctuary for the intro. */
  private setupFirstSpawn(buildings: BuildingData[]): void {
    // Find a nearby downtown building (not right on top of Sanctuary)
    let bestBuilding: BuildingData | null = null;
    let bestDist = Infinity;

    for (const b of buildings) {
      const dx = b.position.x - SANCTUARY.POSITION.x;
      const dz = b.position.z - SANCTUARY.POSITION.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Between 15-40 units from Sanctuary, prefer tall ones
      if (dist > 15 && dist < 40 && b.height > 15 && dist < bestDist) {
        bestDist = dist;
        bestBuilding = b;
      }
    }

    if (bestBuilding) {
      const perchY = bestBuilding.height + 1;
      this.bird.controller.position.set(
        bestBuilding.position.x,
        perchY,
        bestBuilding.position.z,
      );
      this.bird.controller.forwardSpeed = 0;
      // Face toward Sanctuary
      this.bird.controller.yawAngle = Math.atan2(
        -(SANCTUARY.POSITION.x - bestBuilding.position.x),
        -(SANCTUARY.POSITION.z - bestBuilding.position.z),
      );

      // Intro camera: above and behind bird, looking down at street
      const camPos = new THREE.Vector3(
        bestBuilding.position.x,
        perchY + 8,
        bestBuilding.position.z + 15,
      );
      const lookAt = new THREE.Vector3(
        bestBuilding.position.x,
        0,
        bestBuilding.position.z - 10,
      );
      this.cameraController.setIntro(camPos, lookAt);
    } else {
      // Fallback: no intro
      this.introPhase = false;
    }
  }

  /** Pick the safe respawn perch farthest from the grounding position. */
  private pickSafeRespawn(): THREE.Vector3 {
    const hotspotPositions = this.hotspotSystem.getPositions();
    let bestPerch = this.spawnPerches[0];
    let bestDist = -1;

    for (const perch of this.spawnPerches) {
      // Skip perches inside active hotspots
      let inHotspot = false;
      for (const hp of hotspotPositions) {
        const dx = perch.x - hp.x;
        const dz = perch.z - hp.z;
        if (Math.sqrt(dx * dx + dz * dz) < 40) {
          inHotspot = true;
          break;
        }
      }
      if (inHotspot) continue;

      // Skip perches too close to Sanctuary
      const dsx = perch.x - SANCTUARY.POSITION.x;
      const dsz = perch.z - SANCTUARY.POSITION.z;
      if (Math.sqrt(dsx * dsx + dsz * dsz) < SANCTUARY.BANK_RADIUS + 10) continue;

      const dist = perch.distanceTo(this.lastGroundingPos);
      if (dist > bestDist) {
        bestDist = dist;
        bestPerch = perch;
      }
    }

    return bestPerch;
  }

  private validateSceneGeometries(): void {
    // Validate ALL renderable objects in the scene have valid geometries
    // This prevents "can't access property 'boundingSphere', geometry is undefined" errors
    // Covers: Mesh, Line, LineSegments, LineLoop, Points, SkinnedMesh, InstancedMesh
    let removedCount = 0;
    let fixedCount = 0;
    const toRemove: THREE.Object3D[] = [];

    this.scene.traverse((object) => {
      // Check any object that has a geometry property (Mesh, Line, Points, etc.)
      const obj = object as any;
      if ('geometry' in obj && obj.isMesh || obj.isLine || obj.isLineSegments || obj.isPoints) {
        if (!obj.geometry) {
          console.warn('⚠️ Found object without geometry:', object.type, object.name || 'unnamed');
          toRemove.push(object);
          removedCount++;
        } else {
          try {
            if (!obj.geometry.boundingSphere) {
              obj.geometry.computeBoundingSphere();
              fixedCount++;
            }
            if (!obj.geometry.boundingBox) {
              obj.geometry.computeBoundingBox();
            }
          } catch (error) {
            console.error('❌ Error computing bounding volumes:', object.type, object.name || 'unnamed', error);
            toRemove.push(object);
            removedCount++;
          }
        }
      }
    });

    // Remove problematic objects after traversal
    toRemove.forEach(obj => obj.parent?.remove(obj));

    if (removedCount > 0 || fixedCount > 0) {
      console.log(`🔧 Geometry validation: ${fixedCount} fixed, ${removedCount} removed`);
    }
  }

  render(): void {
    const renderer = this.renderer;

    // Always render main camera
    renderer.render(this.scene, this.cameraController.camera);

    // PiP drop camera — throttled to every 3rd frame to avoid doubling GPU cost
    if (this.dropCamera.shouldRenderThisFrame()) {
      const fullWidth = window.innerWidth;
      const fullHeight = window.innerHeight;
      const vp = this.dropCamera.getViewport();

      // Disable shadows for the PiP pass (huge perf save)
      const shadowsWereEnabled = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false;

      renderer.setScissorTest(true);
      renderer.setScissor(vp.x, vp.y, vp.width, vp.height);
      renderer.setViewport(vp.x, vp.y, vp.width, vp.height);
      renderer.render(this.scene, this.dropCamera.camera);

      // Restore
      renderer.shadowMap.enabled = shadowsWereEnabled;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, fullWidth, fullHeight);
    }
  }

  pause(): void {
    this.paused = true;
    this.pauseMenu.show();
  }

  resume(): void {
    this.paused = false;
    this.pauseMenu.hide();
  }

  enableMultiplayer(): void {
    this.multiplayerEnabled = true;
    const wsUrl = this.resolveMultiplayerUrl();
    if (!wsUrl) return;
    this.initMultiplayer(wsUrl);
  }

  disableMultiplayer(): void {
    this.multiplayerEnabled = false;
    if (this.multiplayer) {
      this.multiplayer.disconnect();
      this.multiplayer = null;
    }
  }

  private async handlePurchase(itemId: string): Promise<void> {
    const item = this.cosmetics.items.find(i => i.id === itemId);
    if (!item) return;

    // Import services dynamically
    const { getCurrentUser } = await import('./services/SupabaseClient');
    const { purchaseWithCoins, purchaseWithFeathers, purchaseWithWorms, purchaseWithGoldenEggs } = await import('./services/ShopService');
    const { addCosmeticToInventory } = await import('./services/PersistenceService');

    const user = await getCurrentUser();

    if (user) {
      // Authenticated: Use Supabase - dispatch to the correct purchase function
      let result;
      switch (item.currency) {
        case 'coins':
          result = await purchaseWithCoins(user.id, itemId, item.category, item.cost);
          break;
        case 'feathers':
          result = await purchaseWithFeathers(user.id, itemId, item.category, item.cost);
          break;
        case 'worms':
          result = await purchaseWithWorms(user.id, itemId, item.category, item.cost);
          break;
        case 'golden_eggs':
          result = await purchaseWithGoldenEggs(user.id, itemId, item.category, item.cost);
          break;
      }

      if (result.success) {
        item.owned = true;
        this.audio.playBankingSuccess();
        this.shopMenu.refresh();

        // Update local currency displays
        if (item.currency === 'coins' && result.updated_coins !== undefined) {
          this.scoreSystem.bankedCoins = result.updated_coins;
        } else if (item.currency === 'feathers' && result.updated_feathers !== undefined) {
          this.progression.feathers = result.updated_feathers;
        } else if (item.currency === 'worms' && result.updated_worms !== undefined) {
          this.progression.worms = result.updated_worms;
        } else if (item.currency === 'golden_eggs' && result.updated_golden_eggs !== undefined) {
          this.progression.goldenEggs = result.updated_golden_eggs;
        }
      } else {
        console.error('Purchase failed:', result.error);
        this.hud.showBankMessage(0, 0); // Show error notification
      }
    } else {
      // Guest: Use in-memory + localStorage
      const result = this.cosmetics.purchase(itemId, {
        coins: this.scoreSystem.totalCoins,
        feathers: this.progression.feathers,
        worms: this.scoreSystem.totalWorms + this.progression.worms,
        goldenEggs: this.progression.goldenEggs,
      });

      if (result.success) {
        // Deduct currency locally
        if (result.currency === 'coins') {
          const totalCost = result.cost;
          if (this.scoreSystem.bankedCoins >= totalCost) {
            this.scoreSystem.bankedCoins -= totalCost;
          } else {
            const fromBanked = this.scoreSystem.bankedCoins;
            this.scoreSystem.bankedCoins = 0;
            this.scoreSystem.coins -= (totalCost - fromBanked);
          }
        } else if (result.currency === 'feathers') {
          this.progression.feathers -= result.cost;
        } else if (result.currency === 'worms') {
          // Deduct from banked worms first, then session worms
          if (this.scoreSystem.bankedWorms >= result.cost) {
            this.scoreSystem.bankedWorms -= result.cost;
          } else {
            const fromBanked = this.scoreSystem.bankedWorms;
            this.scoreSystem.bankedWorms = 0;
            this.progression.worms -= (result.cost - fromBanked);
          }
        } else if (result.currency === 'golden_eggs') {
          this.progression.goldenEggs -= result.cost;
        }

        // Save to localStorage
        await addCosmeticToInventory(itemId, item.category);

        this.audio.playBankingSuccess();
        this.shopMenu.refresh();
      }
    }
  }

  private async handleEquip(itemId: string): Promise<void> {
    const success = this.cosmetics.equip(itemId);
    if (success) {
      // Apply visual changes
      this.bird.setColor(this.cosmetics.getBirdColor());

      // Refresh trail with new settings
      this.cosmetics.resetTrail(this.scene);

      // Save to persistence (Supabase or localStorage)
      const item = this.cosmetics.items.find(i => i.id === itemId);
      if (item) {
        const { saveEquippedCosmetic } = await import('./services/PersistenceService');
        await saveEquippedCosmetic(item.category, itemId);
      }

      this.audio.playHit();
    }
  }

  private applySettings(s: SettingsMenu): void {
    this.input.sensitivity = s.sensitivity;
    this.input.invertY = s.invertY;
    this.audio.setMasterVolume(s.masterVolume);
    this.audio.setSFXVolume(s.sfxVolume);
    this.audio.setMusicVolume(s.musicVolume);

    if (s.graphicsQuality === 'low') {
      this.renderer.setPixelRatio(1);
    } else if (s.graphicsQuality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  /** Clean up all resources to prevent memory leaks on page unload/reload */
  dispose(): void {
    // Remove event listeners
    window.removeEventListener('resize', this.onResize);

    // Clean up input manager listeners
    this.input.dispose();

    // Disconnect multiplayer
    if (this.multiplayer) {
      this.multiplayer.disconnect();
      this.multiplayer = null;
    }

    // Dispose PvP system
    this.pvpManager.dispose();

    // Destroy chat UI
    this.chatUI.destroy();

    // Remove FPS counter
    if (this.fpsCounter) {
      this.fpsCounter.remove();
      this.fpsCounter = null;
    }

    // Dispose all Three.js geometries, materials, and textures in scene
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) {
          for (const mat of object.material) {
            this.disposeMaterial(mat);
          }
        } else if (object.material) {
          this.disposeMaterial(object.material);
        }
      }
      if (object instanceof THREE.Sprite) {
        this.disposeMaterial(object.material);
      }
    });

    // Dispose environment system
    this.environmentSystem.dispose();

    // Dispose drop camera overlay
    this.dropCamera.dispose();

    // Dispose renderer and remove canvas
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private disposeMaterial(material: THREE.Material): void {
    const mat = material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.normalMap?.dispose();
    mat.roughnessMap?.dispose();
    mat.metalnessMap?.dispose();
    mat.emissiveMap?.dispose();
    material.dispose();
  }

  private resizeTimeout: any = null;

  /**
   * Resolve WebSocket URL for multiplayer.
   * - Requires explicit VITE_WS_URL so all clients target the same server/world.
   */
  private resolveMultiplayerUrl(): string | null {
    const envUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
    if (envUrl) {
      const isHttpsPage = window.location.protocol === 'https:';
      if (isHttpsPage && !envUrl.startsWith('wss://')) {
        console.warn('[multiplayer] HTTPS pages require VITE_WS_URL using wss://. Multiplayer disabled.');
        return null;
      }
      return envUrl;
    }
    console.warn('[multiplayer] VITE_WS_URL is not set. Multiplayer disabled to avoid split servers.');
    return null;
  }

  private onResize = (): void => {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.cameraController.setAspect(window.innerWidth / window.innerHeight);
      this.dropCamera.calculateViewport();
      this.resizeTimeout = null;
    }, 100);
  };

  private devModeVisible = false;
  private devTapCount = 0;
  private devTapTimer = 0;

  private createFPSCounter(): void {
    // Create the FPS counter (hidden by default — toggled via Dev Mode gesture)
    this.fpsCounter = document.createElement('div');
    this.fpsCounter.style.cssText =
      'position:fixed;top:10px;left:10px;padding:6px 10px;background:rgba(0,0,0,0.7);' +
      'color:#0f0;font-family:monospace;font-size:12px;border-radius:4px;z-index:10000;' +
      'display:none;pointer-events:none;';
    this.fpsCounter.textContent = 'FPS: --';
    document.body.appendChild(this.fpsCounter);

    // Dev Mode toggle: triple-tap top-left corner (100x100px zone)
    const devZone = document.createElement('div');
    devZone.style.cssText =
      'position:fixed;top:0;left:0;width:100px;height:100px;z-index:10001;pointer-events:auto;opacity:0;';
    devZone.addEventListener('click', () => {
      this.devTapCount++;
      clearTimeout(this.devTapTimer as any);
      this.devTapTimer = window.setTimeout(() => { this.devTapCount = 0; }, 600);
      if (this.devTapCount >= 3) {
        this.devModeVisible = !this.devModeVisible;
        if (this.fpsCounter) {
          this.fpsCounter.style.display = this.devModeVisible ? 'block' : 'none';
        }
        this.devTapCount = 0;
      }
    });
    document.body.appendChild(devZone);
  }

  private updateFPS(dt: number): void {
    this.frameCount++;
    this.lastFPSUpdate += dt;

    if (this.lastFPSUpdate >= 1.0) {
      const fps = Math.round(this.frameCount / this.lastFPSUpdate);
      if (this.fpsCounter && this.devModeVisible) {
        const color = fps >= 50 ? '#0f0' : fps >= 30 ? '#ff0' : '#f00';
        const info = this.renderer.info;
        this.fpsCounter.style.color = color;
        this.fpsCounter.innerHTML =
          `FPS: ${fps}<br>Calls: ${info.render.calls}<br>Tris: ${(info.render.triangles / 1000).toFixed(1)}k`;
      }
      this.frameCount = 0;
      this.lastFPSUpdate = 0;
    }
  }

  /** Check and unlock achievements based on current game state */
  private checkAchievements(): void {
    const stats = this.progression.stats;
    const check = (id: string, name: string) => {
      this.achievementsPanel.checkAndUnlock(id).then((unlocked) => {
        if (unlocked) this.sharePrompt.prompt({ type: 'achievement', name });
      });
    };

    // Hit-based achievements
    if (stats.totalNPCHits >= 1) check('first_hit', 'First Strike');
    if (stats.totalTouristsHit >= 100) check('tourist_hunter', 'Tourist Trap');
    if (stats.totalChefsHit >= 50) check('chef_menace', "Chef's Nightmare");

    // Streak achievements
    if (this.scoreSystem.streak >= 10) check('streak_10', 'Combo Master');

    // Coin achievements
    if (stats.lifetimeCoinsEarned >= 1000) check('bank_1000', 'Banker');
    if (stats.lifetimeCoinsEarned >= 10000) check('bank_10000', 'Tycoon');

    // Distance achievements
    if (stats.totalDistanceFlown >= 10000) check('distance_10km', 'Wanderer');
    if (stats.totalDistanceFlown >= 100000) check('distance_100km', 'Explorer');

    // Level achievements
    if (this.progression.level >= 10) check('level_10', 'Experienced');
    if (this.progression.level >= 25) check('level_25', 'Master Bird');
  }

  /** Save current game state to localStorage via main.ts */
  private async saveState(): Promise<void> {
    const saveFn = (window as any).__saveGameState;
    if (typeof saveFn === 'function') {
      await saveFn({ reason: 'banking' });
    }
  }

  /** Save a leaderbird run entry after banking */
  private saveLeaderBirdRun(): void {
    const getLeaderBird = (window as any).__getMenuLeaderBird;
    if (typeof getLeaderBird === 'function') {
      const lb = getLeaderBird();
      if (lb && typeof lb.addRun === 'function') {
        lb.addRun({
          date: new Date().toISOString(),
          coinsEarned: this.progression.stats.lifetimeCoinsEarned,
          level: this.progression.level,
          highestStreak: this.progression.stats.highestStreak,
          highestHeat: this.progression.stats.highestHeat,
          npcHits: this.progression.stats.totalNPCHits,
        });
      }
    }
    // Also update the game's own leaderbird instance
    this.leaderbird.addRun({
      date: new Date().toISOString(),
      coinsEarned: this.progression.stats.lifetimeCoinsEarned,
      level: this.progression.level,
      highestStreak: this.progression.stats.highestStreak,
      highestHeat: this.progression.stats.highestHeat,
      npcHits: this.progression.stats.totalNPCHits,
    });
  }
}
