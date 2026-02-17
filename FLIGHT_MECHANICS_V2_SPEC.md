# FLIGHT_MECHANICS_V2_SPEC.md

## Purpose

Define flying so it feels powerful, simple, and fun — not technical or punishing.

---

## 7.1 Core Philosophy

Flying must feel effortless.

- No fuel management.
- No stamina drain.
- Player can ascend at will.
- Player descends slowly when no input.
- No hard fall punishment.

---

## 7.2 Movement Model

### Forward Movement

- Constant forward drift when airborne.
- Player controls direction via mouse / right stick.

### Ascend

- Hold **Space** → ascend upward.
- Smooth acceleration curve (0.2s ramp).

### Natural Descent

- No input → slow glide downward.
- Feels like light parachute drift.

### Fast Descent

- Hold **Ctrl** → descend faster.
- Used for dive attacks and sharp repositioning.

---

## 7.3 Turning Model

- Tight turn radius (arcade style)
- Slight banking tilt when turning
- No stall mechanic
- No gravity crash system

---

## 7.4 Ground Mode

When touching ground:

- Player transitions to walk mode.
- Reduced speed.
- Cannot gain Heat.
- Can take off instantly by holding ascend.

---

## 7.5 Boost

- Boost increases speed by ~30%.
- No depletion system.
- Short cooldown (1.5s).
- Boost exists for excitement, not resource management.

---

## 7.6 Camera

Third-person chase camera:

- Slight lag smoothing.
- Zoom adjusts with speed.
- Slight downward tilt so player can see poop trajectory.

Camera must prioritize:

1. Readability of drop zone
2. Awareness of hunters
3. Forward movement clarity

---

## 7.7 Drop Mechanics

- Projectile falls vertically.
- No forward momentum.
- Clean readable arc.
- Slight wind wobble visual (cosmetic only).

---

## 7.8 Design Rule

Flight must feel:

- **Relaxed**
- **Empowered**
- **Responsive**
- **Never stressful**
