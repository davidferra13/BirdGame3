export const FLIGHT = {
  // Speed
  BASE_SPEED: 30,
  MIN_SPEED: 0,
  MAX_SPEED: 50,
  DIVE_SPEED: 80,
  DIVE_ACCELERATION: 40,
  SPEED_RECOVERY_RATE: 10,
  BRAKE_RATE: 25,
  BRAKE_MIN_SPEED: 0, // S key brakes to a full stop in flight

  // Hover / landing
  HOVER_SPEED_THRESHOLD: 10,
  HOVER_DESCENT_RATE: 8,
  LANDING_SPEED: 8,
  LANDING_SPEED_THRESHOLD: 4, // Must be below this speed to trigger landing
  BRAKE_DESCENT_REDUCTION: 0.3, // When braking, reduce auto-descent to 30% (gentler sink)

  // Turning
  YAW_RATE: 2.2,
  YAW_ACCELERATION: 8.0,
  YAW_DECELERATION: 4.5,

  // Pitch
  PITCH_RATE: 1.5,
  PITCH_ACCELERATION: 6.0,
  PITCH_DECELERATION: 3.5,
  MAX_PITCH_UP: 0.6,
  MAX_PITCH_DOWN: -1.2,

  // Ascend (V2: Space to ascend)
  ASCEND_SPEED: 16,
  ASCEND_RAMP_UP_TIME: 0.3,
  ASCEND_RAMP_DOWN_TIME: 0.08,

  // Auto-descent
  AUTO_DESCENT_RATE: 1.2,
  AUTO_DESCENT_PITCH: -0.06, // Visible nose-down so bird pitch matches actual descent direction

  // Fast descent (browser-safe default: K)
  FAST_DESCENT_SPEED: 25,
  FAST_DESCENT_RAMP_TIME: 0.2, // Smooth ramp prevents jerky velocity snap

  // Gentle descent (B key: slow, controlled lowering)
  GENTLE_DESCENT_SPEED: 6,
  GENTLE_DESCENT_PITCH: -0.15, // Slight visible nose-down for feedback
  GENTLE_DESCENT_RAMP_TIME: 0.5, // Smooth ramp up/down

  // Dive
  DIVE_PITCH: -1.0,
  DIVE_PULL_OUT_SPEED: 2.0,
  DIVE_MOMENTUM_CONVERSION: 0.6, // 60% of dive speed converted to horizontal boost
  DIVE_MOMENTUM_DURATION: 1.8, // Boost lasts 1.8 seconds after pullout

  // Dive Bomb (enhanced dive)
  DIVE_BOMB_SPEED: 120,  // Maximum speed when dive bombing
  DIVE_BOMB_ACCELERATION: 60,  // Faster acceleration
  DIVE_BOMB_PITCH: -1.4,  // Steeper angle
  DIVE_BOMB_FOV_INCREASE: 10,  // Extra FOV during dive bomb

  // Banking
  MAX_BANK_ANGLE: 0.85,
  BANK_SPEED: 5.5,
  BANK_SINK_RATE: 1.5,

  // Altitude
  MAX_ALTITUDE: 200,
  MIN_ALTITUDE: 2,
  GROUND_ALTITUDE: 0.5,
  CEILING_PUSH_STRENGTH: 20,

  // Boost
  BOOST_MULTIPLIER: 100.0, // Maximum cartoon speed
  BOOST_COOLDOWN: 1.5,
  BOOST_DURATION: 1.7, // longer extreme boost

  // Ground mode
  GROUND_WALK_SPEED: 5,
  GROUND_WALK_BACKWARD_SPEED: 3,
  GROUND_TAKEOFF_SPEED: 12,
};

