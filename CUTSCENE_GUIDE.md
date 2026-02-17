# Cutscene System Guide

## Overview
The cutscene system allows you to create cinematic sequences with camera movements, dialogue, fades, and custom callbacks.

## Quick Start

### 1. Add to Game.ts

First, import the CutsceneManager:

```typescript
import { CutsceneManager, Cutscene } from './systems/CutsceneManager';
```

Add it to your Game class properties:

```typescript
private cutsceneManager: CutsceneManager;
```

Initialize it in the constructor (after creating the camera):

```typescript
this.cutsceneManager = new CutsceneManager(this.cameraController);
```

### 2. Update Loop Integration

In your `update(dt: number)` method, add this at the beginning:

```typescript
update(dt: number): void {
  // Update FPS counter
  this.updateFPS(dt);

  // Handle cutscenes
  if (this.cutsceneManager.isActive()) {
    this.cutsceneManager.update(dt);
    return; // Skip normal gameplay during cutscenes
  }

  // ... rest of your update code
}
```

### 3. Handle Input for Skipping

In your input handling, add:

```typescript
// In the update method, before checking for pause
if (this.cutsceneManager.isActive()) {
  if (this.input.isKeyPressed(' ')) {
    this.cutsceneManager.handleInput(' ');
  }
  this.cutsceneManager.update(dt);
  return;
}
```

## Creating Cutscenes

### Example 1: Simple Intro Cutscene

```typescript
const introCutscene: Cutscene = {
  id: 'game-intro',
  skippable: true,
  actions: [
    // Fade in from black
    {
      type: 'fadeOut',
      duration: 1,
    },
    // Pan camera to show the city
    {
      type: 'camera',
      cameraPosition: new THREE.Vector3(0, 150, 200),
      cameraLookAt: new THREE.Vector3(0, 0, 0),
      duration: 4,
      cameraEase: 'easeInOut',
    },
    // Show dialogue
    {
      type: 'dialogue',
      speaker: 'Narrator',
      text: 'Welcome to the city. Time to cause some chaos!',
      duration: 3,
    },
    // Move camera closer to starting position
    {
      type: 'camera',
      cameraPosition: new THREE.Vector3(50, 60, 80),
      cameraLookAt: new THREE.Vector3(0, 20, 0),
      duration: 3,
      cameraEase: 'easeInOut',
    },
    // Another dialogue
    {
      type: 'dialogue',
      text: 'Use WASD to fly and SPACE to drop presents on NPCs!',
      duration: 3,
    },
    // Wait before ending
    {
      type: 'wait',
      duration: 0.5,
    },
  ],
  onComplete: () => {
    console.log('Intro cutscene complete!');
  },
};

// Play the cutscene
this.cutsceneManager.play(introCutscene);
```

### Example 2: Mission Complete Cutscene

```typescript
const missionCompleteCutscene: Cutscene = {
  id: 'mission-complete',
  skippable: true,
  actions: [
    // Zoom in on bird
    {
      type: 'camera',
      cameraPosition: this.bird.controller.position.clone().add(new THREE.Vector3(10, 5, 10)),
      cameraLookAt: this.bird.controller.position.clone(),
      duration: 2,
      cameraEase: 'easeOut',
    },
    // Show success message
    {
      type: 'dialogue',
      speaker: 'Mission Control',
      text: 'Mission complete! Great job!',
      duration: 2,
    },
    // Custom callback to award rewards
    {
      type: 'callback',
      callback: () => {
        this.scoreSystem.coins += 100;
        this.progression.addXP(50);
      },
    },
    // Show reward message
    {
      type: 'dialogue',
      text: '+100 coins, +50 XP',
      duration: 2,
    },
  ],
};
```

### Example 3: Dramatic Wanted Level Cutscene

```typescript
const wantedCutscene: Cutscene = {
  id: 'wanted-level-5',
  skippable: false, // Force player to watch
  actions: [
    // Quick camera shake effect
    {
      type: 'camera',
      cameraPosition: this.cameraController.camera.position.clone().add(new THREE.Vector3(2, 0, 0)),
      cameraLookAt: this.bird.controller.position.clone(),
      duration: 0.1,
      cameraEase: 'linear',
    },
    {
      type: 'camera',
      cameraPosition: this.cameraController.camera.position.clone().add(new THREE.Vector3(-2, 0, 0)),
      cameraLookAt: this.bird.controller.position.clone(),
      duration: 0.1,
      cameraEase: 'linear',
    },
    // Dramatic zoom
    {
      type: 'camera',
      cameraPosition: this.bird.controller.position.clone().add(new THREE.Vector3(0, 20, 30)),
      cameraLookAt: this.bird.controller.position.clone(),
      duration: 1.5,
      cameraEase: 'easeOut',
    },
    // Warning message
    {
      type: 'dialogue',
      speaker: 'ALERT',
      text: '⚠️ MAXIMUM WANTED LEVEL! ⚠️',
      duration: 2,
    },
    // Custom callback to spawn police helicopters
    {
      type: 'callback',
      callback: () => {
        // Spawn extra police or helicopters
        this.airTraffic.spawnPoliceHelicopters(5);
      },
    },
  ],
};
```

## Action Types

