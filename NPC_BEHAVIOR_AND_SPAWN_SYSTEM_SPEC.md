# NPC_BEHAVIOR_AND_SPAWN_SYSTEM_SPEC.md

## Purpose

Define world population density and interaction targets.

---

## 8.1 NPC Types

### Walker (60%)

- Slow
- Predictable path
- +1 Heat
- 10 coins base

### Runner (30%)

- Medium speed
- Occasional direction changes
- +2 Heat
- 15 coins base

### Crowd Cluster (10%)

- 5–8 grouped NPCs
- Each member = 12 coins
- +1 Heat per member
- +4 bonus Heat for first hit

---

## 8.2 Special Comedic NPC Variants

- Businessman with briefcase
- Mime busker
- Jogger
- Tourist with camera
- Street musician
- Dog walker
- Construction worker
- Hot dog vendor
- Stroller parent

These are **cosmetic skins only**.
Behavior type still Walker or Runner.

---

## 8.3 Spawn Logic

| Parameter | Value |
|---|---|
| Base spawn rate | 1 NPC per second per district |
| Hotspot zones | 3 NPCs per second |
| Max active NPCs | Server-defined cap (performance bound) |

---

## 8.4 Movement Rules

- NPCs follow spline paths.
- Occasional random turn events.
- Crowd clusters remain within radius.

---

## 8.5 Hit Reaction

On hit:

1. Flash red
2. Small squash animation
3. Short "agh!" sound
4. Fade after delay

---

## 8.6 Despawn Logic

NPCs despawn when:

- Too far from players
- Max cap exceeded
- After hit (short delay)

---

## 8.7 Density Philosophy

World must feel:

- **Alive**
- **Funny**
- **Not empty**
- **Not overwhelming**