export const CAMERA = {
  OFFSET_BEHIND: 12,
  OFFSET_ABOVE: 5,
  LOOKAHEAD_DISTANCE: 15,

  POSITION_LERP_SPEED: 3.5,
  LOOKAT_LERP_SPEED: 5.0,

  DIVE_OFFSET_ABOVE: 8,
  DIVE_OFFSET_BEHIND: 16,
  GROUND_OFFSET_BEHIND: 8,
  GROUND_OFFSET_ABOVE: 3,
  GROUND_LERP_SPEED: 2.5,  // smoother camera turn when walking
  SPEED_FOV_MIN: 60,
  SPEED_FOV_MAX: 80,

  // Poop drop camera assist
  DROP_ZOOM_EXTRA_BEHIND: 3,
  DROP_ZOOM_EXTRA_ABOVE: 2,
  DROP_LOOK_DOWN_OFFSET: -4,
  DROP_ASSIST_DURATION: 0.3,

  // Bombing run mode (S key brake → aim camera)
  BOMBING_OFFSET_BEHIND: 5,
  BOMBING_OFFSET_ABOVE: 16,
  BOMBING_LOOK_DOWN: -18,
  BOMBING_LOOKAHEAD_SCALE: 0.3,
  BOMBING_LERP_SPEED: 2.0,

  // Vertigo shot (dolly zoom on boost)
  BOOST_FOV_PUNCH: 108,           // FOV spikes to this on boost start
  BOOST_PULL_IN_BEHIND: 3,        // Camera slams in to this distance behind bird
  BOOST_PULL_IN_ABOVE: 2,         // Camera drops low during punch
  BOOST_PUNCH_DURATION: 0.18,     // How long the initial vertigo punch lasts (seconds)
  BOOST_RECOVER_SPEED: 3.0,       // How fast FOV/offset recover after the punch
  BOOST_SHAKE_INTENSITY: 0.12,    // Screen shake on boost activation

  // Driving mode
  DRIVING_OFFSET_BEHIND: 10,
  DRIVING_OFFSET_ABOVE: 4,
  DRIVING_LERP_SPEED: 3.0,
  DRIVING_FOV_MIN: 65,
  DRIVING_FOV_MAX: 72,
  DRIVING_LOOKAHEAD: 8,
};

export const POOP = {
  GRAVITY: 15,
  AIR_DRAG: 0, // set >0 to model horizontal air resistance
  INITIAL_DOWN_SPEED: 2,
  INHERIT_FORWARD_FRACTION: 0.55,
  COOLDOWN: 0.4,
  MAX_ACTIVE: 5,
  MAX_LIFETIME: 8,
  SPLAT_RADIUS: 0.5,
  DECAL_MAX_COUNT: 300,
  DECAL_LIFETIME: 120, // 2 minutes
  DECAL_FADE_TIME: 10, // fade over last 10 seconds
};

export const NPC_CONFIG = {
  // Keep CPU load predictable; very high NPC counts can stall rendering/input.
  COUNT: 80,
  HIT_FREEZE_TIME: 3.0,
  BOUNDING_RADIUS: 1.0,
  DESPAWN_DISTANCE: 700,
  DESPAWN_OFFSCREEN_TIME: 5,

  // Tourist: Slow, high value, camera prop
  TOURIST_RATIO: 0.25,
  TOURIST_SPEED: 1.0,
  TOURIST_COINS: 25,
  TOURIST_HEAT: 1,

  // Business: Medium speed, medium value, briefcase prop
  BUSINESS_RATIO: 0.25,
  BUSINESS_SPEED: 3.0,
  BUSINESS_COINS: 15,
  BUSINESS_HEAT: 2,

  // Street Performer: Stationary, bonus multiplier, instrument prop
  PERFORMER_RATIO: 0.08,
  PERFORMER_SPEED: 0,
  PERFORMER_COINS: 30,
  PERFORMER_HEAT: 0,
  PERFORMER_MULTIPLIER_BONUS: 0.5,

  // Police: Fast patrol, instant Heat +10 if hit
  POLICE_RATIO: 0.10,
  POLICE_SPEED: 4.0,
  POLICE_COINS: 5,
  POLICE_HEAT: 10,

  // Chef: Medium speed, medium-high value, GLB model
  CHEF_RATIO: 0.08,
  CHEF_SPEED: 2.0,
  CHEF_COINS: 20,
  CHEF_HEAT: 1,

  // Treeman: Slow, high value, GLB model
  TREEMAN_RATIO: 0.10,
  TREEMAN_SPEED: 1.5,
  TREEMAN_COINS: 35,
  TREEMAN_HEAT: 2,

  // Glamorous Elegance: Slow, very high value, GLB model
  GLAMOROUS_ELEGANCE_RATIO: 0.14,
  GLAMOROUS_ELEGANCE_SPEED: 1.2,
  GLAMOROUS_ELEGANCE_COINS: 50,
  GLAMOROUS_ELEGANCE_HEAT: 3,

  // Bird flythrough scatter
  SCATTER_RADIUS: 2.5,         // Bird-to-NPC collision radius for scatter
  SCATTER_COOLDOWN: 1.5,       // Seconds before same NPC can be scattered again
  SCATTER_KNOCKBACK: 12,       // Horizontal knockback force
  SCATTER_JUMP: 6,             // Upward launch force
  SCATTER_SPIN_SPEED: 12,      // Spin rate (radians/sec)
  SCATTER_COINS: 3,            // Small coin reward per scattered NPC
  SCATTER_HEAT: 0,             // No heat for scattering
  SCATTER_CLUSTER_THRESHOLD: 3, // NPCs hit at once for "STRIKE!" bonus
  SCATTER_CLUSTER_BONUS: 15,   // Bonus coins for cluster scatter

  BASE_SPAWN_RATE: 6,
  HOTSPOT_SPAWN_RATE: 10,
  MAX_PER_DISTRICT: 180,
  BATCH_SPAWN_COUNT: 2,       // Spawn multiple NPCs per tick

  // Behavior tuning
  IDLE_CHANCE: 0.15,        // Chance per waypoint arrival to stop and idle
  IDLE_DURATION_MIN: 1.5,
  IDLE_DURATION_MAX: 4.0,
  FLEE_SPEED: 12.0,
  FLEE_RADIUS: 25,          // NPCs within this radius flee when one is hit
  FLEE_DURATION: 4.0,
};

