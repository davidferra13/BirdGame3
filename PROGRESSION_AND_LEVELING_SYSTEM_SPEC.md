# PROGRESSION_AND_LEVELING_SYSTEM_SPEC.md

## Purpose

Define why players return daily.

---

## 9.1 XP Formula

```
XP = floor(bankedCoins / 5)
```

XP only earned from banking.

---

## 9.2 Level Curve

- Level 1 → 2: **100 XP**
- Each level = previous × **1.15**
- Cap at **Level 50** (v1)
- Round using `Math.round()`

---

## 9.3 Unlock Types

Levels unlock:

- Cosmetic skins
- Trail effects
- Poop variants (visual only)
- Nameplate badges
- Wing particle effects

**No stat boosts.**

---

## 9.4 Statistics Tracking

Profile tracks:

| Stat |
|---|
| Total NPC hits |
| Total players grounded |
| Total times grounded |
| Highest Heat reached |
| Highest bank streak |
| Lifetime coins earned |

---

## 9.5 Daily Challenges

Examples:

- Bank 500 coins
- Reach 25 Heat
- Ground 1 player
- Hit 30 NPCs

Rewards:

- Coins
- XP
- Cosmetic currency (**Feathers**)

---

## 9.6 Weekly Challenges

Longer goals:

- Bank 5,000 coins
- Reach 40 Heat
- Ground 10 players

---

## 9.7 Idle Soft Progression (Optional)

If low population:

- Daily login bonus
- Minor passive XP for session time
- Seasonal cosmetic ladder

---

## 9.8 Design Philosophy

Progression must:

- **Feel cosmetic-driven**
- **Avoid power imbalance**
- **Encourage replay**
- **Support casual + competitive players**
