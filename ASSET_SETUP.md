# How to Add Beautiful Pre-Made Cities to Your Game

## Option 1: Quaternius Ultimate City (Recommended - FREE)

### Step 1: Download
1. Go to: http://quaternius.com/packs/ultimatelowpolycity.html
2. Click "Download" (it's free, CC0)
3. Extract the ZIP file

### Step 2: Install
1. Create folder: `public/models/city/`
2. Copy all GLB files from Quaternius pack into `public/models/city/`
3. Your structure should look like:
   ```
   public/
   └── models/
       └── city/
           ├── Building_01.glb
           ├── Building_02.glb
           ├── Road_Straight.glb
           ├── Park_Bench.glb
           └── ... (all the files)
   ```

### Step 3: Load in Game
Replace your current city generation in `src/world/City.ts` with:

```typescript
import * as THREE from 'three';
import { assetLoader } from '../systems/AssetLoader';

export class QuaterniumCity {
  group = new THREE.Group();
  private loadedModels = new Map<string, THREE.Object3D>();

  async init() {
    // Load a few building types
    const buildings = [
      'Building_01.glb',
      'Building_02.glb',
      'Building_03.glb',
      'Building_Skyscraper_01.glb',
      'Building_Office_01.glb',
    ];

    // Load all buildings
    for (const filename of buildings) {
      const model = await assetLoader.loadModel(`/models/city/${filename}`);
      this.loadedModels.set(filename, model);
    }

    // Generate city grid
    this.generateCity();
  }

  private generateCity() {
    const gridSize = 50; // 50x50 city blocks
    const blockSize = 40; // Space between buildings

    for (let x = -gridSize/2; x < gridSize/2; x++) {
      for (let z = -gridSize/2; z < gridSize/2; z++) {
        // Random building
        const buildingNames = Array.from(this.loadedModels.keys());
        const randomBuilding = buildingNames[Math.floor(Math.random() * buildingNames.length)];
        const template = this.loadedModels.get(randomBuilding);

        if (template) {
          const building = template.clone();
          building.position.set(x * blockSize, 0, z * blockSize);

          // Random rotation
          building.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 2;

          // Random scale variation
          const scale = 1 + (Math.random() - 0.5) * 0.3;
          building.scale.set(scale, 1, scale);

          this.group.add(building);
        }
      }
    }
  }
}
```

---

## Option 2: Kay Lousberg City (Beautiful Style)

### Step 1: Download
1. Go to: https://kaylousberg.itch.io/kay-kit-mini-city
2. Download (pay $0 or support the creator)
3. Extract ZIP

### Step 2: Install
1. Create `public/models/kay-city/`
2. Copy GLB files from the pack

### Step 3: Same loading code as above, just change path:
```typescript
const model = await assetLoader.loadModel(`/models/kay-city/${filename}`);
```

---

## Option 3: Sketchfab Pre-Made Cities

### Search & Download:
1. Go to: https://sketchfab.com/search?q=city&type=models
2. Filter: **Free downloads only** + **Downloadable**
3. Find a city you like (examples):
   - "Low Poly City" by various artists
   - "Cartoon City" packs
   - "Pixel City" collections

### Download:
1. Click on model → "Download 3D Model"
2. Choose format: **glTF (.glb)** ✅
3. Save to `public/models/downloaded-city/`

### Load:
```typescript
const city = await assetLoader.loadModel('/models/downloaded-city/scene.glb');
city.scale.set(10, 10, 10); // Adjust scale
this.scene.add(city);
```

---

## Quick Integration Example

Update your `Game.ts` to load a pre-made city:

```typescript
// In Game.ts constructor, replace City creation:

// OLD:
this.city = new City();
this.scene.add(this.city.group);

// NEW:
this.loadBeautifulCity();

// Add this method:
private async loadBeautifulCity(): Promise<void> {
  try {
    // Download a city from Sketchfab or use Quaternius
    const city = await assetLoader.loadModel('/models/beautiful-city/scene.glb');

    // Scale to fit your game (adjust as needed)
    city.scale.set(20, 20, 20);
    city.position.set(0, 0, 0);

    // Enable shadows
    city.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.scene.add(city);
    console.log('✅ Beautiful city loaded!');
  } catch (error) {
    console.error('❌ Failed to load city:', error);
  }
}
```

---

## Specific Download Links (Ready to Use)

### Best Free Cities on Sketchfab:

1. **Low Poly City Pack**
   - https://skfb.ly/6YnPT
   - Click Download → GLB → Use

2. **Cartoon City**
   - https://sketchfab.com/search?q=cartoon+city&type=models
   - Filter by "Downloadable"

3. **Voxel City**
   - https://sketchfab.com/search?q=voxel+city&type=models
   - Great low-poly style

---

## Converting FBX/OBJ to GLB (if needed)

If you download FBX or OBJ files:

### Online Converter:
1. Go to: https://gltf.report/
2. Drag FBX file
3. Download GLB

### OR use Blender (Free):
```bash
1. Install Blender (blender.org)
2. File → Import → FBX
3. File → Export → glTF 2.0 (.glb)
4. Save to public/models/
```

---

## Performance Tips

Large cities can be heavy. Optimize:

```typescript
// LOD (Level of Detail) - only render nearby objects
import { LOD } from 'three';

const lod = new LOD();
lod.addLevel(detailedModel, 0);    // Close
lod.addLevel(mediumModel, 100);    // Medium
lod.addLevel(lowPolyModel, 500);   // Far
this.scene.add(lod);
```

```typescript
// Frustum culling - automatic with Three.js
// Objects outside camera view won't render

// Instancing - reuse geometry for identical buildings
import { InstancedMesh } from 'three';
```

---

## My Recommendation

**Start with Quaternius City Pack:**
1. 100% free, no attribution
2. Already optimized for games
3. GLB format ready
4. Massive variety
5. Takes 5 minutes to set up

Then enhance with:
- Better lighting (HDRIs from Polyhaven)
- Fog/atmosphere
- Post-processing effects

Would you like me to create a loader that automatically downloads and sets up Quaternius city for you?