export const SCORE = {
  BASE_POINTS: 10,

  MAX_MULTIPLIER: 2.5,

  GROUNDING_LOSS_FRACTION: 0.4,
  GROUNDING_ALTITUDE: 3,
  GROUNDING_RESPAWN_DELAY: 3.0,

  BANK_CHANNEL_TIME: 2.5,

  STREAK_TIMEOUT: 4.0,

  POPUP_MERGE_WINDOW: 0.2,
};

export const ALTITUDE_WARNING = {
  CAUTION_ALTITUDE: 15,   // Yellow warning — carrying coins near ground
  DANGER_ALTITUDE: 8,     // Orange warning — wanted + low altitude
  CRITICAL_ALTITUDE: 5,   // Red flashing — about to get grounded
  GRACE_PERIOD: 0.75,     // Seconds below grounding altitude before penalty triggers
};

export const PROGRESSION = {
  XP_DIVISOR: 5,
  BASE_XP_REQUIREMENT: 100,
  LEVEL_EXPONENT: 1.15,
  MAX_LEVEL: 50,
};

export const HOTSPOT = {
  COUNT: 2,  // Further reduced for better performance
  ROTATION_INTERVAL: 600,
  RADIUS: 60,  // Increased radius
  SPAWN_MULTIPLIER: 3,
  MIN_DISTANCE_FROM_SANCTUARY: 150,  // Increased from 50
  BEACON_HEIGHT: 100,
};

export const WORLD = {
  GROUND_Y: 0,
  CITY_SIZE: 1500,  // Expanded from 200 to 1500 (7.5x larger)

  // Soft boundary (gentle push-back at map edges)
  BOUNDARY_SOFT_EDGE: 700,   // push starts here
  BOUNDARY_HARD_EDGE: 800,   // max push at this distance
  BOUNDARY_PUSH_STRENGTH: 30,
};

export const COSMETICS = {
  TRAIL_LENGTH: 20,
  TRAIL_FADE_SPEED: 3,
};

export const AUDIO_CONF = {
  MASTER_VOLUME: 0.5,
  SFX_VOLUME: 0.7,
  MUSIC_VOLUME: 0.3,
};

// ============================================================================
// Economy & Currency
// ============================================================================

