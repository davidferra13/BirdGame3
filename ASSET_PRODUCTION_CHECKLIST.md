# Bird Game 3D - Asset Production Checklist

**Last Updated:** 2026-02-15
**Total Assets:** 347+
**Completed:** 0 / 347

---

## Priority Legend
- 🔴 **CRITICAL** - Week 1 (Core Gameplay)
- 🟠 **HIGH** - Week 2 (Polish)
- 🟡 **MEDIUM** - Week 3-4 (Content)
- 🟢 **LOW** - Post-Launch (Extras)

## File Format Guidelines
- **3D Models**: GLB (glTF Binary)
- **Textures**: PNG (transparent) or WebP (compressed)
- **Audio**: MP3 or OGG
- **Optimize**: Use `gltf-transform` for 3D models

---

## CATEGORY 1: CHARACTER MODELS (Bird)

### Player Bird Models - Core
- [ ] **001** | 🔴 CRITICAL | Seagull Base Model
  - Format: GLB with animations
  - Specs: 500-1000 tris, includes fly/glide/dive/idle/turn animations
  - Path: `public/models/characters/seagull_base.glb`
  - Status: ⬜ Not Started

### Player Bird Models - Cosmetic Skins
- [ ] **002** | 🟡 MEDIUM | Classic Seagull (white/grey)
  - Format: GLB | Specs: Match base model skeleton
  - Path: `public/models/characters/skins/seagull_classic.glb`

- [ ] **003** | 🟡 MEDIUM | Black Crow
  - Format: GLB | Path: `public/models/characters/skins/crow_black.glb`

- [ ] **004** | 🟡 MEDIUM | Brown Pigeon
  - Format: GLB | Path: `public/models/characters/skins/pigeon_brown.glb`

- [ ] **005** | 🟡 MEDIUM | Red Cardinal
  - Format: GLB | Path: `public/models/characters/skins/cardinal_red.glb`

- [ ] **006** | 🟡 MEDIUM | Blue Jay
  - Format: GLB | Path: `public/models/characters/skins/bluejay.glb`

- [ ] **007** | 🟡 MEDIUM | Yellow Canary
  - Format: GLB | Path: `public/models/characters/skins/canary_yellow.glb`

- [ ] **008** | 🟡 MEDIUM | Green Parrot
  - Format: GLB | Path: `public/models/characters/skins/parrot_green.glb`

- [ ] **009** | 🟡 MEDIUM | Pink Flamingo
  - Format: GLB | Path: `public/models/characters/skins/flamingo_pink.glb`

- [ ] **010** | 🟡 MEDIUM | Rainbow Pride Bird
  - Format: GLB | Path: `public/models/characters/skins/rainbow_pride.glb`

- [ ] **011** | 🟡 MEDIUM | Ghost Bird (translucent white)
  - Format: GLB with transparent shader
  - Path: `public/models/characters/skins/ghost_translucent.glb`

- [ ] **012** | 🟡 MEDIUM | Golden Bird (metallic gold)
  - Format: GLB with metallic material
  - Path: `public/models/characters/skins/golden_metallic.glb`

- [ ] **013** | 🟡 MEDIUM | Chrome Bird (reflective silver)
  - Format: GLB | Path: `public/models/characters/skins/chrome_silver.glb`

- [ ] **014** | 🟡 MEDIUM | Neon Bird (glowing edges)
  - Format: GLB with emissive material
  - Path: `public/models/characters/skins/neon_glow.glb`

- [ ] **015** | 🟢 LOW | Crystal Bird (translucent with refraction)
  - Format: GLB | Path: `public/models/characters/skins/crystal.glb`

- [ ] **016** | 🟢 LOW | Fire Bird (with fire shader/particles)
  - Format: GLB | Path: `public/models/characters/skins/fire_effect.glb`

- [ ] **017** | 🟢 LOW | Ice Bird (with frost shader)
  - Format: GLB | Path: `public/models/characters/skins/ice_frost.glb`

- [ ] **018** | 🟢 LOW | Galaxy Bird (space/star texture)
  - Format: GLB | Path: `public/models/characters/skins/galaxy_space.glb`

- [ ] **019** | 🟢 LOW | Zombie Bird (decayed, comedic)
  - Format: GLB | Path: `public/models/characters/skins/zombie_decayed.glb`

- [ ] **020** | 🟡 MEDIUM | Tuxedo Bird (formal black & white)
  - Format: GLB | Path: `public/models/characters/skins/tuxedo_formal.glb`

- [ ] **021** | 🟢 LOW | Chicken (comedic alternative)
  - Format: GLB | Path: `public/models/characters/skins/chicken_comedic.glb`

---

## CATEGORY 2: NPC PEDESTRIAN MODELS

- [ ] **022** | 🔴 CRITICAL | Businessman - Male
  - Format: GLB | Specs: 500-1500 tris, walk animation
  - Path: `public/models/npcs/businessman_male.glb`

- [ ] **023** | 🔴 CRITICAL | Businesswoman - Female
  - Format: GLB | Path: `public/models/npcs/businesswoman_female.glb`

- [ ] **024** | 🟠 HIGH | Tourist (camera, hat)
  - Format: GLB | Path: `public/models/npcs/tourist.glb`

- [ ] **025** | 🟠 HIGH | Jogger - Male
  - Format: GLB with run animation
  - Path: `public/models/npcs/jogger_male.glb`

- [ ] **026** | 🟠 HIGH | Jogger - Female
  - Format: GLB | Path: `public/models/npcs/jogger_female.glb`

- [ ] **027** | 🟡 MEDIUM | Street Musician (guitar)
  - Format: GLB | Path: `public/models/npcs/musician_street.glb`

- [ ] **028** | 🟡 MEDIUM | Mime (striped outfit)
  - Format: GLB | Path: `public/models/npcs/mime.glb`

- [ ] **029** | 🟠 HIGH | Construction Worker
  - Format: GLB | Path: `public/models/npcs/construction_worker.glb`

- [ ] **030** | 🟡 MEDIUM | Hot Dog Vendor
  - Format: GLB with cart | Path: `public/models/npcs/hotdog_vendor.glb`

- [ ] **031** | 🟡 MEDIUM | Dog Walker (person + dog)
  - Format: GLB | Path: `public/models/npcs/dog_walker.glb`

- [ ] **032** | 🟡 MEDIUM | Stroller Parent
  - Format: GLB | Path: `public/models/npcs/stroller_parent.glb`

- [ ] **033** | 🟠 HIGH | Teenager (backpack)
  - Format: GLB | Path: `public/models/npcs/teenager.glb`

- [ ] **034** | 🟡 MEDIUM | Elderly Person (walker/cane)
  - Format: GLB | Path: `public/models/npcs/elderly.glb`

- [ ] **035** | 🟠 HIGH | Police Officer
  - Format: GLB | Path: `public/models/npcs/police_officer.glb`
  - Note: Important for wanted mechanic

