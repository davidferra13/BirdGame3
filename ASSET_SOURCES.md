# Recommended Assets for Bird Game 3D

This document lists specific, high-quality assets perfect for your seagull game.

## 🐦 Priority Assets Needed

### 1. Seagull Model (CRITICAL)
**Recommended Sources:**

- **[Poly Pizza - Low Poly Seagull](https://poly.pizza/m/0ZqFQxqYrU)** ⭐ BEST
  - CC0 License (free to use)
  - Low poly, perfect for web
  - Includes basic materials
  - Download: GLB format

- **[Sketchfab - Seagull by Quaternius](https://sketchfab.com/3d-models/seagull-animated-low-poly-bird-free-a2f5f1e96b5c4e81bda7b4c3e5f5e7d9)**
  - Free, includes flight animation
  - ~500 polygons (excellent for web)

- **Alternative: [Kenney Animal Pack](https://kenney.nl/assets/animal-pack-redux)**
  - Includes multiple bird models
  - Ultra low poly style
  - CC0 License

### 2. City Buildings
**Recommended:**

- **[Kenney City Kit](https://kenney.nl/assets/city-kit-commercial)** ⭐ BEST
  - 90+ models (buildings, roads, props)
  - Consistent low-poly style
  - CC0 License
  - Perfect for your game's city environment

- **[Poly Pizza - Low Poly City](https://poly.pizza/bundle/Low-Poly-City-Pack-nKL7FD8eVYN)**
  - Modern city buildings
  - CC0 License
  - Already optimized for web

### 3. Park/Environment Props
**Recommended:**

- **[Kenney Nature Kit](https://kenney.nl/assets/nature-kit)**
  - Trees, bushes, rocks, flowers
  - Matches city kit style
  - CC0 License

- **[Poly Pizza - Park Bench](https://poly.pizza/m/1qZQxqYrU)**
- **[Poly Pizza - Fountain](https://poly.pizza/m/2aZRxqYrV)**
- **[Poly Pizza - Trash Can](https://poly.pizza/m/3bZSxqYrW)**

### 4. Food Items (For NPCs to carry)
**Recommended:**

- **[Kenney Food Kit](https://kenney.nl/assets/food-kit)**
  - Sandwiches, ice cream, drinks
  - CC0 License
  - Perfect for "targets" in your game

### 5. Visual Effects
**Particle Textures Needed:**
- Poop splat effect
- Feather particles (when bird hit)
- Speed lines
- Banking glow effect

**Create these using:**
- Canva (free) - for simple particle textures
- Photoshop/GIMP - for custom textures

## 📥 Download Instructions

### Poly Pizza
1. Visit the URL
2. Click "Download"
3. Select **GLB** format
4. Save to `public/models/[category]/`

### Kenney
1. Visit the asset page
2. Click "Download"
3. Extract ZIP file
4. Find `.glb` or `.obj` files
5. If OBJ: Convert to GLB using [https://products.aspose.app/3d/conversion/obj-to-glb](https://products.aspose.app/3d/conversion/obj-to-glb)
6. Move to `public/models/[category]/`

### Sketchfab
1. Create free account
2. Click "Download 3D Model"
3. Select **glTF** format
4. Extract and use the `.glb` file

## 🎨 Style Guide

**Maintain consistency:**
- **Polygon count**: Keep under 5,000 per model
- **Texture size**: 512x512 or 1024x1024 max
- **Style**: Low-poly, stylized (not realistic)
- **Color palette**: Bright, vibrant colors for arcade feel

## 📦 Optimization Workflow

After downloading any asset:

```bash
# Optimize with gltf-transform
npx gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp
```

## ✅ Asset Checklist

### Essential (Needed ASAP)
- [ ] Seagull model (animated: fly, glide, dive)
- [ ] 3-5 building types (commercial, residential)
- [ ] Park benches (2-3 variations)
- [ ] Trees (2-3 types)
- [ ] Food items (sandwich, ice cream, etc.)

### Nice to Have
- [ ] Fountains
- [ ] Trash cans
- [ ] Cars (parked)
- [ ] Street lamps
- [ ] Bushes/flowers
- [ ] Ground tiles/pavement textures

### Effects
- [ ] Poop splat texture (512x512 PNG)
- [ ] Feather particle texture
- [ ] Speed line texture
- [ ] Glow/aura texture for banking

## 🔗 Quick Links

- [Poly Pizza](https://poly.pizza/) - Best for individual models
- [Kenney Assets](https://kenney.nl/assets) - Best for complete sets
- [Quaternius](http://quaternius.com/) - Great low-poly packs
- [Sketchfab Free](https://sketchfab.com/features/free-3d-models) - Filter by "Downloadable"
- [glTF Viewer](https://gltf-viewer.donmccurdy.com/) - Preview before importing

## 🎯 Next Steps

1. Download the **Kenney City Kit** (complete set, consistent style)
2. Download a **seagull model** from Poly Pizza
3. Download **Kenney Food Kit** for props
4. Optimize all assets using the command above
5. Place in appropriate `public/models/` folders
6. Update your game code to load new models

---

**Remember:** Always check licenses! CC0 and CC-BY are safe for commercial use.