export const ECONOMY = {
  // XP Earning (from PLAYER_PROGRESSION.md)
  XP_PER_BANKED_COINS: 5, // xpEarned = floor(bankedCoins / 5)

  // No conversion between currencies allowed
  CURRENCY_CONVERSION_DISABLED: true,

  // Worm earning rates (skill-based activities)
  WORMS_PER_SCATTER_STRIKE: 3,   // Scatter 3+ NPCs at once
  WORMS_PER_RING_CHAIN: 2,       // Consecutive flight ring
  WORMS_PER_BALLOON: 1,          // Pop a balloon
  WORMS_PER_DRONE: 2,            // Hit a drone
  WORMS_PER_DRIVING_HIT: 1,      // Hit vehicle while driving

  // Feather earning rates
  FEATHERS_PER_LEVEL_UP: 2,
  FEATHERS_PER_BIG_BANK: 1,      // Awarded when banking 500+ coins
  BIG_BANK_THRESHOLD: 500,
  FEATHERS_PER_MEGA_BANK: 2,     // Awarded when banking 1000+ coins (on top of big bank)

  // Golden Egg earning rates
  GOLDEN_EGGS_PER_MEGA_BANK: 1,  // Banking 1000+ coins
  MEGA_BANK_THRESHOLD: 1000,
  GOLDEN_EGGS_PER_MVM_WIN: 1,
  GOLDEN_EGGS_LEVEL_MILESTONES: [10, 25, 50] as readonly number[],
  GOLDEN_EGGS_PER_MILESTONE: 1,
  FEATHERS_PER_MILESTONE: 5,
};

// ============================================================================
// Achievements
// ============================================================================

// ============================================================================
// Flight Challenges & Collectibles
// ============================================================================

export const FLIGHT_RINGS = {
  COUNT: 8,  // Further reduced for better performance
  RADIUS: 8,  // Ring radius
  THICKNESS: 1,
  GLOW_INTENSITY: 0.5,
  PASS_THROUGH_REWARD: 50,  // Coins for passing through
  CHECKPOINT_CHAIN_BONUS: 25,  // Bonus for hitting consecutive rings
  RESPAWN_TIME: 30,  // Seconds until ring respawns after collection
};

export const COLLECTIBLES = {
  GOLDEN_FEATHERS: {
    COUNT: 10,  // Further reduced for better performance
    GLOW_RADIUS: 15,  // How far away they glow
    COLLECTION_REWARD: 100,  // Coins per feather
    PREMIUM_REWARD: 1,  // Premium feathers earned
    RESPAWN_TIME: 300,  // 5 minutes
  },
  THERMAL_UPDRAFTS: {
    COUNT: 5,
    RADIUS: 12,
    LIFT_STRENGTH: 25,
    VISUAL_HEIGHT: 150,
  },
  BALLOONS: {
    MAX_COUNT: 12,
    SPAWN_INTERVAL: 8,        // Seconds between new balloon spawns
    COLLECT_RADIUS: 4,
    COIN_REWARD_MIN: 5,
    COIN_REWARD_MAX: 25,
    RISE_SPEED: 3,            // How fast they float up
    DRIFT_SPEED: 2,           // Horizontal drift
    MIN_ALTITUDE: 10,
    MAX_ALTITUDE: 120,        // Despawn above this
    SPAWN_RADIUS: 150,        // Spawn within this radius of player
  },
};

// ============================================================================
// Day/Night & Weather
// ============================================================================

export const TIME_SYSTEM = {
  CYCLE_DURATION: 600,  // 10 minutes per full day/night cycle
  SUNRISE_HOUR: 6,
  SUNSET_HOUR: 18,
  ENABLE_CYCLE: true,
};

export const WEATHER = {
  FOG_DENSITY_RANGE: [0.002, 0.008],  // Min/max fog
  RAIN_PARTICLE_COUNT: 200,  // Further reduced for better performance
  WIND_STRENGTH_RANGE: [0, 15],  // Affects flight
  WEATHER_CHANGE_INTERVAL: 120,  // Change weather every 2 minutes
};

// ============================================================================
// World Events
// ============================================================================

export const WORLD_EVENTS = {
  PARADE_INTERVAL: 300,  // Every 5 minutes
  PARADE_DURATION: 120,  // Lasts 2 minutes
  PARADE_NPC_COUNT: 30,
  PARADE_SPEED: 2.5,

  CONCERT_INTERVAL: 400,
  CONCERT_DURATION: 180,
  CONCERT_CROWD_SIZE: 50,

  FIREWORKS_INTERVAL: 450,
  FIREWORKS_DURATION: 60,
  FIREWORKS_COUNT: 20,
};