- [ ] **036** | ✅ DONE | Chef
  - Path: `public/models/characters/chef.glb` (already exists)

- [ ] **037** | 🟡 MEDIUM | Delivery Person
  - Format: GLB | Path: `public/models/npcs/delivery_person.glb`

- [ ] **038** | 🟡 MEDIUM | Student (backpack, books)
  - Format: GLB | Path: `public/models/npcs/student.glb`

- [ ] **039** | 🟡 MEDIUM | Skateboarder
  - Format: GLB | Path: `public/models/npcs/skateboarder.glb`

- [ ] **040** | 🟠 HIGH | Office Worker (coffee cup)
  - Format: GLB | Path: `public/models/npcs/office_worker.glb`

---

## CATEGORY 3: CITY BUILDINGS

### Commercial Buildings
- [ ] **041** | 🔴 CRITICAL | Office Building - Small (3-5 stories)
  - Format: GLB | Specs: 2000-5000 tris
  - Path: `public/models/buildings/office_small.glb`

- [ ] **042** | 🔴 CRITICAL | Office Building - Medium (6-10 stories)
  - Format: GLB | Path: `public/models/buildings/office_medium.glb`

- [ ] **043** | 🔴 CRITICAL | Office Building - Large Skyscraper (15+ stories)
  - Format: GLB | Specs: Use LOD system
  - Path: `public/models/buildings/skyscraper_large.glb`

- [ ] **044** | 🟠 HIGH | Shopping Mall
  - Format: GLB | Path: `public/models/buildings/shopping_mall.glb`

- [ ] **045** | 🟠 HIGH | Restaurant Building
  - Format: GLB | Path: `public/models/buildings/restaurant.glb`

- [ ] **046** | 🟠 HIGH | Coffee Shop
  - Format: GLB | Path: `public/models/buildings/coffee_shop.glb`

- [ ] **047** | 🟡 MEDIUM | Bank Building
  - Format: GLB | Path: `public/models/buildings/bank.glb`

- [ ] **048** | 🟡 MEDIUM | Hotel
  - Format: GLB | Path: `public/models/buildings/hotel.glb`

- [ ] **049** | 🟠 HIGH | Department Store
  - Format: GLB | Path: `public/models/buildings/department_store.glb`

- [ ] **050** | 🟡 MEDIUM | Movie Theater
  - Format: GLB | Path: `public/models/buildings/movie_theater.glb`

### Residential Buildings
- [ ] **051** | 🔴 CRITICAL | Apartment Complex - Low-rise
  - Format: GLB | Path: `public/models/buildings/apartment_lowrise.glb`

- [ ] **052** | 🟠 HIGH | Apartment Complex - Mid-rise
  - Format: GLB | Path: `public/models/buildings/apartment_midrise.glb`

- [ ] **053** | 🟠 HIGH | Apartment Complex - High-rise
  - Format: GLB | Path: `public/models/buildings/apartment_highrise.glb`

- [ ] **054** | 🟡 MEDIUM | Townhouse Row
  - Format: GLB | Path: `public/models/buildings/townhouse_row.glb`

- [ ] **055** | 🟡 MEDIUM | Single Family Home
  - Format: GLB | Path: `public/models/buildings/house_suburban.glb`

### Special Buildings
- [ ] **056** | 🔴 CRITICAL | Sanctuary Building (central green area)
  - Format: GLB with green emissive glow
  - Path: `public/models/buildings/sanctuary.glb`
  - Note: Critical for banking mechanic

- [ ] **057** | 🟠 HIGH | Police Station
  - Format: GLB | Path: `public/models/buildings/police_station.glb`

- [ ] **058** | 🟡 MEDIUM | Fire Station
  - Format: GLB | Path: `public/models/buildings/fire_station.glb`

- [ ] **059** | 🟡 MEDIUM | City Hall
  - Format: GLB | Path: `public/models/buildings/city_hall.glb`

- [ ] **060** | 🟡 MEDIUM | Library
  - Format: GLB | Path: `public/models/buildings/library.glb`

- [ ] **061** | 🟡 MEDIUM | Museum
  - Format: GLB | Path: `public/models/buildings/museum.glb`

- [ ] **062** | 🟡 MEDIUM | Church/Cathedral
  - Format: GLB | Path: `public/models/buildings/church.glb`

- [ ] **063** | 🟠 HIGH | Parking Garage
  - Format: GLB | Path: `public/models/buildings/parking_garage.glb`

---

## CATEGORY 4: PARK & NATURE ASSETS

### Vegetation
- [ ] **064** | 🔴 CRITICAL | Tree - Oak (variation 1)
  - Format: GLB | Specs: 500-1500 tris
  - Path: `public/models/nature/tree_oak_01.glb`

- [ ] **065** | 🔴 CRITICAL | Tree - Oak (variation 2)
  - Format: GLB | Path: `public/models/nature/tree_oak_02.glb`

- [ ] **066** | 🔴 CRITICAL | Tree - Pine (variation 1)
  - Format: GLB | Path: `public/models/nature/tree_pine_01.glb`

- [ ] **067** | 🟠 HIGH | Tree - Pine (variation 2)
  - Format: GLB | Path: `public/models/nature/tree_pine_02.glb`

- [ ] **068** | 🟡 MEDIUM | Palm Tree
  - Format: GLB | Path: `public/models/nature/tree_palm.glb`

- [ ] **069** | 🟠 HIGH | Bush - Small rounded
  - Format: GLB | Specs: 200-500 tris
  - Path: `public/models/nature/bush_small.glb`

- [ ] **070** | 🟠 HIGH | Bush - Large rounded
  - Format: GLB | Path: `public/models/nature/bush_large.glb`

- [ ] **071** | 🟡 MEDIUM | Bush - Hedge rectangular
  - Format: GLB | Path: `public/models/nature/hedge_rectangular.glb`

- [ ] **072** | 🟡 MEDIUM | Flower Bed - Circular
  - Format: GLB | Path: `public/models/nature/flowerbed_circular.glb`

- [ ] **073** | 🟡 MEDIUM | Flower Bed - Rectangular
  - Format: GLB | Path: `public/models/nature/flowerbed_rectangular.glb`

- [ ] **074** | 🟡 MEDIUM | Grass Patch
  - Format: GLB | Path: `public/models/nature/grass_patch.glb`

### Park Furniture
- [ ] **075** | 🔴 CRITICAL | Park Bench - Wooden
  - Format: GLB | Specs: 300-800 tris
  - Path: `public/models/props/bench_wooden.glb`

- [ ] **076** | 🟠 HIGH | Park Bench - Metal
  - Format: GLB | Path: `public/models/props/bench_metal.glb`

- [ ] **077** | 🟡 MEDIUM | Park Bench - Modern
  - Format: GLB | Path: `public/models/props/bench_modern.glb`

