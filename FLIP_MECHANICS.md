# 🎪 Bird Game 3D - Flip Mechanics Guide

Complete guide to all aerial maneuvers and trick system.

## 🎮 Basic Flip Controls

### Standard Flips (360° Rotation)

| Key | Flip Type | Description | Duration |
|-----|-----------|-------------|----------|
| **Q** | Front Flip | Forward 360° pitch rotation | 0.8s |
| **E** | Back Flip | Backward 360° pitch rotation | 0.8s |
| **R** | Left Barrel Roll | 360° roll to the left | 0.8s |
| **F** | Right Barrel Roll | 360° roll to the right | 0.8s |

### Advanced Flips

| Key | Flip Type | Description | Duration |
|-----|-----------|-------------|----------|
| **T** | Corkscrew Left | Spiral rotation combining roll + pitch | 1.0s |
| **Y** | Corkscrew Right | Spiral rotation combining roll + pitch | 1.0s |
| **X** | Side Flip Left | Cartwheel-style rotation to the left | 0.8s |
| **C** | Side Flip Right | Cartwheel-style rotation to the right | 0.8s |
| **V** | Inverted Flip | Half flip (180°) - flies upside down | 0.6s |
| **B** | Aileron Roll | Smooth, slow barrel roll (360°) | 1.2s |

## 🚀 Double Flips (720° Rotation)

Hold **Alt** while pressing any flip key to perform a double flip!

- Takes 1.6x longer than standard flips
- More impressive and earns style points
- Example: **Alt + Q** = Double Front Flip (720°)

## 🎯 Combo System

### How Combos Work
- Perform flips consecutively within a **2-second window**
- Each successful flip adds to your combo counter
- 3+ flips in a row = **Combo Achievement** 🎯
- Combo resets if no flips performed within 2 seconds

### Combo Tips
- Mix different flip types for variety
- Use the 0.2s cooldown between flips to plan your next move
- Double flips take longer but count toward combos
- Watch for console messages showing your combo count!

## ⚙️ Flip Mechanics

### Requirements
- **Must be airborne** - Flips only work when flying
- Cannot flip while grounded or perched
- 0.2 second cooldown between flips

### Rotation Details
- All flips use smooth **ease-in-out** animation curves
- Standard flips: 360° rotation
- Double flips: 720° rotation
- Inverted flip: 180° rotation (half flip)
- Each flip type rotates around different axes:
  - **Front/Back**: X-axis (pitch)
  - **Barrel Rolls**: Z-axis (roll)
  - **Side Flips**: Y-axis (yaw)
  - **Corkscrews**: Combined Z + X axes

## 🎓 Advanced Techniques

### The Corkscrew
Spiral maneuver combining roll and pitch for a dramatic effect. Slower than standard flips but looks incredible!

### The Inverted Flip
Quick half-flip that leaves you flying upside down. Perfect for quick orientation changes or style points.

### The Aileron Roll
Smooth, controlled barrel roll. Takes longer but provides maximum control and grace.

### Combo Chains
String together different flip types for maximum style:
- **Q → E → R → F** (Front → Back → Left Roll → Right Roll)
- **T → Y** (Corkscrew combo)
- **Alt+Q → Alt+E** (Double flip combo)

## 🎮 Remapped Controls

To make room for flip mechanics, the following keys were remapped:

| Old Key | Old Function | New Key | New Function |
|---------|--------------|---------|--------------|
| Q | Boost | **G** | Boost |
| E | Interact | **Z** | Interact |

## 📊 Technical Details

### Flip State Tracking
- **isFlipping**: Boolean flag for active flip
- **flipType**: Current flip maneuver type
- **flipProgress**: 0.0 to 1.0 animation progress
- **flipComboCount**: Number of consecutive flips
- **flipComboTimer**: Time remaining for combo window

### Performance
- Flips are calculated using quaternion math for smooth, gimbal-lock-free rotation
- Efficient easing functions for animation curves
- Minimal performance impact on flight physics

## 🎨 Future Enhancements

Potential additions for future versions:
- Visual particle effects during flips
- Speed boost on successful combos
- Trick scoring system
- Flip achievement unlocks
- Custom flip sequences/macros
- Slow-motion effect during flips
- Trail effects showing flip path

---

**Pro Tip**: Practice your flips at high altitude first - you'll have more time to complete the maneuver before potentially hitting the ground!

**Style Tip**: Mix double flips with standard flips for impressive combo chains that showcase both speed and control!