// ============================================================================
// Air Traffic
// ============================================================================

export const AIR_TRAFFIC = {
  HELICOPTER_COUNT: 2,
  HELICOPTER_SPEED: 15,
  HELICOPTER_ALTITUDE_RANGE: [80, 140] as [number, number],

  BLIMP_COUNT: 1,
  BLIMP_SPEED: 8,
  BLIMP_ALTITUDE: 120,

  BIRD_FLOCK_COUNT: 2,  // Reduced from 4 for performance
  FLOCK_SIZE: 5,  // Reduced from 8 for performance
  FLOCK_SPEED: 12,

  PLANE_COUNT: 2,  // Reduced from 3 for performance
  PLANE_SPEED: 40,
  PLANE_ALTITUDE_RANGE: [60, 110] as [number, number],
  PLANE_LOOP_RADIUS: 500,
};

// ============================================================================
// Vehicles
// ============================================================================

export const VEHICLES = {
  MAX_COUNT: 15,
  SPAWN_DISTANCE: 200,
  DESPAWN_DISTANCE: 400,
  HIT_COOLDOWN: 5,
  SPAWN_INTERVAL: 3,
  HIT_RADIUS: 2.5,

  CAR_RATIO: 0.5,
  CAR_SPEED: 8,
  CAR_COINS: 15,
  CAR_HEAT: 1,

  TAXI_RATIO: 0.3,
  TAXI_SPEED: 10,
  TAXI_COINS: 20,
  TAXI_HEAT: 1,

  BUS_RATIO: 0.2,
  BUS_SPEED: 5,
  BUS_COINS: 40,
  BUS_HEAT: 2,
  BUS_HIT_RADIUS: 3.5,
};

// ============================================================================
// Drivable Car (Bird Driving Mechanic)
// ============================================================================

export const DRIVING = {
  // Speed
  MAX_SPEED: 35,
  MAX_REVERSE_SPEED: 8,
  ACCELERATION: 20,
  REVERSE_ACCELERATION: 10,
  BRAKE_FORCE: 40,
  FRICTION: 8,
  HANDBRAKE_FORCE: 60,

  // Steering
  MAX_STEER_ANGLE: 0.6,
  STEER_SPEED: 4.0,

  // Car dimensions
  WHEELBASE: 2.6,
  COLLISION_RADIUS: 2.2,

  // Enter/exit
  ENTER_DISTANCE: 5.0,
  ENTER_MAX_ALTITUDE: 3.0,
  EXIT_OFFSET: 3.0,
  CAR_COUNT: 5,
  MOTORCYCLE_COUNT: 2,
  HELICOPTER_COUNT: 1,
  PROP_PLANE_COUNT: 1,
  HORSE_COUNT: 1,
};

// ============================================================================
// Street Life (pigeons, cats, dogs, food carts)
// ============================================================================

export const STREET_LIFE = {
  // Pigeons
  PIGEON_FLOCK_COUNT: 8,
  PIGEONS_PER_FLOCK: 6,
  PIGEON_SCATTER_RADIUS: 20,
  PIGEON_SCATTER_ALTITUDE: 15,
  PIGEON_SCATTER_SPEED: 15,
  PIGEON_SCATTER_DURATION: 2,
  PIGEON_REGROUP_TIME: 15,
  PIGEON_HIT_RADIUS: 3,       // Hit radius for the whole flock
  PIGEON_FLOCK_COINS: 10,     // Coins for splatting a resting flock
  PIGEON_FLOCK_HEAT: 0,

  // Cats
  CAT_COUNT: 6,
  CAT_SPEED: 2,
  CAT_DODGE_RADIUS: 12,
  CAT_DODGE_SPEED: 14,
  CAT_DODGE_DURATION: 1.5,
  CAT_HIT_RADIUS: 1,
  CAT_COINS: 20,              // Hard to hit = higher reward
  CAT_HEAT: 0,

  // Dogs
  DOG_COUNT: 6,
  DOG_SPEED: 3,
  DOG_REACT_RADIUS: 25,
  DOG_SCATTER_SPEED: 8,
  DOG_SCATTER_DURATION: 2,
  DOG_HIT_RADIUS: 1.2,
  DOG_COINS: 10,
  DOG_HEAT: 0,

  // Food Carts
  FOOD_CART_COUNT: 8,
  FOOD_CART_COINS: 35,
  FOOD_CART_HEAT: 1,
  FOOD_CART_HIT_RADIUS: 2.5,
  FOOD_CART_HIT_COOLDOWN: 8,
};