- [ ] **078** | 🟠 HIGH | Fountain - Classical tiered
  - Format: GLB with water material
  - Path: `public/models/props/fountain_classical.glb`

- [ ] **079** | 🟡 MEDIUM | Fountain - Modern abstract
  - Format: GLB | Path: `public/models/props/fountain_modern.glb`

- [ ] **080** | 🟠 HIGH | Trash Can - Standard
  - Format: GLB | Path: `public/models/props/trashcan_standard.glb`

- [ ] **081** | 🟡 MEDIUM | Trash Can - Recycling bin
  - Format: GLB | Path: `public/models/props/trashcan_recycling.glb`

- [ ] **082** | 🟡 MEDIUM | Picnic Table
  - Format: GLB | Path: `public/models/props/picnic_table.glb`

- [ ] **083** | 🟠 HIGH | Street Lamp - Classical
  - Format: GLB with emissive light
  - Path: `public/models/props/streetlamp_classical.glb`

- [ ] **084** | 🟠 HIGH | Street Lamp - Modern LED
  - Format: GLB | Path: `public/models/props/streetlamp_modern.glb`

- [ ] **085** | 🟡 MEDIUM | Mailbox
  - Format: GLB | Path: `public/models/props/mailbox.glb`

- [ ] **086** | 🟡 MEDIUM | Fire Hydrant
  - Format: GLB | Path: `public/models/props/fire_hydrant.glb`

- [ ] **087** | 🟡 MEDIUM | Bike Rack
  - Format: GLB | Path: `public/models/props/bike_rack.glb`

- [ ] **088** | 🟢 LOW | Playground Slide
  - Format: GLB | Path: `public/models/props/playground_slide.glb`

- [ ] **089** | 🟢 LOW | Playground Swing Set
  - Format: GLB | Path: `public/models/props/playground_swings.glb`

- [ ] **090** | 🟡 MEDIUM | Statue - Abstract art
  - Format: GLB | Path: `public/models/props/statue_abstract.glb`

- [ ] **091** | 🟡 MEDIUM | Statue - Historical figure
  - Format: GLB | Path: `public/models/props/statue_historical.glb`

- [ ] **092** | 🟡 MEDIUM | Gazebo/Pavilion
  - Format: GLB | Path: `public/models/props/gazebo.glb`

---

## CATEGORY 5: STREET & INFRASTRUCTURE

### Roads & Ground
- [ ] **093** | 🔴 CRITICAL | Road Tile - Straight
  - Format: GLB or texture | Specs: Seamless, 1024x1024
  - Path: `public/models/roads/road_straight.glb`

- [ ] **094** | 🔴 CRITICAL | Road Tile - T-intersection
  - Format: GLB | Path: `public/models/roads/road_t_intersection.glb`

- [ ] **095** | 🔴 CRITICAL | Road Tile - 4-way intersection
  - Format: GLB | Path: `public/models/roads/road_4way_intersection.glb`

- [ ] **096** | 🟠 HIGH | Road Tile - Curved
  - Format: GLB | Path: `public/models/roads/road_curved.glb`

- [ ] **097** | 🟠 HIGH | Sidewalk Tile - Straight
  - Format: GLB | Path: `public/models/roads/sidewalk_straight.glb`

- [ ] **098** | 🟠 HIGH | Sidewalk Tile - Corner
  - Format: GLB | Path: `public/models/roads/sidewalk_corner.glb`

- [ ] **099** | 🟡 MEDIUM | Crosswalk Marking
  - Format: GLB or decal texture | Path: `public/models/roads/crosswalk.glb`

- [ ] **100** | 🔴 CRITICAL | Pavement Texture (seamless)
  - Format: PNG/WebP | Specs: 1024x1024 seamless
  - Path: `public/textures/pavement_seamless.png`

- [ ] **101** | 🔴 CRITICAL | Grass Texture (seamless)
  - Format: PNG/WebP | Path: `public/textures/grass_seamless.png`

- [ ] **102** | 🟡 MEDIUM | Dirt/Gravel Texture (seamless)
  - Format: PNG/WebP | Path: `public/textures/dirt_seamless.png`

### Street Objects
- [ ] **103** | 🟠 HIGH | Traffic Light - Standard
  - Format: GLB with emissive materials
  - Path: `public/models/props/traffic_light.glb`

- [ ] **104** | 🟡 MEDIUM | Stop Sign
  - Format: GLB | Path: `public/models/props/stop_sign.glb`

- [ ] **105** | 🟡 MEDIUM | Street Sign Post
  - Format: GLB | Path: `public/models/props/street_sign.glb`

- [ ] **106** | 🟡 MEDIUM | Parking Meter
  - Format: GLB | Path: `public/models/props/parking_meter.glb`

- [ ] **107** | 🟡 MEDIUM | News Stand/Kiosk
  - Format: GLB | Path: `public/models/props/newsstand.glb`

- [ ] **108** | 🟡 MEDIUM | Bus Stop Shelter
  - Format: GLB | Path: `public/models/props/bus_stop.glb`

- [ ] **109** | 🟡 MEDIUM | Phone Booth
  - Format: GLB | Path: `public/models/props/phone_booth.glb`

- [ ] **110** | 🟡 MEDIUM | Awning - Shop front
  - Format: GLB | Path: `public/models/props/awning.glb`

- [ ] **111** | 🟠 HIGH | Dumpster
  - Format: GLB | Path: `public/models/props/dumpster.glb`

- [ ] **112** | 🟡 MEDIUM | Barrier/Bollard
  - Format: GLB | Path: `public/models/props/bollard.glb`

- [ ] **113** | 🟡 MEDIUM | Planter Box - Concrete
  - Format: GLB | Path: `public/models/props/planter_concrete.glb`

- [ ] **114** | 🟡 MEDIUM | Manhole Cover
  - Format: GLB or texture | Path: `public/models/props/manhole.glb`

---

## CATEGORY 6: VEHICLES (Parked/Static)

- [ ] **115** | 🟠 HIGH | Car - Sedan
  - Format: GLB | Specs: 1000-2000 tris
  - Path: `public/models/vehicles/car_sedan.glb`

- [ ] **116** | 🟠 HIGH | Car - SUV
  - Format: GLB | Path: `public/models/vehicles/car_suv.glb`

- [ ] **117** | 🟡 MEDIUM | Car - Sports Car
  - Format: GLB | Path: `public/models/vehicles/car_sports.glb`

- [ ] **118** | 🟡 MEDIUM | Car - Taxi (yellow)
  - Format: GLB | Path: `public/models/vehicles/taxi.glb`

- [ ] **119** | 🟠 HIGH | Police Car
  - Format: GLB | Path: `public/models/vehicles/police_car.glb`
  - Note: For wanted mechanic zones

