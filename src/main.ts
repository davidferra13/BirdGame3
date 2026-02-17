import * as THREE from 'three';
import { Game } from './Game';
import { GameLoop } from './core/GameLoop';
import { MainMenu } from './ui/MainMenu';
import { StatsPanel } from './ui/StatsPanel';
import { LoadingScreen } from './ui/LoadingScreen';
import { NotificationManager } from './ui/NotificationManager';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { HowToPlay } from './ui/HowToPlay';
import { CreditsPanel } from './ui/CreditsPanel';
import { InviteFriends } from './ui/InviteFriends';
import { SettingsMenu } from './ui/SettingsMenu';
import { LeaderBird } from './ui/Leaderboard';
import { AchievementsPanel } from './ui/AchievementsPanel';
import { ShopMenu } from './ui/ShopMenu';
import { ProfilePage } from './ui/ProfilePage';
import { CosmeticsSystem } from './systems/CosmeticsSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { loadGuestCoins, loadGuestFeathers, loadGuestWorms, loadGuestGoldenEggs, loadGuestInventory, loadGuestEquipped } from './services/LocalStorageService';
import { assetLoader } from './systems/AssetLoader';
import { ReferralService } from './sharing/ReferralService';
import { FullscreenPrompt } from './ui/FullscreenPrompt';
import { ControlsMenu } from './ui/ControlsMenu';
import { authStateManager } from './services/AuthStateManager';
import { AuthScreen } from './ui/AuthScreen';
import { AccountPanel } from './ui/AccountPanel';

// CRITICAL FIX: Patch BufferGeometry to always return a valid boundingSphere
const originalComputeBoundingSphere = THREE.BufferGeometry.prototype.computeBoundingSphere;
THREE.BufferGeometry.prototype.computeBoundingSphere = function() {
  try {
    originalComputeBoundingSphere.call(this);
    // Ensure boundingSphere is never null/undefined
    if (!this.boundingSphere) {
      this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    }
  } catch (e) {
    console.warn('Failed to compute bounding sphere, using default:', e);
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  }
};

// NUCLEAR FIX: Intercept Scene.add to prevent adding meshes without geometry
const originalSceneAdd = THREE.Scene.prototype.add;
THREE.Scene.prototype.add = function(...objects: THREE.Object3D[]) {
  objects.forEach(obj => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.geometry) {
          console.error('❌ BLOCKING: Attempting to add mesh without geometry:', child.name || 'unnamed');
          // Set a default geometry
          child.geometry = new THREE.BoxGeometry(1, 1, 1);
          child.geometry.computeBoundingSphere();
          child.frustumCulled = false;
        }
      }
    });
  });
  return originalSceneAdd.apply(this, objects);
};

console.log('✅ Three.js patches applied');

// Initialize professional game systems
const loadingScreen = new LoadingScreen();
const notificationManager = new NotificationManager();
const errorBoundary = new ErrorBoundary(notificationManager);
const referralService = new ReferralService();

// Install global error handlers
errorBoundary.installGlobalHandlers();

let mainMenu: MainMenu | null = null;
let statsPanel: StatsPanel | null = null;
let howToPlay: HowToPlay | null = null;
let creditsPanel: CreditsPanel | null = null;
let inviteFriends: InviteFriends | null = null;
let authScreen: AuthScreen | null = null;
let accountPanel: AccountPanel | null = null;
let game: Game | null = null;
let loop: GameLoop | null = null;

// Standalone UI instances (accessible from main menu without game)
let menuSettings: SettingsMenu | null = null;
let menuControls: ControlsMenu | null = null;
let menuLeaderBird: LeaderBird | null = null;
let menuAchievements: AchievementsPanel | null = null;
let menuShop: ShopMenu | null = null;
let menuCosmetics: CosmeticsSystem | null = null;
let menuProgression: ProgressionSystem | null = null;
let menuScore: ScoreSystem | null = null;
let menuProfile: ProfilePage | null = null;

// Game state persistence keys
const GAMESTATE_KEY = 'birdgame_gamestate';

interface SavedGameState {
  stats: {
    totalNPCHits: number;
    totalTouristsHit: number;
    totalBusinessHit: number;
    totalPerformersHit: number;
    totalPoliceHit: number;
    totalChefsHit: number;
    totalTreemenHit: number;
    totalTimesGrounded: number;
    highestHeat: number;
    highestStreak: number;
    lifetimeCoinsEarned: number;
    totalDistanceFlown: number;
    totalBanks: number;
    largestBank: number;
  };
  level: number;
  xp: number;
  feathers: number;
  worms: number;
  goldenEggs: number;
  bankedCoins: number;
}