// ============================================================================
// Delivery Drones
// ============================================================================

export const DRONES = {
  COUNT: 4,
  SPEED: 15,
  ALTITUDE_RANGE: [20, 60] as [number, number],
  COINS: 30,
  HEAT: 0,
  HIT_RADIUS: 2,
  RESPAWN_TIME: 15,
};

export const ACHIEVEMENTS = {
  FIRST_DROP: {
    id: 'first_drop',
    name: 'First Drop',
    description: 'Hit 1 NPC',
    requirement: 1,
    stat_key: 'total_npc_hits',
    reward_type: 'title' as const,
    reward_id: 'title_rookie',
  },
  PUBLIC_MENACE: {
    id: 'public_menace',
    name: 'Public Menace',
    description: 'Reach Heat 15',
    requirement: 15,
    stat_key: 'highest_heat_reached',
    reward_type: 'title' as const,
    reward_id: 'title_menace',
  },
  HIGH_ROLLER: {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Bank 1,000 coins in one run',
    requirement: 1000,
    stat_key: 'biggest_banked_run',
    reward_type: 'cosmetic_bundle' as const,
    reward_id: 'bundle_high_roller',
  },
  BOUNTY_HUNTER: {
    id: 'bounty_hunter',
    name: 'Bounty Hunter',
    description: 'Ground 10 wanted players',
    requirement: 10,
    stat_key: 'total_groundings_dealt',
    reward_type: 'title' as const,
    reward_id: 'title_hunter',
  },
  PAINT_THE_TOWN: {
    id: 'paint_the_town',
    name: 'Paint the Town',
    description: 'Hit 1,000 NPCs',
    requirement: 1000,
    stat_key: 'total_npc_hits',
    reward_type: 'cosmetic_bundle' as const,
    reward_id: 'bundle_paint_town',
  },
} as const;

// ============================================================================
// PvP System
// ============================================================================

export const PVP = {
  // Round lifecycle
  LOBBY_DURATION: 2,            // Seconds in lobby before countdown
  COUNTDOWN_DURATION: 3,        // 3-2-1 countdown
  RESULTS_DISPLAY_DURATION: 10, // Seconds to show results before auto-close

  // Players
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,

  // Bot difficulty (0-1 scale: 0 = easy, 1 = hard)
  BOT_REACTION_TIME: 0.5,      // Seconds of delay before bots react
  BOT_ACCURACY: 0.6,           // 0-1 poop accuracy
  BOT_SPEED_FACTOR: 0.8,       // Fraction of max speed bots use

  // --- Poop Tag ---
  TAG_ROUND_DURATION: 120,     // 2 minutes
  TAG_MIN_PLAYERS: 3,          // Minimum including bots
  TAG_MAX_PLAYERS: 8,
  TAG_DRAIN_RATE: 1,           // Coins per second when tagged
  TAG_WINNER_BONUS: 50,        // Base coins for non-tagged players
  TAG_PROXIMITY_RANGE: 80,     // Range for proximity indicator

  // --- Race ---
  RACE_ROUND_DURATION: 90,     // 90 seconds max
  RACE_MIN_PLAYERS: 2,
  RACE_MAX_PLAYERS: 8,
  RACE_CHECKPOINT_COUNT: 12,   // Default checkpoints per race
  RACE_RING_RADIUS: 6,         // Radius of checkpoint rings
  RACE_1ST_REWARD: 100,
  RACE_2ND_REWARD: 60,
  RACE_3RD_REWARD: 30,
  RACE_PARTICIPATION_REWARD: 10,

  // --- Poop Cover (Splat Attack) ---
  COVER_ROUND_DURATION: 75,    // 75 seconds
  COVER_MIN_PLAYERS: 2,
  COVER_MAX_PLAYERS: 8,
  COVER_CENTER_BONUS: 3,       // Points for center hit
  COVER_EDGE_POINTS: 1,        // Points for edge hit
  COVER_HIT_RADIUS: 8,         // Distance from statue center to count
  COVER_WINNER_BONUS: 80,
  COVER_PARTICIPATION_REWARD: 15,
  COVER_STATUE_BEACON_HEIGHT: 60,

  // --- Combat mechanics (cross-mode) ---
  COMBAT_BURST_RANGE: 26,       // Radius for Burst shockwave
  COMBAT_BURST_KNOCKBACK: 16,   // Instant displacement applied to targets
  COMBAT_BURST_SLOW_S: 2.5,     // Slow duration after getting Bursted
  COMBAT_BURST_COOLDOWN_S: 10,  // Cooldown for Burst ability

  COMBAT_MINE_RADIUS: 10,       // Trigger radius for mines
  COMBAT_MINE_DURATION_S: 12,   // Lifetime for deployed mine
  COMBAT_MINE_ROOT_S: 1.6,      // Hard root duration from mine trigger
  COMBAT_MINE_SLOW_S: 2.2,      // Follow-up slow duration after root
  COMBAT_MINE_COOLDOWN_S: 14,   // Cooldown for Mine deployment

  // Player colors (for poop tinting, markers, etc.)
  PLAYER_COLORS: [
    0xff4444, 0x4488ff, 0x44ff44, 0xffcc00,
    0xff44ff, 0x44ffff, 0xff8844, 0xaa44ff,
  ] as readonly number[],
};