- [ ] **120** | 🟡 MEDIUM | Delivery Truck
  - Format: GLB | Path: `public/models/vehicles/truck_delivery.glb`

- [ ] **121** | 🟡 MEDIUM | Bus
  - Format: GLB | Path: `public/models/vehicles/bus.glb`

- [ ] **122** | 🟡 MEDIUM | Bicycle
  - Format: GLB | Path: `public/models/vehicles/bicycle.glb`

---

## CATEGORY 7: FOOD ITEMS (NPC Props)

- [ ] **123** | 🔴 CRITICAL | Sandwich
  - Format: GLB | Specs: 100-300 tris
  - Path: `public/models/food/sandwich.glb`

- [ ] **124** | 🔴 CRITICAL | Hot Dog
  - Format: GLB | Path: `public/models/food/hotdog.glb`

- [ ] **125** | 🔴 CRITICAL | Ice Cream Cone
  - Format: GLB | Path: `public/models/food/icecream_cone.glb`

- [ ] **126** | 🟠 HIGH | Coffee Cup
  - Format: GLB | Path: `public/models/food/coffee_cup.glb`

- [ ] **127** | 🟠 HIGH | Pizza Slice
  - Format: GLB | Path: `public/models/food/pizza_slice.glb`

- [ ] **128** | 🟠 HIGH | Burger
  - Format: GLB | Path: `public/models/food/burger.glb`

- [ ] **129** | 🟡 MEDIUM | French Fries
  - Format: GLB | Path: `public/models/food/fries.glb`

- [ ] **130** | 🟡 MEDIUM | Soda Cup
  - Format: GLB | Path: `public/models/food/soda_cup.glb`

- [ ] **131** | 🟡 MEDIUM | Donut
  - Format: GLB | Path: `public/models/food/donut.glb`

- [ ] **132** | 🟡 MEDIUM | Pretzel
  - Format: GLB | Path: `public/models/food/pretzel.glb`

- [ ] **133** | 🟡 MEDIUM | Popcorn Bag
  - Format: GLB | Path: `public/models/food/popcorn.glb`

---

## CATEGORY 8: PARTICLE TEXTURES (2D PNG/Sprite)

- [ ] **134** | 🔴 CRITICAL | Poop Splat Effect (default)
  - Format: PNG transparent | Specs: 512x512
  - Path: `public/textures/particles/splat_default.png`

- [ ] **135** | 🟡 MEDIUM | Poop Splat Variation 2
  - Format: PNG | Path: `public/textures/particles/splat_variation_02.png`

- [ ] **136** | 🟡 MEDIUM | Poop Splat Variation 3
  - Format: PNG | Path: `public/textures/particles/splat_variation_03.png`

- [ ] **137** | 🟠 HIGH | Feather Particle (white)
  - Format: PNG | Specs: 128x128
  - Path: `public/textures/particles/feather_white.png`

- [ ] **138** | 🟡 MEDIUM | Feather Particle (gold)
  - Format: PNG | Path: `public/textures/particles/feather_gold.png`

- [ ] **139** | 🟡 MEDIUM | Speed Lines
  - Format: PNG | Path: `public/textures/particles/speed_lines.png`

- [ ] **140** | 🟡 MEDIUM | Boost Trail
  - Format: PNG | Path: `public/textures/particles/boost_trail.png`

- [ ] **141** | 🔴 CRITICAL | Banking Glow (green)
  - Format: PNG | Path: `public/textures/particles/banking_glow_green.png`

- [ ] **142** | 🟠 HIGH | Coin Sparkle
  - Format: PNG | Path: `public/textures/particles/coin_sparkle.png`

- [ ] **143** | 🟠 HIGH | XP Burst (star)
  - Format: PNG | Path: `public/textures/particles/xp_burst_star.png`

- [ ] **144** | 🟠 HIGH | Hit Flash (red)
  - Format: PNG | Path: `public/textures/particles/hit_flash_red.png`

- [ ] **145** | 🟡 MEDIUM | Smoke Puff
  - Format: PNG | Path: `public/textures/particles/smoke_puff.png`

- [ ] **146** | 🟡 MEDIUM | Dust Cloud
  - Format: PNG | Path: `public/textures/particles/dust_cloud.png`

- [ ] **147** | 🟡 MEDIUM | Heart Icon
  - Format: PNG | Path: `public/textures/particles/heart_icon.png`

- [ ] **148** | 🟡 MEDIUM | Skull Icon
  - Format: PNG | Path: `public/textures/particles/skull_icon.png`

---

## CATEGORY 9: TRAIL EFFECTS (Cosmetic)

- [ ] **149** | 🟡 MEDIUM | Classic White Trail
  - Format: PNG | Path: `public/textures/trails/trail_white.png`

- [ ] **150** | 🟡 MEDIUM | Rainbow Trail
  - Format: PNG | Path: `public/textures/trails/trail_rainbow.png`

- [ ] **151** | 🟡 MEDIUM | Fire Trail
  - Format: PNG | Path: `public/textures/trails/trail_fire.png`

- [ ] **152** | 🟡 MEDIUM | Ice Trail
  - Format: PNG | Path: `public/textures/trails/trail_ice.png`

- [ ] **153** | 🟡 MEDIUM | Electric Trail
  - Format: PNG | Path: `public/textures/trails/trail_electric.png`

- [ ] **154** | 🟡 MEDIUM | Fairy Dust Trail
  - Format: PNG | Path: `public/textures/trails/trail_fairy.png`

- [ ] **155** | 🟡 MEDIUM | Toxic Trail
  - Format: PNG | Path: `public/textures/trails/trail_toxic.png`

- [ ] **156** | 🟢 LOW | Galaxy Trail
  - Format: PNG | Path: `public/textures/trails/trail_galaxy.png`

- [ ] **157** | 🟢 LOW | Hearts Trail
  - Format: PNG | Path: `public/textures/trails/trail_hearts.png`

- [ ] **158** | 🟢 LOW | Money Trail
  - Format: PNG | Path: `public/textures/trails/trail_money.png`

- [ ] **159** | 🟡 MEDIUM | Feather Trail
  - Format: PNG | Path: `public/textures/trails/trail_feathers.png`

- [ ] **160** | 🟡 MEDIUM | Neon Trail
  - Format: PNG | Path: `public/textures/trails/trail_neon.png`

- [ ] **161** | 🟡 MEDIUM | Shadow Trail
  - Format: PNG | Path: `public/textures/trails/trail_shadow.png`

- [ ] **162** | 🟢 LOW | Bubble Trail
  - Format: PNG | Path: `public/textures/trails/trail_bubbles.png`

- [ ] **163** | 🟢 LOW | Leaf Trail
  - Format: PNG | Path: `public/textures/trails/trail_leaves.png`

---

## CATEGORY 10: POOP IMPACT EFFECTS (Cosmetic)

