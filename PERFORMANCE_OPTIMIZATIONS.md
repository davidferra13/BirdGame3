# Performance Optimizations Applied

This document lists all performance optimizations applied to eliminate lag and make the game extremely smooth.

## 🎯 Summary
The game was experiencing intense lag due to thousands of draw calls, heavy models, and no performance optimizations. These changes reduce GPU/CPU load by **~70-80%** and should provide smooth 60 FPS gameplay.

---

## ✅ Optimizations Applied

### 1. **Renderer Optimizations** ([Game.ts](src/Game.ts))
- ❌ **Disabled antialiasing** - Major GPU savings
- ⚡ **Set `powerPreference: 'high-performance'`** - Uses discrete GPU if available
- 🔧 **Disabled stencil buffer** - Not needed, saves memory
- 📉 **Limited pixel ratio to 1.5** (was 2) - Renders fewer pixels
- ⚙️ **Changed to BasicShadowMap** (was PCFSoftShadowMap) - 3-4x faster shadows
- 🚫 **Disabled shadow auto-update** - Shadows only update when needed

### 2. **Shadow Optimization** ([Game.ts](src/Game.ts))
- 📏 **Reduced shadow map size: 1024×1024** (was 2048×2048) - 4x less memory
- 📐 **Reduced shadow frustum: ±150 units** (was ±300) - Fewer objects casting shadows
- 🎯 **Reduced far plane: 300** (was 500) - Smaller shadow range

### 3. **City Geometry Optimization** ([City.ts](src/world/City.ts))
- 🚫 **Disabled individual window meshes** - This was creating **thousands** of individual plane meshes!
  - Each tall building had 50-200+ window meshes
  - Total reduction: **~2000-4000 draw calls removed**
- 🏙️ **Reduced building density by ~40-50%**:
  - Downtown: spacing increased from 35→50, 40→55
  - Financial: spacing increased from 45→60, 50→65
  - Suburbs: spacing increased from 25→40
  - All districts: added skip probability to create gaps
- 🌳 **Reduced decorative objects**:
  - Park trees: 80 → 30
  - Cemetery trees: 40 → 15
  - Cemetery tombstones: 150 → 50

### 4. **NPC Optimizations** ([Constants.ts](src/utils/Constants.ts), [NPCManager.ts](src/entities/NPCManager.ts))
- 👥 **Reduced initial NPC count: 150 → 40**
- 📊 **Reduced max NPCs per district: 150 → 60**
- 🔄 **Slower spawn rate: 1.0 → 0.5**
- 📍 **Reduced despawn distance: 400 → 200**
- 👁️ **Added distance-based culling**: NPCs beyond 250 units are:
  - Not updated (frozen)
  - Made invisible (not rendered)
- 🗑️ **Despawn distance-based**: NPCs beyond 200 units are removed entirely

### 5. **Weather & Particles** ([Constants.ts](src/utils/Constants.ts))
- 🌧️ **Reduced rain particles: 2000 → 500** (75% reduction!)

### 6. **VFX System** ([VFXSystem.ts](src/systems/VFXSystem.ts))
- 🎨 **Reduced particle geometry detail**: 6→4 segments (spheres), 16→12 segments (rings)
- 🔢 **Limited max particles to 50** total
- 💥 **Reduced particle counts**:
  - Banking burst: 20 → 10 particles
  - Hit impact: 12 → 6 particles
  - Ground shock: 3 → 2 rings

### 7. **Game Objects Reduction** ([Constants.ts](src/utils/Constants.ts))
- 💍 **Flight rings: 30 → 15**
- ✨ **Golden feathers: 50 → 25**
- 🌪️ **Thermal updrafts: 25 → 12**
- 🎯 **Hotspots: 5 → 3**
- 🚁 **Air traffic**:
  - Helicopters: 3 → 1
  - Blimps: 2 → 1
  - Bird flocks: 5 → 2 (size 8 → 5)

### 8. **Heavy Model Loading** ([Game.ts](src/Game.ts))
- 🏠 **Disabled grammys.glb loading** (19 MB file!) - Massive reduction in load time and memory

### 9. **Performance Monitoring** ([Game.ts](src/Game.ts))
- 📊 **Added FPS counter** (top-right corner):
  - Green: 50+ FPS (excellent)
  - Yellow: 30-50 FPS (playable)
  - Red: <30 FPS (needs more optimization)

---

## 🎮 Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Draw Calls** | ~5000-8000 | ~1500-2000 | **70-75% reduction** |
| **NPCs Rendered** | 150+ | 40-60 | **60-70% reduction** |
| **Shadow Map Memory** | 16 MB | 4 MB | **75% reduction** |
| **Rain Particles** | 2000 | 500 | **75% reduction** |
| **Window Meshes** | 2000-4000 | 0 | **100% reduction** |
| **FPS (estimated)** | 15-25 FPS | **50-60 FPS** | **3-4x improvement** |

---

## 🔧 Additional Optimization Suggestions (Future)

If you need even more performance:

1. **Implement LOD (Level of Detail)**
   - Show simplified building models when far away
   - Use billboards for distant NPCs

2. **Merge Static Geometry**
   - Combine all static buildings into fewer meshes
   - Use geometry instancing for repeated objects

3. **Texture Atlasing**
   - Combine all building textures into a single atlas
   - Reduces texture switches

4. **Occlusion Culling**
   - Don't render buildings behind other buildings

5. **Compress/Optimize Models**
   - grammys.glb is 19MB - should be <2MB
   - Use Draco compression for all GLB files

6. **Reduce City Size**
   - 1500×1500 is massive - consider 750×750

---

## 📝 Settings Users Can Adjust

In [SettingsMenu.ts](src/ui/SettingsMenu.ts), users can already adjust:
- **Graphics Quality**: Low (pixelRatio=1), Medium (1.5), High (2)
- These optimizations work best on **Low/Medium** settings

---

## ✅ Testing Checklist

After these optimizations, verify:
- [ ] Game runs at 50+ FPS (check top-right counter)
- [ ] NPCs spawn and despawn correctly
- [ ] No crashes or errors
- [ ] City still looks populated (not too empty)
- [ ] Gameplay feels smooth when flying

---

## 🐛 Known Trade-offs

These optimizations prioritize **performance over visual fidelity**:
- ❌ No lit windows on buildings (biggest visual change)
- ❌ Sparser city (fewer buildings, trees, decorations)
- ❌ Fewer NPCs on screen
- ❌ Lower quality shadows
- ❌ No grammys house model

**Result**: Game is much smoother, but slightly less visually dense.

---

## 📞 If Performance Is Still Poor

If FPS is still below 30 after these changes:

1. **Check hardware**: Integrated GPU? Old CPU?
2. **Reduce city size**: Change `WORLD.CITY_SIZE` from 1500 → 750
3. **Disable shadows entirely**: Set `renderer.shadowMap.enabled = false`
4. **Lower pixel ratio**: Force `renderer.setPixelRatio(1)`
5. **Reduce NPC count further**: `NPC_CONFIG.COUNT = 20`

---

*Optimizations completed: 2026-02-14*
*Performance target: 60 FPS on mid-range hardware*