### Camera Movement
```typescript
{
  type: 'camera',
  cameraPosition: new THREE.Vector3(x, y, z),  // Target camera position
  cameraLookAt: new THREE.Vector3(x, y, z),     // What the camera looks at
  duration: 3,                                   // Duration in seconds
  cameraEase: 'easeInOut',                      // 'linear', 'easeIn', 'easeOut', 'easeInOut'
}
```

### Dialogue
```typescript
{
  type: 'dialogue',
  speaker: 'Character Name',  // Optional speaker name
  text: 'Dialogue text here',
  duration: 3,                // How long to show (seconds)
}
```

### Wait
```typescript
{
  type: 'wait',
  duration: 2,  // Seconds to wait
}
```

### Callback
```typescript
{
  type: 'callback',
  callback: () => {
    // Execute any custom code here
    this.scoreSystem.coins += 100;
    this.audio.playSound('reward');
  },
}
```

### Fade In (to black)
```typescript
{
  type: 'fadeIn',
  duration: 1,  // Fade duration in seconds
}
```

### Fade Out (from black)
```typescript
{
  type: 'fadeOut',
  duration: 1,  // Fade duration in seconds
}
```

## Integration Points

### On Game Start
In your `Game.ts` constructor or after the intro phase:

```typescript
// Play intro cutscene when game starts
setTimeout(() => {
  this.cutsceneManager.play(introCutscene);
}, 1000);
```

### On Level Up
In your progression system when the player levels up:

```typescript
if (levelsGained > 0) {
  const levelUpCutscene: Cutscene = {
    id: 'level-up',
    skippable: true,
    actions: [
      {
        type: 'dialogue',
        speaker: 'LEVEL UP!',
        text: `You've reached level ${this.progression.level}!`,
        duration: 2,
      },
    ],
  };
  this.cutsceneManager.play(levelUpCutscene);
}
```

### On Mission Start
```typescript
startMission(missionId: string): void {
  const missionData = this.getMissionData(missionId);

  const briefingCutscene: Cutscene = {
    id: `mission-${missionId}-briefing`,
    skippable: true,
    actions: [
      {
        type: 'dialogue',
        speaker: 'Mission Briefing',
        text: missionData.briefing,
        duration: 4,
      },
      {
        type: 'dialogue',
        text: `Objective: ${missionData.objective}`,
        duration: 3,
      },
    ],
    onComplete: () => {
      this.missionSystem.startMission(missionId);
    },
  };

  this.cutsceneManager.play(briefingCutscene);
}
```

## Tips

1. **Keep cutscenes short** - Players want to play, not watch. 10-30 seconds is usually good.

2. **Make them skippable** - Set `skippable: true` for most cutscenes.

3. **Use callbacks for game logic** - Award items, spawn enemies, etc. using callback actions.

4. **Camera ease makes it smooth** - Use 'easeInOut' for most camera movements.

5. **Test camera positions** - Use the browser console to log camera positions:
   ```typescript
   console.log(this.cameraController.camera.position);
   ```

6. **Chain cutscenes** - Use `onComplete` to trigger another cutscene:
   ```typescript
   onComplete: () => {
     this.cutsceneManager.play(nextCutscene);
   }
   ```

## Troubleshooting

**Cutscene not playing?**
- Make sure you're calling `cutsceneManager.update(dt)` in your game loop
- Check that another cutscene isn't already playing

**Camera not moving smoothly?**
- Try different easing options: 'easeInOut', 'easeIn', 'easeOut'
- Increase the duration for slower movements

**Can't skip cutscene?**
- Ensure `skippable: true` is set
- Make sure you're passing keyboard input to `cutsceneManager.handleInput()`

**Dialogue not showing?**
- Check the browser console for errors
- Make sure the text is not empty
- Try increasing the duration

## Example: Complete Integration

Here's a complete example of adding cutscenes to your game start:

```typescript
// In Game.ts, at the end of setupFirstSpawn():

// Create a welcome cutscene
const welcomeCutscene: Cutscene = {
  id: 'welcome',
  skippable: true,
  actions: [
    {
      type: 'fadeOut',
      duration: 0.5,
    },
    {
      type: 'camera',
      cameraPosition: new THREE.Vector3(
        bestBuilding.position.x + 30,
        bestBuilding.height + 50,
        bestBuilding.position.z + 30
      ),
      cameraLookAt: new THREE.Vector3(
        bestBuilding.position.x,
        bestBuilding.height,
        bestBuilding.position.z
      ),
      duration: 3,
      cameraEase: 'easeInOut',
    },
    {
      type: 'dialogue',
      speaker: 'Welcome',
      text: 'Ready to take flight?',
      duration: 2.5,
    },
    {
      type: 'camera',
      cameraPosition: camPos,
      cameraLookAt: lookAt,
      duration: 2,
      cameraEase: 'easeInOut',
    },
    {
      type: 'wait',
      duration: 0.5,
    },
  ],
  onComplete: () => {
    console.log('Welcome cutscene complete - game starting!');
  },
};

// Play after a short delay
setTimeout(() => {
  this.cutsceneManager.play(welcomeCutscene);
}, 500);
```

Enjoy creating cinematic moments in your bird game! 🎬🐦