// ============================================================================
// Heist PvP Mode
// ============================================================================

export const HEIST = {
  // Match rules
  POINTS_TO_WIN: 3,
  MATCH_TIME_LIMIT: 180,              // seconds (3 minutes)
  COUNTDOWN_DURATION: 3,              // seconds before match starts
  SCORE_PAUSE_DURATION: 2,            // seconds pause after a point before trophy respawns

  // Trophy
  TROPHY_HOVER_HEIGHT: 40,            // units above ground for center spawn
  TROPHY_ROTATION_SPEED: 1.5,         // radians/sec idle rotation
  TROPHY_GLOW_INTENSITY: 2.0,         // point light intensity
  TROPHY_BEAM_HEIGHT: 200,            // light beam pillar height
  TROPHY_BEAM_OPACITY: 0.3,           // light beam transparency
  TROPHY_DROP_GRAVITY: 30,            // gravity when falling after slam
  TROPHY_DROP_INHERIT_VELOCITY: 0.4,  // fraction of carrier velocity inherited on drop
  TROPHY_DROP_MAX_FALL_TIME: 3,       // max seconds of freefall before forced settle
  TROPHY_GRAB_IMMUNITY: 0.75,         // seconds after settling before grabbable
  TROPHY_COLOR: 0xffd700,             // golden color

  // Scoring pedestals
  PEDESTAL_TRIGGER_RADIUS: 12,        // sphere collider radius for scoring
  PEDESTAL_HEIGHT: 35,                // units above ground (rooftop height)
  PEDESTAL_DISTANCE_FROM_CENTER: 200, // how far pedestals are from city center

  // Body-slam
  SLAM_SPEED_THRESHOLD: 0.7,          // fraction of max flight speed required
  SLAM_COLLISION_RADIUS: 6,           // sphere collision radius (generous for lag)
  SLAM_KNOCKBACK_FORCE: 40,           // impulse applied to carrier on hit
  SLAM_KNOCKBACK_DURATION: 0.5,       // seconds of reduced control for carrier
  SLAM_ATTACKER_RECOIL: 20,           // impulse applied to attacker (bounce off)
  SLAM_COOLDOWN: 1.5,                 // seconds before attacker can slam again

  // Bot AI
  BOT_REACTION_DELAY: 0.3,            // seconds before bot reacts to state changes
  BOT_FLIGHT_PRECISION: 0.75,         // 0-1, how directly bot flies to targets
  BOT_SLAM_ACCURACY: 0.6,             // 0-1, probability bot lines up a good slam approach
  BOT_SPEED_UTILIZATION: 0.8,         // fraction of max speed bot typically flies at
  BOT_DIFFICULTY: 'medium' as const,  // 'easy' | 'medium' | 'hard' preset

  // Spawn positions
  PLAYER_SPAWN_DISTANCE: 200,         // distance from center for starting positions
  PLAYER_SPAWN_HEIGHT: 50,            // altitude for starting positions

  // Player colors (1v1)
  PLAYER_1_COLOR: 0x4488ff,           // blue
  PLAYER_2_COLOR: 0xff4444,           // red
};