function loadGameState(): SavedGameState | null {
  try {
    const saved = localStorage.getItem(GAMESTATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load game state:', e);
  }
  return null;
}

function saveGameState(state: SavedGameState): void {
  try {
    localStorage.setItem(GAMESTATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save game state:', e);
  }
}

/** Build standalone shop systems from persisted data for menu use */
function initMenuShop(): void {
  menuCosmetics = new CosmeticsSystem();
  menuProgression = new ProgressionSystem();
  menuScore = new ScoreSystem();

  // Load persisted data into standalone systems
  const authState = authStateManager.getState();
  if (authState.isAuthenticated && authState.profile) {
    // Authenticated: load from Supabase profile
    menuProgression.level = authState.profile.level;
    menuProgression.xp = authState.profile.xp;
    menuProgression.feathers = authState.profile.feathers;
    menuProgression.worms = authState.profile.worms ?? 0;
    menuProgression.goldenEggs = authState.profile.golden_eggs ?? 0;
    menuScore.bankedCoins = authState.profile.coins;
  } else {
    // Guest: load from localStorage
    const savedState = loadGameState();
    if (savedState) {
      menuProgression.level = savedState.level;
      menuProgression.xp = savedState.xp;
      menuProgression.feathers = savedState.feathers;
      menuProgression.worms = savedState.worms ?? 0;
      menuProgression.goldenEggs = savedState.goldenEggs ?? 0;
      menuProgression.stats = { ...savedState.stats };
      menuScore.bankedCoins = savedState.bankedCoins;
    } else {
      menuScore.bankedCoins = loadGuestCoins();
      menuProgression.feathers = loadGuestFeathers();
      menuProgression.worms = loadGuestWorms();
      menuProgression.goldenEggs = loadGuestGoldenEggs();
    }
  }

  // Mark owned items from guest inventory (for guests)
  if (!authState.isAuthenticated) {
    const inventory = loadGuestInventory();
    for (const item of inventory) {
      const cosmeticItem = menuCosmetics.items.find(i => i.id === item.item_id);
      if (cosmeticItem) cosmeticItem.owned = true;
    }
  }

  // Load equipped cosmetics so profile page shows correct state
  // For guests, load from localStorage; for authenticated, loaded async via Supabase later
  if (!authState.isAuthenticated) {
    const equipped = loadGuestEquipped();
    if (equipped.skin) {
      menuCosmetics.equippedSkin = equipped.skin.replace('skin_', '') as any;
    }
    if (equipped.trail) {
      menuCosmetics.equippedTrail = equipped.trail.replace('trail_', '') as any;
    }
    if (equipped.splat) {
      menuCosmetics.equippedSplat = equipped.splat.replace('splat_', '') as any;
    }
  }

  menuShop = new ShopMenu(menuCosmetics, menuProgression, menuScore);
  menuShop.setOnClose(() => mainMenu?.show());

  // Wire purchase/equip for menu-mode shopping
  menuShop.setPurchaseCallback(async (itemId) => {
    const item = menuCosmetics!.items.find(i => i.id === itemId);
    if (!item) return;

    const result = menuCosmetics!.purchase(itemId, {
      coins: menuScore!.totalCoins,
      feathers: menuProgression!.feathers,
      worms: menuScore!.totalWorms + menuProgression!.worms,
      goldenEggs: menuProgression!.goldenEggs,
    });
    if (result.success) {
      if (result.currency === 'coins') {
        if (menuScore!.bankedCoins >= result.cost) {
          menuScore!.bankedCoins -= result.cost;
        }
      } else if (result.currency === 'worms') {
        menuProgression!.worms -= result.cost;
      } else if (result.currency === 'golden_eggs') {
        menuProgression!.goldenEggs -= result.cost;
      } else {
        menuProgression!.feathers -= result.cost;
      }

      const { addCosmeticToInventory } = await import('./services/PersistenceService');
      await addCosmeticToInventory(itemId, item.category);

      // Update persisted state
      const currentState = loadGameState();
      if (currentState) {
        currentState.bankedCoins = menuScore!.bankedCoins;
        currentState.feathers = menuProgression!.feathers;
        currentState.worms = menuProgression!.worms;
        currentState.goldenEggs = menuProgression!.goldenEggs;
        saveGameState(currentState);
      }

      menuShop!.refresh();
    }
  });

  menuShop.setEquipCallback(async (itemId) => {
    const success = menuCosmetics!.equip(itemId);
    if (success) {
      const item = menuCosmetics!.items.find(i => i.id === itemId);
      if (item) {
        const { saveEquippedCosmetic } = await import('./services/PersistenceService');
        await saveEquippedCosmetic(item.category, itemId);
      }
    }
  });
}

/** Build standalone profile page from persisted standalone systems */
function initMenuProfile(): void {
  if (!menuCosmetics || !menuProgression || !menuScore || !menuAchievements) return;

  // Remove old profile page DOM element if re-initializing
  if (menuProfile) menuProfile.destroy();

  menuProfile = new ProfilePage(menuCosmetics, menuProgression, menuScore, menuAchievements);
  menuProfile.setOnClose(() => mainMenu?.show());
  menuProfile.setOnOpenShop(() => {
    if (game) {
      game.shopMenu.setOnClose(() => mainMenu?.show());
      game.shopMenu.show();
    } else if (menuShop) {
      menuShop.show();
    }
  });
  menuProfile.setOnViewAchievements(() => {
    if (menuAchievements) {
      menuAchievements.show();
    }
  });
  menuProfile.setEquipCallback(async (itemId) => {
    const target = game ? (game as any).cosmetics : menuCosmetics!;
    const success = target.equip(itemId);
    if (success) {
      const item = target.items.find((i: any) => i.id === itemId);
      if (item) {
        const { saveEquippedCosmetic } = await import('./services/PersistenceService');
        await saveEquippedCosmetic(item.category, itemId);
      }
      menuProfile!.refresh();
    }
  });
}

async function startGame(): Promise<void> {
  if (!mainMenu) return;

  mainMenu.hide();

  if (!game) {
    game = new Game();
    // Load persisted cosmetics
    await game.init();

    // Load persisted game state into game systems
    const authState = authStateManager.getState();
    if (authState.isAuthenticated && authState.profile) {
      // Authenticated: load from Supabase profile
      game.progression.level = authState.profile.level;
      game.progression.xp = authState.profile.xp;
      game.progression.feathers = authState.profile.feathers;
      game.progression.worms = authState.profile.worms ?? 0;
      game.progression.goldenEggs = authState.profile.golden_eggs ?? 0;
      (game as any).scoreSystem.bankedCoins = authState.profile.coins;
    } else {
      // Guest: load from localStorage
      const savedState = loadGameState();
      if (savedState) {
        game.progression.level = savedState.level;
        game.progression.xp = savedState.xp;
        game.progression.feathers = savedState.feathers;
        game.progression.worms = savedState.worms ?? 0;
        game.progression.goldenEggs = savedState.goldenEggs ?? 0;
        game.progression.stats = { ...savedState.stats };
        (game as any).scoreSystem.bankedCoins = savedState.bankedCoins;
      }

      // Load owned inventory into game's cosmetics system (guests only)
      const inventory = loadGuestInventory();
      for (const item of inventory) {
        const cosmeticItem = (game as any).cosmetics?.items?.find((i: any) => i.id === item.item_id);
        if (cosmeticItem) cosmeticItem.owned = true;
      }
    }

    // Apply standalone settings to game if they were changed from the menu
    if (menuSettings) {
      (game as any).input.sensitivity = menuSettings.sensitivity;
      (game as any).input.invertY = menuSettings.invertY;
    }

    // Wire controls menu into the in-game pause → settings flow
    if (menuControls) {
      game.settingsMenu.setCallbacks(
        () => { game!.settingsMenu.hide(); },
        (s) => (game as any).applySettings(s),
        () => { (game as any).tutorial?.reset(); },
        () => {
          game!.settingsMenu.hide();
          menuControls!.setInputManager(game!.input);
          menuControls!.setOnClose(() => {
            menuControls!.hide();
            game!.settingsMenu.show();
          });
          menuControls!.show();
        },
      );
    }
  }

  // Stop any existing loop before creating a new one to prevent stacking
  if (loop) {
    loop.stop();
    loop = null;
  }

  loop = new GameLoop(
    (dt) => game!.update(dt),
    () => game!.render(),
    () => game!.input.endFrame(),
  );

  loop.start();
}

async function initialize(): Promise<void> {
  try {
    loadingScreen.show();

    // Wire asset loading progress to loading screen
    let loadedCount = 0;
    let totalAssets = 0;

    assetLoader.setOnProgress((progress) => {
      if (totalAssets === 0 && progress.total > 0) {
        totalAssets = Math.ceil(progress.total / 100000);
      }
      loadingScreen.updateProgress(loadedCount, Math.max(totalAssets, 1), progress.url);
    });

    assetLoader.setOnLoad((url) => {
      loadedCount++;
      loadingScreen.updateProgress(loadedCount, Math.max(totalAssets, loadedCount), url);
    });

    assetLoader.setOnError((url, error) => {
      console.error(`Failed to load asset: ${url}`, error);
      notificationManager.warning(`Failed to load some assets. Game may not work properly.`, 8000);
    });

    // Initialize authentication state
    loadingScreen.updateProgress(1, 4, 'Checking authentication...');
    const initialAuth = await authStateManager.initialize();

    // Initialize UI components
    loadingScreen.updateProgress(2, 4, 'Initializing UI...');
    mainMenu = new MainMenu();
    statsPanel = new StatsPanel();
    howToPlay = new HowToPlay();
    creditsPanel = new CreditsPanel();
    inviteFriends = new InviteFriends(referralService);

    // Create standalone menu UI instances
    menuControls = new ControlsMenu();
    menuControls.setOnClose(() => {
      menuControls!.hide();
      menuSettings!.show();
    });

    menuSettings = new SettingsMenu();
    menuSettings.setCallbacks(
      () => { menuSettings!.hide(); mainMenu?.show(); },
      () => { /* settings auto-save to localStorage */ },
      () => { /* replay tutorial - no-op from menu */ },
      () => { menuSettings!.hide(); menuControls!.show(); },
    );

    menuLeaderBird = new LeaderBird();
    menuLeaderBird.setOnClose(() => mainMenu?.show());

    menuAchievements = new AchievementsPanel();
    menuAchievements.setOnClose(() => mainMenu?.show());

    // Build standalone shop from persisted data
    initMenuShop();

    // Build profile page from standalone systems
    initMenuProfile();

    // Create auth UI
    authScreen = new AuthScreen();
    accountPanel = new AccountPanel();

    accountPanel.setOnClose(() => mainMenu?.show());
    accountPanel.setOnSignOut(() => {
      // After sign out, show auth screen
      mainMenu?.hide();
      showAuthScreen();
    });

    // Subscribe to auth changes to keep main menu display updated
    authStateManager.subscribe((state) => {
      mainMenu?.updateAuthDisplay(state);
    });

    // Set initial auth display
    mainMenu.updateAuthDisplay(initialAuth);

    // Setup callbacks - ALL buttons work without requiring game
    mainMenu.setCallbacks(
      // onPlay
      () => startGame(),
      // onStats → now opens Profile Page
      () => {
        if (menuProfile) {
          // If game is running, feed live data into profile
          if (game) {
            menuProfile.setData(
              (game as any).cosmetics,
              game.progression,
              (game as any).scoreSystem,
            );
          }
          mainMenu?.hide();
          menuProfile.show();
        }
      },
      // onCosmetics
      () => {
        if (game) {
          mainMenu?.hide();
          game.shopMenu.setOnClose(() => mainMenu?.show());
          game.shopMenu.show();
        } else if (menuShop) {
          mainMenu?.hide();
          menuShop.show();
        }
      },
      // onSettings
      () => {
        if (game) {
          mainMenu?.hide();
          game.settingsMenu.setCallbacks(
            () => { game!.settingsMenu.hide(); mainMenu?.show(); },
            (s) => (game as any).applySettings(s),
            () => { /* replay tutorial */ },
            () => {
              game!.settingsMenu.hide();
              menuControls!.setInputManager(game!.input);
              menuControls!.setOnClose(() => {
                menuControls!.hide();
                game!.settingsMenu.show();
              });
              menuControls!.show();
            },
          );
          game.settingsMenu.show();
        } else if (menuSettings) {
          mainMenu?.hide();
          menuSettings.show();
        }
      },
      // onHowToPlay
      () => {
        if (howToPlay) {
          mainMenu?.hide();
          howToPlay.show();
        }
      },
      // onQuit — return to main menu (works in iframes/game platforms)
      () => {
        if (confirm('Are you sure you want to quit?')) {
          // Save game state before quitting
          if (game) {
            saveCurrentGameState();
          }
          // In an iframe (game platform) or when window.close() fails, reload to main menu
          if (window.self !== window.top) {
            // Embedded in iframe — just reload back to menu
            window.location.reload();
          } else {
            window.close();
            // Fallback if window.close() is blocked by the browser
            setTimeout(() => window.location.reload(), 200);
          }
        }
      },
      // onCredits
      () => {
        if (creditsPanel) {
          mainMenu?.hide();
          creditsPanel.show();
        }
      },
      // onAchievements
      () => {
        if (game) {
          mainMenu?.hide();
          game.achievementsPanel.setOnClose(() => {
            game!.achievementsPanel.hide();
            mainMenu?.show();
          });
          game.achievementsPanel.show();
        } else if (menuAchievements) {
          mainMenu?.hide();
          menuAchievements.show();
        }
      },
      // onLeaderboard
      () => {
        if (game) {
          mainMenu?.hide();
          game.leaderbird.setOnClose(() => {
            game!.leaderbird.hide();
            mainMenu?.show();
          });
          game.leaderbird.show();
        } else if (menuLeaderBird) {
          mainMenu?.hide();
          menuLeaderBird.show();
        }
      },
      // onInviteFriend
      () => {
        if (inviteFriends) {
          mainMenu?.hide();
          inviteFriends.show();
        }
      },
      // onAccount
      () => {
        const state = authStateManager.getState();
        if (state.isAuthenticated) {
          mainMenu?.hide();
          accountPanel?.show();
        } else {
          mainMenu?.hide();
          showAuthScreen();
        }
      },
    );

    statsPanel.setOnClose(() => mainMenu?.show());
    howToPlay.setOnClose(() => mainMenu?.show());
    creditsPanel.setOnClose(() => mainMenu?.show());
    inviteFriends.setOnClose(() => mainMenu?.show());

    // Set return to menu callback for error boundary
    errorBoundary.setReturnToMenuCallback(() => {
      // Save state before cleanup
      if (game) {
        saveCurrentGameState();
      }
      if (loop) {
        loop.stop();
        loop = null;
      }
      if (game) {
        game = null;
      }
      if (mainMenu) {
        mainMenu.show();
      }
    });

    // Save game state before page unload
    window.addEventListener('beforeunload', () => {
      if (game) {
        saveCurrentGameState();
      }
    });

    // Wire share prompt callback (Game.ts calls this to open share panel)
    (window as any).__openSharePanel = (text: string) => {
      if (inviteFriends) {
        inviteFriends.setShareData(text, referralService.getShareUrl());
        inviteFriends.show();
      }
    };

    loadingScreen.updateProgress(3, 4, 'Loading complete!');

    // Hide loading screen
    await loadingScreen.hide();

    // Fullscreen prompt (one-time, before main menu)
    new FullscreenPrompt();

    // Auth gate: decide what to show first
    if (initialAuth.isAuthenticated) {
      // Existing session found — go straight to main menu
      mainMenu.show();
    } else {
      // No session — show auth screen (sign in, sign up, or guest)
      showAuthScreen();
    }

    console.log('✅ Game initialized successfully');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorBoundary.handleError(err, true);
  }
}

/** Show the auth screen with proper callback wiring */
function showAuthScreen(): void {
  if (!authScreen) return;
  authScreen.setOnComplete((state) => {
    mainMenu?.updateAuthDisplay(state);
    // Reinitialize menu shop and profile with new auth state (loads from Supabase if logged in)
    initMenuShop();
    initMenuProfile();
    mainMenu?.show();
  });
  authScreen.show();
}

/** Save current game state to localStorage + Supabase for authenticated users */
function saveCurrentGameState(): void {
  if (!game) return;
  const scoreSystem = (game as any).scoreSystem as ScoreSystem;
  const state: SavedGameState = {
    stats: { ...game.progression.stats },
    level: game.progression.level,
    xp: game.progression.xp,
    feathers: game.progression.feathers,
    worms: game.progression.worms,
    goldenEggs: game.progression.goldenEggs,
    bankedCoins: scoreSystem.bankedCoins,
  };

  // Always save to localStorage (fast, reliable fallback)
  saveGameState(state);

  // Additionally sync to Supabase for authenticated users
  const authState = authStateManager.getState();
  if (authState.isAuthenticated && authState.userId) {
    import('./services/SupabaseClient').then(({ supabase }) => {
      supabase.from('profiles').update({
        level: state.level,
        xp: state.xp,
        coins: state.bankedCoins,
        feathers: state.feathers,
        worms: state.worms,
        golden_eggs: state.goldenEggs,
      }).eq('id', authState.userId).then(({ error }) => {
        if (error) console.warn('Failed to sync state to Supabase:', error);
      });
    }).catch(e => console.warn('Supabase sync error:', e));
  }
}

// Export for Game.ts to call
(window as any).__saveGameState = saveCurrentGameState;
(window as any).__getMenuLeaderBird = () => menuLeaderBird;
(window as any).__getMenuAchievements = () => menuAchievements;

// Start initialization
initialize();

// Vite HMR cleanup: stop the game loop when the module is hot-replaced
// to prevent multiple render loops stacking up during development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (loop) {
      loop.stop();
      loop = null;
    }
  });
}