- [ ] **164** | ✅ DONE | Classic Brown Splat (default - see #134)

- [ ] **165** | 🟡 MEDIUM | Rainbow Splat
  - Format: PNG | Path: `public/textures/splats/splat_rainbow.png`

- [ ] **166** | 🟡 MEDIUM | Gold Splat
  - Format: PNG | Path: `public/textures/splats/splat_gold.png`

- [ ] **167** | 🟡 MEDIUM | Glitter Splat
  - Format: PNG | Path: `public/textures/splats/splat_glitter.png`

- [ ] **168** | 🟡 MEDIUM | Neon Splat
  - Format: PNG | Path: `public/textures/splats/splat_neon.png`

- [ ] **169** | 🟡 MEDIUM | Ice Splat
  - Format: PNG | Path: `public/textures/splats/splat_ice.png`

- [ ] **170** | 🟡 MEDIUM | Fire Splat
  - Format: PNG | Path: `public/textures/splats/splat_fire.png`

- [ ] **171** | 🟡 MEDIUM | Toxic Splat
  - Format: PNG | Path: `public/textures/splats/splat_toxic.png`

- [ ] **172** | 🟢 LOW | Heart Splat
  - Format: PNG | Path: `public/textures/splats/splat_hearts.png`

- [ ] **173** | 🟢 LOW | Star Splat
  - Format: PNG | Path: `public/textures/splats/splat_stars.png`

- [ ] **174** | 🟢 LOW | Money Splat
  - Format: PNG | Path: `public/textures/splats/splat_money.png`

- [ ] **175** | 🟢 LOW | Confetti Splat
  - Format: PNG | Path: `public/textures/splats/splat_confetti.png`

---

## CATEGORY 11: UI ELEMENTS (2D Graphics)

### HUD Graphics
- [ ] **176** | 🔴 CRITICAL | Heat Meter - Bar background
  - Format: PNG | Specs: 300x50
  - Path: `public/textures/ui/hud/heat_meter_bg.png`

- [ ] **177** | 🔴 CRITICAL | Heat Meter - Fill gradient
  - Format: PNG | Path: `public/textures/ui/hud/heat_meter_fill.png`

- [ ] **178** | 🔴 CRITICAL | Multiplier Badge
  - Format: PNG | Path: `public/textures/ui/hud/multiplier_badge.png`

- [ ] **179** | 🔴 CRITICAL | Coin Icon
  - Format: PNG | Specs: 64x64
  - Path: `public/textures/ui/hud/coin_icon.png`

- [ ] **180** | 🔴 CRITICAL | XP Bar - Background
  - Format: PNG | Path: `public/textures/ui/hud/xp_bar_bg.png`

- [ ] **181** | 🔴 CRITICAL | XP Bar - Fill
  - Format: PNG | Path: `public/textures/ui/hud/xp_bar_fill.png`

- [ ] **182** | 🟠 HIGH | Level Badge - Frame
  - Format: PNG | Path: `public/textures/ui/hud/level_badge.png`

- [ ] **183** | 🟠 HIGH | Mini-map Border
  - Format: PNG | Path: `public/textures/ui/hud/minimap_border.png`

- [ ] **184** | 🟠 HIGH | Mini-map Background
  - Format: PNG | Path: `public/textures/ui/hud/minimap_bg.png`

- [ ] **185** | 🔴 CRITICAL | Wanted Alert Banner
  - Format: PNG | Path: `public/textures/ui/hud/wanted_alert.png`

- [ ] **186** | 🔴 CRITICAL | Sanctuary Icon
  - Format: PNG | Path: `public/textures/ui/hud/sanctuary_icon.png`

- [ ] **187** | 🟠 HIGH | Player Arrow
  - Format: PNG | Path: `public/textures/ui/hud/player_arrow.png`

- [ ] **188** | 🟡 MEDIUM | Crosshair/Reticle
  - Format: PNG | Path: `public/textures/ui/hud/crosshair.png`

### Menu UI
- [ ] **189** | 🟠 HIGH | Button - Default state
  - Format: PNG | Specs: 300x80
  - Path: `public/textures/ui/menu/button_default.png`

- [ ] **190** | 🟠 HIGH | Button - Hover state
  - Format: PNG | Path: `public/textures/ui/menu/button_hover.png`

- [ ] **191** | 🟠 HIGH | Button - Pressed state
  - Format: PNG | Path: `public/textures/ui/menu/button_pressed.png`

- [ ] **192** | 🟠 HIGH | Button - Disabled state
  - Format: PNG | Path: `public/textures/ui/menu/button_disabled.png`

- [ ] **193** | 🟠 HIGH | Panel Background
  - Format: PNG | Path: `public/textures/ui/menu/panel_bg.png`

- [ ] **194** | 🟡 MEDIUM | Tab Inactive Background
  - Format: PNG | Path: `public/textures/ui/menu/tab_inactive.png`

- [ ] **195** | 🟡 MEDIUM | Tab Active Background
  - Format: PNG | Path: `public/textures/ui/menu/tab_active.png`

- [ ] **196** | 🟡 MEDIUM | Checkbox - Unchecked
  - Format: PNG | Specs: 64x64
  - Path: `public/textures/ui/menu/checkbox_unchecked.png`

- [ ] **197** | 🟡 MEDIUM | Checkbox - Checked
  - Format: PNG | Path: `public/textures/ui/menu/checkbox_checked.png`

- [ ] **198** | 🟡 MEDIUM | Slider Track
  - Format: PNG | Path: `public/textures/ui/menu/slider_track.png`

- [ ] **199** | 🟡 MEDIUM | Slider Handle
  - Format: PNG | Path: `public/textures/ui/menu/slider_handle.png`

- [ ] **200** | 🟡 MEDIUM | Dropdown Arrow
  - Format: PNG | Path: `public/textures/ui/menu/dropdown_arrow.png`

- [ ] **201** | 🟠 HIGH | Close Button (X)
  - Format: PNG | Path: `public/textures/ui/menu/btn_close.png`

- [ ] **202** | 🟠 HIGH | Back Button (Arrow)
  - Format: PNG | Path: `public/textures/ui/menu/btn_back.png`

- [ ] **203** | 🟡 MEDIUM | Settings Gear Icon
  - Format: PNG | Path: `public/textures/ui/menu/icon_settings.png`

- [ ] **204** | 🟡 MEDIUM | Audio Icon - On
  - Format: PNG | Path: `public/textures/ui/menu/icon_audio_on.png`

- [ ] **205** | 🟡 MEDIUM | Audio Icon - Muted
  - Format: PNG | Path: `public/textures/ui/menu/icon_audio_muted.png`

- [ ] **206** | 🟡 MEDIUM | Fullscreen Icon
  - Format: PNG | Path: `public/textures/ui/menu/icon_fullscreen.png`

- [ ] **207** | 🟡 MEDIUM | Exit Icon
  - Format: PNG | Path: `public/textures/ui/menu/icon_exit.png`

### Shop/Cosmetics UI
- [ ] **208** | 🟡 MEDIUM | Cosmetic Card Background
  - Format: PNG | Path: `public/textures/ui/shop/card_bg.png`

- [ ] **209** | 🟡 MEDIUM | Rarity Border - Common (grey)
  - Format: PNG | Path: `public/textures/ui/shop/border_common.png`

- [ ] **210** | 🟡 MEDIUM | Rarity Border - Rare (blue)
  - Format: PNG | Path: `public/textures/ui/shop/border_rare.png`

- [ ] **211** | 🟡 MEDIUM | Rarity Border - Epic (purple)
  - Format: PNG | Path: `public/textures/ui/shop/border_epic.png`

- [ ] **212** | 🟡 MEDIUM | Rarity Border - Legendary (gold)
  - Format: PNG | Path: `public/textures/ui/shop/border_legendary.png`

- [ ] **213** | 🟡 MEDIUM | Lock Icon
  - Format: PNG | Path: `public/textures/ui/shop/icon_locked.png`

- [ ] **214** | 🟡 MEDIUM | Checkmark - Owned
  - Format: PNG | Path: `public/textures/ui/shop/icon_owned.png`

- [ ] **215** | 🟡 MEDIUM | Equipped Badge
  - Format: PNG | Path: `public/textures/ui/shop/badge_equipped.png`

- [ ] **216** | 🟡 MEDIUM | Price Tag Background
  - Format: PNG | Path: `public/textures/ui/shop/price_tag.png`

- [ ] **217** | 🟡 MEDIUM | Coin Currency Icon (UI)
  - Format: PNG | Path: `public/textures/ui/shop/currency_coin.png`

- [ ] **218** | 🟡 MEDIUM | Feather Currency Icon (premium)
  - Format: PNG | Path: `public/textures/ui/shop/currency_feather.png`

### Popup/Notification UI
- [ ] **219** | 🟠 HIGH | Floating Text Background
  - Format: PNG | Path: `public/textures/ui/popups/floating_text_bg.png`

- [ ] **220** | 🔴 CRITICAL | Banking Progress Ring
  - Format: PNG | Path: `public/textures/ui/popups/banking_ring.png`

- [ ] **221** | 🟠 HIGH | Level Up Burst Effect
  - Format: PNG | Path: `public/textures/ui/popups/levelup_burst.png`

- [ ] **222** | 🟡 MEDIUM | Achievement Unlocked Banner
  - Format: PNG | Path: `public/textures/ui/popups/achievement_banner.png`

- [ ] **223** | 🟡 MEDIUM | Mission Complete Banner
  - Format: PNG | Path: `public/textures/ui/popups/mission_complete.png`

- [ ] **224** | 🟠 HIGH | Vignette Overlay (grounded)
  - Format: PNG | Path: `public/textures/ui/popups/vignette_grounded.png`

- [ ] **225** | 🟠 HIGH | Fade Overlay (black)
  - Format: PNG | Path: `public/textures/ui/popups/fade_black.png`

- [ ] **226** | 🟡 MEDIUM | Tutorial Prompt Background
  - Format: PNG | Path: `public/textures/ui/popups/tutorial_prompt.png`

- [ ] **227** | 🟡 MEDIUM | Dialogue Box Background
  - Format: PNG | Path: `public/textures/ui/popups/dialogue_box.png`

- [ ] **228** | 🟡 MEDIUM | Speaker Name Plate
  - Format: PNG | Path: `public/textures/ui/popups/nameplate.png`

---

## CATEGORY 12: NAMEPLATE FRAMES (Cosmetic)

- [ ] **229** | 🟡 MEDIUM | Default Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_default.png`

- [ ] **230** | 🟡 MEDIUM | Bronze Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_bronze.png`

- [ ] **231** | 🟡 MEDIUM | Silver Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_silver.png`

- [ ] **232** | 🟡 MEDIUM | Gold Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_gold.png`

- [ ] **233** | 🟢 LOW | Platinum Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_platinum.png`

- [ ] **234** | 🟡 MEDIUM | Wooden Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_wooden.png`

- [ ] **235** | 🟢 LOW | Ornate Royal Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_royal.png`

- [ ] **236** | 🟢 LOW | Cyberpunk Neon Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_cyberpunk.png`

- [ ] **237** | 🟢 LOW | Nature/Leaf Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_nature.png`

- [ ] **238** | 🟢 LOW | Fire/Flame Frame
  - Format: PNG | Path: `public/textures/ui/nameplates/frame_fire.png`

---

## CATEGORY 13: TITLE BADGES (Text-Based)

*Note: These are text-based and configured in code, no assets needed*

- [x] **239-253** | Titles configured in progression system

---

## CATEGORY 14: AUDIO ASSETS

### Sound Effects - Bird
- [ ] **254** | 🔴 CRITICAL | Wing Flap Sound (loop)
  - Format: MP3/OGG | Duration: ~0.5s loop
  - Path: `public/audio/sfx/bird/wing_flap.mp3`

- [ ] **255** | 🔴 CRITICAL | Dive Whoosh
  - Format: MP3/OGG | Path: `public/audio/sfx/bird/dive_whoosh.mp3`

- [ ] **256** | 🟠 HIGH | Boost Activation
  - Format: MP3/OGG | Path: `public/audio/sfx/bird/boost_activate.mp3`

- [ ] **257** | 🟡 MEDIUM | Hit Surface Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/bird/hit_surface.mp3`

- [ ] **258** | 🟡 MEDIUM | Feather Ruffle
  - Format: MP3/OGG | Path: `public/audio/sfx/bird/feather_ruffle.mp3`

### Sound Effects - Poop
- [ ] **259** | 🔴 CRITICAL | Poop Drop/Launch
  - Format: MP3/OGG | Path: `public/audio/sfx/poop/poop_launch.mp3`

- [ ] **260** | 🔴 CRITICAL | Splat Impact (variation 1)
  - Format: MP3/OGG | Path: `public/audio/sfx/poop/splat_01.mp3`

- [ ] **261** | 🟠 HIGH | Splat Impact (variation 2)
  - Format: MP3/OGG | Path: `public/audio/sfx/poop/splat_02.mp3`

- [ ] **262** | 🟠 HIGH | Splat Impact (variation 3)
  - Format: MP3/OGG | Path: `public/audio/sfx/poop/splat_03.mp3`

### Sound Effects - NPCs
- [ ] **263** | 🔴 CRITICAL | NPC Hit "Agh!" (male 1)
  - Format: MP3/OGG | Path: `public/audio/sfx/npc/hit_male_01.mp3`

- [ ] **264** | 🟠 HIGH | NPC Hit "Agh!" (male 2)
  - Format: MP3/OGG | Path: `public/audio/sfx/npc/hit_male_02.mp3`

- [ ] **265** | 🟠 HIGH | NPC Hit "Agh!" (female 1)
  - Format: MP3/OGG | Path: `public/audio/sfx/npc/hit_female_01.mp3`

- [ ] **266** | 🟠 HIGH | NPC Hit "Agh!" (female 2)
  - Format: MP3/OGG | Path: `public/audio/sfx/npc/hit_female_02.mp3`

- [ ] **267** | 🟡 MEDIUM | Crowd Gasp/Reaction
  - Format: MP3/OGG | Path: `public/audio/sfx/npc/crowd_gasp.mp3`

### Sound Effects - UI
- [ ] **268** | 🔴 CRITICAL | Coin Collect Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/coin_collect.mp3`

- [ ] **269** | 🟠 HIGH | Coin Jingle (multiple)
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/coin_jingle.mp3`

- [ ] **270** | 🟠 HIGH | XP Gain Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/xp_gain.mp3`

- [ ] **271** | 🟠 HIGH | Level Up Fanfare
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/levelup_fanfare.mp3`

- [ ] **272** | 🔴 CRITICAL | Banking Start Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/banking_start.mp3`

- [ ] **273** | 🔴 CRITICAL | Banking Complete Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/banking_complete.mp3`

- [ ] **274** | 🟠 HIGH | Banking Cancel Sound
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/banking_cancel.mp3`

- [ ] **275** | 🟠 HIGH | Button Click
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/button_click.mp3`

- [ ] **276** | 🟡 MEDIUM | Button Hover
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/button_hover.mp3`

- [ ] **277** | 🟡 MEDIUM | Menu Open
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/menu_open.mp3`

- [ ] **278** | 🟡 MEDIUM | Menu Close
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/menu_close.mp3`

- [ ] **279** | 🟡 MEDIUM | Achievement Unlock
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/achievement_unlock.mp3`

- [ ] **280** | 🟠 HIGH | Warning Alert (wanted)
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/warning_alert.mp3`

- [ ] **281** | 🟡 MEDIUM | Notification Ping
  - Format: MP3/OGG | Path: `public/audio/sfx/ui/notification_ping.mp3`

### Sound Effects - Environment
- [ ] **282** | 🟡 MEDIUM | Ambient City Noise (loop)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/city_ambience.mp3`

- [ ] **283** | 🟡 MEDIUM | Car Horn (distant)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/car_horn.mp3`

- [ ] **284** | 🟠 HIGH | Siren (police)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/police_siren.mp3`

- [ ] **285** | 🟡 MEDIUM | Fountain Water (loop)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/fountain_water.mp3`

- [ ] **286** | 🟡 MEDIUM | Wind Ambient (loop)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/wind_loop.mp3`

- [ ] **287** | 🟡 MEDIUM | Park Ambience (birds)
  - Format: MP3/OGG | Path: `public/audio/sfx/ambient/park_birds.mp3`

### Music Tracks
- [ ] **288** | 🟠 HIGH | Main Menu Theme
  - Format: MP3/OGG | Duration: 2-3min loop
  - Path: `public/audio/music/menu_theme.mp3`

- [ ] **289** | 🟠 HIGH | Gameplay - Calm (low heat)
  - Format: MP3/OGG | Path: `public/audio/music/gameplay_calm.mp3`

- [ ] **290** | 🟠 HIGH | Gameplay - Energetic (medium heat)
  - Format: MP3/OGG | Path: `public/audio/music/gameplay_energetic.mp3`

- [ ] **291** | 🟠 HIGH | Gameplay - Intense (high heat)
  - Format: MP3/OGG | Path: `public/audio/music/gameplay_intense.mp3`

- [ ] **292** | 🟡 MEDIUM | Victory/Banking Success Jingle
  - Format: MP3/OGG | Duration: 5-10s
  - Path: `public/audio/music/victory_jingle.mp3`

- [ ] **293** | 🟡 MEDIUM | Defeat/Grounded Music
  - Format: MP3/OGG | Path: `public/audio/music/defeat_theme.mp3`

- [ ] **294** | 🟡 MEDIUM | Level Up Stinger
  - Format: MP3/OGG | Path: `public/audio/music/levelup_stinger.mp3`

- [ ] **295** | 🟢 LOW | Cutscene Music - Dramatic
  - Format: MP3/OGG | Path: `public/audio/music/cutscene_dramatic.mp3`

- [ ] **296** | 🟢 LOW | Cutscene Music - Cheerful
  - Format: MP3/OGG | Path: `public/audio/music/cutscene_cheerful.mp3`

---

## CATEGORY 15: SKYBOX/ENVIRONMENT

- [ ] **297** | 🔴 CRITICAL | Skybox - Daytime (6 textures)
  - Format: PNG/JPG | Specs: 2048x2048 each
  - Path: `public/textures/skybox/day_[px,nx,py,ny,pz,nz].png`

- [ ] **298** | 🟡 MEDIUM | Skybox - Sunset (6 textures)
  - Format: PNG/JPG | Path: `public/textures/skybox/sunset_[px,nx,py,ny,pz,nz].png`

- [ ] **299** | 🟡 MEDIUM | Skybox - Night (6 textures)
  - Format: PNG/JPG | Path: `public/textures/skybox/night_[px,nx,py,ny,pz,nz].png`

- [ ] **300** | 🟡 MEDIUM | Sun Sprite
  - Format: PNG | Path: `public/textures/skybox/sun.png`

- [ ] **301** | 🟡 MEDIUM | Moon Sprite
  - Format: PNG | Path: `public/textures/skybox/moon.png`

- [ ] **302** | 🟡 MEDIUM | Cloud Model (variation 1)
  - Format: GLB | Path: `public/models/environment/cloud_01.glb`

- [ ] **303** | 🟡 MEDIUM | Cloud Model (variation 2)
  - Format: GLB | Path: `public/models/environment/cloud_02.glb`

- [ ] **304** | 🟡 MEDIUM | Cloud Model (variation 3)
  - Format: GLB | Path: `public/models/environment/cloud_03.glb`

---

## CATEGORY 16: WORLD ZONES

- [ ] **305** | 🔴 CRITICAL | Sanctuary Zone Marker (green glow)
  - Format: PNG/GLB | Path: `public/textures/zones/sanctuary_marker.png`

- [ ] **306** | 🟠 HIGH | Hotspot Zone Marker (yellow/orange)
  - Format: PNG | Path: `public/textures/zones/hotspot_marker.png`

- [ ] **307** | 🟡 MEDIUM | Danger Zone Marker (red warning)
  - Format: PNG | Path: `public/textures/zones/danger_marker.png`

- [ ] **308** | 🔴 CRITICAL | Banking Zone Visual (beam of light)
  - Format: PNG/particle | Path: `public/textures/zones/banking_beam.png`

---

## CATEGORY 17: MULTIPLAYER INDICATORS

- [ ] **309** | 🟠 HIGH | Remote Player Nameplate Background
  - Format: PNG | Path: `public/textures/ui/multiplayer/nameplate_bg.png`

- [ ] **310** | 🟠 HIGH | Remote Player Dot (minimap)
  - Format: PNG | Path: `public/textures/ui/multiplayer/player_dot.png`

- [ ] **311** | 🟠 HIGH | Wanted Player Icon (minimap)
  - Format: PNG | Path: `public/textures/ui/multiplayer/wanted_icon.png`

- [ ] **312** | 🟠 HIGH | Ally Player Icon (minimap)
  - Format: PNG | Path: `public/textures/ui/multiplayer/ally_icon.png`

- [ ] **313** | 🟡 MEDIUM | Direction Arrow (to other players)
  - Format: PNG | Path: `public/textures/ui/multiplayer/direction_arrow.png`

---

## CATEGORY 18: LOADING & BRANDING

- [ ] **314** | 🟠 HIGH | Game Logo - "Bird Game 3D"
  - Format: PNG | Specs: 1024x512 transparent
  - Path: `public/textures/branding/logo.png`

- [ ] **315** | 🟠 HIGH | Loading Icon (spinning animation)
  - Format: PNG or GIF | Path: `public/textures/branding/loading_spinner.png`

- [ ] **316** | 🟠 HIGH | Progress Bar
  - Format: PNG | Path: `public/textures/branding/progress_bar.png`

- [ ] **317** | 🟡 MEDIUM | Background Image (loading screen)
  - Format: JPG | Specs: 1920x1080
  - Path: `public/textures/branding/loading_bg.jpg`

- [ ] **318** | 🟢 LOW | Studio Logo
  - Format: PNG | Path: `public/textures/branding/studio_logo.png`

---

## CATEGORY 19: TUTORIAL ICONS

- [ ] **319** | 🟡 MEDIUM | WASD Keys Icon
  - Format: PNG | Specs: 128x128
  - Path: `public/textures/ui/tutorial/keys_wasd.png`

- [ ] **320** | 🟡 MEDIUM | Space Bar Icon
  - Format: PNG | Path: `public/textures/ui/tutorial/key_space.png`

- [ ] **321** | 🟡 MEDIUM | Ctrl Key Icon
  - Format: PNG | Path: `public/textures/ui/tutorial/key_ctrl.png`

- [ ] **322** | 🟡 MEDIUM | Shift Key Icon
  - Format: PNG | Path: `public/textures/ui/tutorial/key_shift.png`

- [ ] **323** | 🟡 MEDIUM | Mouse Click Icon
  - Format: PNG | Path: `public/textures/ui/tutorial/mouse_click.png`

- [ ] **324** | 🟡 MEDIUM | Tab Key Icon
  - Format: PNG | Path: `public/textures/ui/tutorial/key_tab.png`

---

## CATEGORY 20: ACHIEVEMENT ICONS

- [ ] **325** | 🟡 MEDIUM | First Flight Achievement
  - Format: PNG | Specs: 128x128
  - Path: `public/textures/ui/achievements/first_flight.png`

- [ ] **326** | 🟡 MEDIUM | First Hit Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/first_hit.png`

- [ ] **327** | 🟡 MEDIUM | First Banking Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/first_bank.png`

- [ ] **328** | 🟡 MEDIUM | 100 Coins Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/coins_100.png`

- [ ] **329** | 🟡 MEDIUM | 1000 Coins Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/coins_1000.png`

- [ ] **330** | 🟡 MEDIUM | Level 5 Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/level_5.png`

- [ ] **331** | 🟡 MEDIUM | Level 10 Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/level_10.png`

- [ ] **332** | 🟡 MEDIUM | Max Heat Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/max_heat.png`

- [ ] **333** | 🟡 MEDIUM | Wanted Survivor Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/wanted_survivor.png`

- [ ] **334** | 🟡 MEDIUM | Combo Master Achievement
  - Format: PNG | Path: `public/textures/ui/achievements/combo_master.png`

*Additional achievement icons 335-344 as designed*

---

## CATEGORY 21: CUTSCENE ASSETS

- [ ] **345** | 🟢 LOW | Camera Path Markers (invisible helpers)
  - Note: Configured in code, no visual asset needed

- [ ] **346** | 🟢 LOW | Dialogue Portrait - Narrator
  - Format: PNG | Specs: 256x256
  - Path: `public/textures/cutscenes/portrait_narrator.png`

- [ ] **347** | 🟢 LOW | Title Card Background
  - Format: PNG | Path: `public/textures/cutscenes/title_card_bg.png`

- [ ] **348** | 🟢 LOW | Transition Wipe Effect
  - Format: PNG | Path: `public/textures/cutscenes/transition_wipe.png`

---

## PRODUCTION TIMELINE

### Week 1 - CRITICAL Assets (MVP)
**Target: 50 assets**
- 1 Seagull base model
- 3-5 NPCs
- 5 buildings
- 3 trees
- Basic UI (20 elements)
- Essential sounds (10)
- Skybox daytime
- Ground textures

### Week 2 - HIGH Priority (Polish)
**Target: 80 assets**
- More buildings (10+)
- More NPCs (5+)
- Park furniture (10+)
- Vehicles (5)
- Food items (5)
- Complete UI set (30)
- Music tracks (4)

### Week 3-4 - MEDIUM Priority (Content)
**Target: 100 assets**
- Bird cosmetic skins (10)
- Trail effects (15)
- Splat effects (10)
- Nameplate frames (10)
- Additional sounds (20)
- Achievement icons (10)
- Skybox variations

### Post-Launch - LOW Priority (Extras)
**Target: 100+ assets**
- Premium cosmetics
- Seasonal content
- Extra animations
- Cutscene assets
- Additional variations

---

## ASSET SOURCES & TOOLS

### Free Asset Sources
- [Poly Pizza](https://poly.pizza/) - CC0 models
- [Kenney Assets](https://kenney.nl/) - Complete asset packs
- [Freesound.org](https://freesound.org/) - Sound effects
- [Incompetech](https://incompetech.com/) - Royalty-free music
- [Quaternius](http://quaternius.com/) - Low-poly packs

### Creation Tools
- **3D Modeling**: Blender (free)
- **2D Graphics**: GIMP, Photopea, Figma
- **Audio**: Audacity, LMMS
- **Optimization**: gltf-transform

### Optimization Commands
```bash
# Optimize 3D models
npx gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp

# Compress textures
npx sharp-cli resize 1024 1024 input.png --output output.webp
```

---

## NOTES

- **Always check licenses** - Use CC0 or CC-BY for commercial safety
- **Optimize early** - Keep file sizes small for web performance
- **Test in-game** - Assets may look different in the game engine
- **Version control** - Keep originals before optimization
- **Consistent style** - Low-poly, vibrant colors, arcade feel

---

**Good luck with production! 🎮🐦**