// ============================================================================
// Murmuration (Clan) System
// ============================================================================

export const MURMURATION = {
  // Creation
  CREATE_COST: 500,                   // Banked coins to create
  MIN_LEVEL: 5,                       // Player level required to create

  // Member limits
  MAX_MEMBERS: 50,                    // Default max members
  MAX_MEMBERS_F7: 75,                 // Max members after Formation 7 unlock

  // Name & Tag
  NAME_MIN: 3,
  NAME_MAX: 24,
  TAG_MIN: 2,
  TAG_MAX: 4,

  // Cooldowns & timers
  COOLDOWN_MS: 86_400_000,            // 24h join cooldown after leaving
  INVITE_TTL_MS: 604_800_000,         // 7-day invite expiry
  ALPHA_INACTIVE_DAYS: 30,            // Days before auto-succession

  // Formation XP thresholds (index = formation level)
  FORMATION_XP_THRESHOLDS: [
    0,        // Formation 1 (starting)
    2_000,    // Formation 2
    5_000,    // Formation 3
    10_000,   // Formation 4
    20_000,   // Formation 5
    35_000,   // Formation 6
    55_000,   // Formation 7
    80_000,   // Formation 8
    120_000,  // Formation 9
    200_000,  // Formation 10
  ] as readonly number[],

  // Formation XP sources
  XP_BANK_PERCENT: 0.10,              // 10% of banked coins as Formation XP
  XP_LEVEL_UP: 200,                   // Formation XP per member level-up
  XP_PERSONAL_CHALLENGE: 50,          // Formation XP per personal challenge completion
  XP_GROUP_CHALLENGE: 300,            // Formation XP per group challenge completion
  XP_MVM_WIN: 500,                    // Formation XP per MvM win
  XP_PVP_WIN: 100,                    // Formation XP per individual PvP win
  XP_MVM_LOSS: 100,                   // Formation XP per MvM loss (participation)

  // Description
  DESCRIPTION_MAX: 200,

  // Season
  SEASON_DURATION_DAYS: 30,

  // Chat
  CHAT_MAX_LENGTH: 200,
  CHAT_RATE_LIMIT_MS: 1000,
};

export const MVM = {
  // Matchmaking
  MATCHMAKING_TIMEOUT_MS: 60_000,     // 60s before fallback/bot fill
  FORMATION_RANGE: 2,                 // ±2 Formation level matchmaking range

  // Team sizes
  TEAM_SIZES: [2, 3, 5] as readonly number[],

  // Territory War
  TERRITORY_POINTS_TO_WIN: 300,
  TERRITORY_CAPTURE_TIME_S: 5,
  TERRITORY_MATCH_TIME_S: 300,        // 5-minute duration
  TERRITORY_KNOCKOFF_TIME_S: 3,
  TERRITORY_ZONE_COUNT: 3,
  TERRITORY_POINTS_PER_SECOND: 1,

  // Team Poop Tag
  TEAM_TAG_DURATION_S: 180,           // 3 minutes

  // Team Race
  TEAM_RACE_DURATION_S: 90,

  // Team Splat Attack
  TEAM_SPLAT_DURATION_S: 90,

  // Rewards
  WIN_COINS: 200,
  WIN_FEATHERS: 50,
  LOSS_COINS: 50,
  LOSS_FEATHERS: 10,
  MVP_BONUS_COINS: 100,
  MVP_BONUS_FORMATION_XP: 100,

  // Countdown
  COUNTDOWN_DURATION_S: 5,
  RESULTS_DISPLAY_S: 10,

  // MvM team colors
  TEAM_A_COLOR: 0x4488ff,
  TEAM_B_COLOR: 0xff4444,
};

