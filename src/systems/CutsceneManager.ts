import * as THREE from 'three';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';

/**
 * A cutscene action that can be executed during a cutscene
 */
export interface CutsceneAction {
  type: 'camera' | 'dialogue' | 'wait' | 'callback' | 'fadeIn' | 'fadeOut';
  duration?: number; // Duration in seconds

  // Camera action properties
  cameraPosition?: THREE.Vector3;
  cameraLookAt?: THREE.Vector3;
  cameraEase?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';

  // Dialogue action properties
  text?: string;
  speaker?: string;

  // Callback action properties
  callback?: () => void;
}

/**
 * A complete cutscene with multiple actions
 */
export interface Cutscene {
  id: string;
  actions: CutsceneAction[];
  skippable?: boolean;
  onComplete?: () => void;
}

/**
 * Manages cutscenes in the game
 */
export class CutsceneManager {
  private currentCutscene: Cutscene | null = null;
  private currentActionIndex = 0;
  private actionTimer = 0;
  private isPlaying = false;

  // Camera interpolation
  private startCameraPos = new THREE.Vector3();
  private targetCameraPos = new THREE.Vector3();
  private startLookAt = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();

  // UI elements
  private dialogueBox!: HTMLDivElement;
  private skipButton!: HTMLDivElement;
  private fadeOverlay!: HTMLDivElement;

  // Original camera state
  private originalCameraEnabled = true;
  private thirdPersonCamera: ThirdPersonCamera | null = null;
  private cutsceneCamera: THREE.PerspectiveCamera;

  constructor(thirdPersonCamera: ThirdPersonCamera) {
    this.thirdPersonCamera = thirdPersonCamera;

    // Create a separate camera for cutscenes
    this.cutsceneCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.createUI();
  }

  private createUI(): void {
    // Dialogue box
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.style.position = 'fixed';
    this.dialogueBox.style.bottom = '80px';
    this.dialogueBox.style.left = '50%';
    this.dialogueBox.style.transform = 'translateX(-50%)';
    this.dialogueBox.style.width = '70%';
    this.dialogueBox.style.maxWidth = '800px';
    this.dialogueBox.style.padding = '20px 30px';
    this.dialogueBox.style.background = 'rgba(0, 0, 0, 0.85)';
    this.dialogueBox.style.color = 'white';
    this.dialogueBox.style.fontFamily = 'Arial, sans-serif';
    this.dialogueBox.style.fontSize = '18px';
    this.dialogueBox.style.borderRadius = '10px';
    this.dialogueBox.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    this.dialogueBox.style.zIndex = '9999';
    this.dialogueBox.style.display = 'none';
    this.dialogueBox.style.textAlign = 'center';
    document.body.appendChild(this.dialogueBox);

    // Skip button
    this.skipButton = document.createElement('div');
    this.skipButton.style.position = 'fixed';
    this.skipButton.style.bottom = '20px';
    this.skipButton.style.right = '20px';
    this.skipButton.style.padding = '10px 20px';
    this.skipButton.style.background = 'rgba(255, 255, 255, 0.2)';
    this.skipButton.style.color = 'white';
    this.skipButton.style.fontFamily = 'Arial, sans-serif';
    this.skipButton.style.fontSize = '14px';
    this.skipButton.style.borderRadius = '5px';
    this.skipButton.style.cursor = 'pointer';
    this.skipButton.style.zIndex = '9999';
    this.skipButton.style.display = 'none';
    this.skipButton.textContent = 'Press SPACE to skip';
    this.skipButton.style.userSelect = 'none';
    document.body.appendChild(this.skipButton);

    this.skipButton.addEventListener('click', () => this.skip());

    // Fade overlay
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.style.position = 'fixed';
    this.fadeOverlay.style.top = '0';
    this.fadeOverlay.style.left = '0';
    this.fadeOverlay.style.width = '100%';
    this.fadeOverlay.style.height = '100%';
    this.fadeOverlay.style.background = 'black';
    this.fadeOverlay.style.opacity = '0';
    this.fadeOverlay.style.pointerEvents = 'none';
    this.fadeOverlay.style.zIndex = '9998';
    this.fadeOverlay.style.transition = 'opacity 0.5s';
    document.body.appendChild(this.fadeOverlay);
  }

  /**
   * Start playing a cutscene
   */
  play(cutscene: Cutscene): void {
    if (this.isPlaying) {
      console.warn('A cutscene is already playing!');
      return;
    }

    this.currentCutscene = cutscene;
    this.currentActionIndex = 0;
    this.actionTimer = 0;
    this.isPlaying = true;

    // Show skip button if skippable
    if (cutscene.skippable) {
      this.skipButton.style.display = 'block';
    }

    // Save current camera state
    if (this.thirdPersonCamera) {
      this.startCameraPos.copy(this.thirdPersonCamera.camera.position);
      this.thirdPersonCamera.camera.getWorldDirection(this.startLookAt);
      this.startLookAt.multiplyScalar(10).add(this.thirdPersonCamera.camera.position);
    }

    console.log(`🎬 Starting cutscene: ${cutscene.id}`);
  }

  /**
   * Update the cutscene (call every frame)
   */
  update(dt: number): boolean {
    if (!this.isPlaying || !this.currentCutscene) {
      return false;
    }

    const currentAction = this.currentCutscene.actions[this.currentActionIndex];
    if (!currentAction) {
      this.end();
      return false;
    }

    // Execute action based on type
    switch (currentAction.type) {
      case 'camera':
        this.updateCameraAction(currentAction, dt);
        break;
      case 'dialogue':
        this.updateDialogueAction(currentAction, dt);
        break;
      case 'wait':
        this.actionTimer += dt;
        if (this.actionTimer >= (currentAction.duration || 0)) {
          this.nextAction();
        }
        break;
      case 'callback':
        if (currentAction.callback) {
          currentAction.callback();
        }
        this.nextAction();
        break;
      case 'fadeIn':
        this.fadeOverlay.style.opacity = '1';
        setTimeout(() => this.nextAction(), (currentAction.duration || 1) * 1000);
        break;
      case 'fadeOut':
        this.fadeOverlay.style.opacity = '0';
        setTimeout(() => this.nextAction(), (currentAction.duration || 1) * 1000);
        break;
    }

    return true; // Cutscene is playing
  }

  private updateCameraAction(action: CutsceneAction, dt: number): void {
    if (this.actionTimer === 0) {
      // First frame of camera action - set up interpolation
      if (this.thirdPersonCamera) {
        this.startCameraPos.copy(this.thirdPersonCamera.camera.position);
        this.thirdPersonCamera.camera.getWorldDirection(this.startLookAt);
        this.startLookAt.multiplyScalar(10).add(this.thirdPersonCamera.camera.position);
      }

      if (action.cameraPosition) {
        this.targetCameraPos.copy(action.cameraPosition);
      }
      if (action.cameraLookAt) {
        this.targetLookAt.copy(action.cameraLookAt);
      }
    }

    this.actionTimer += dt;
    const duration = action.duration || 1;
    const progress = Math.min(this.actionTimer / duration, 1);

    // Apply easing
    let easedProgress = progress;
    const ease = action.cameraEase || 'easeInOut';
    if (ease === 'easeInOut') {
      easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    } else if (ease === 'easeIn') {
      easedProgress = progress * progress;
    } else if (ease === 'easeOut') {
      easedProgress = 1 - (1 - progress) * (1 - progress);
    }

    // Interpolate camera position and look-at
    if (this.thirdPersonCamera) {
      this.cutsceneCamera.position.lerpVectors(
        this.startCameraPos,
        this.targetCameraPos,
        easedProgress
      );

      const currentLookAt = new THREE.Vector3().lerpVectors(
        this.startLookAt,
        this.targetLookAt,
        easedProgress
      );
      this.cutsceneCamera.lookAt(currentLookAt);

      // Copy to main camera
      this.thirdPersonCamera.camera.position.copy(this.cutsceneCamera.position);
      this.thirdPersonCamera.camera.quaternion.copy(this.cutsceneCamera.quaternion);
    }

    if (progress >= 1) {
      this.nextAction();
    }
  }

  private updateDialogueAction(action: CutsceneAction, dt: number): void {
    if (this.actionTimer === 0) {
      // First frame - show dialogue
      this.showDialogue(action.text || '', action.speaker);
    }

    this.actionTimer += dt;
    if (this.actionTimer >= (action.duration || 3)) {
      this.hideDialogue();
      this.nextAction();
    }
  }

  private showDialogue(text: string, speaker?: string): void {
    let html = '';
    if (speaker) {
      html += `<div style="font-weight: bold; margin-bottom: 8px; color: #ffd700;">${speaker}</div>`;
    }
    html += `<div>${text}</div>`;

    this.dialogueBox.innerHTML = html;
    this.dialogueBox.style.display = 'block';
  }

  private hideDialogue(): void {
    this.dialogueBox.style.display = 'none';
  }

  private nextAction(): void {
    this.currentActionIndex++;
    this.actionTimer = 0;
  }

  /**
   * Skip the current cutscene
   */
  skip(): void {
    if (!this.currentCutscene?.skippable) {
      return;
    }

    console.log('⏭️ Skipping cutscene');
    this.end();
  }

  /**
   * End the cutscene
   */
  private end(): void {
    this.isPlaying = false;
    this.hideDialogue();
    this.skipButton.style.display = 'none';
    this.fadeOverlay.style.opacity = '0';

    if (this.currentCutscene?.onComplete) {
      this.currentCutscene.onComplete();
    }

    console.log('🎬 Cutscene ended');
    this.currentCutscene = null;
  }

  /**
   * Check if a cutscene is currently playing
   */
  isActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Get the cutscene camera (for rendering)
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.cutsceneCamera;
  }

  /**
   * Handle keyboard input for skipping
   */
  handleInput(key: string): void {
    if (key === ' ' && this.currentCutscene?.skippable) {
      this.skip();
    }
  }
}

// Example cutscene presets
export const EXAMPLE_CUTSCENES = {
  intro: {
    id: 'intro',
    skippable: true,
    actions: [
      {
        type: 'fadeOut' as const,
        duration: 1,
      },
      {
        type: 'camera' as const,
        cameraPosition: new THREE.Vector3(0, 100, 100),
        cameraLookAt: new THREE.Vector3(0, 0, 0),
        duration: 3,
        cameraEase: 'easeInOut' as const,
      },
      {
        type: 'dialogue' as const,
        speaker: 'Narrator',
        text: 'Welcome to the city...',
        duration: 3,
      },
      {
        type: 'camera' as const,
        cameraPosition: new THREE.Vector3(50, 50, 50),
        cameraLookAt: new THREE.Vector3(0, 0, 0),
        duration: 4,
        cameraEase: 'easeInOut' as const,
      },
      {
        type: 'dialogue' as const,
        speaker: 'Narrator',
        text: 'Time to spread your wings and fly!',
        duration: 3,
      },
      {
        type: 'wait' as const,
        duration: 1,
      },
    ],
  } as Cutscene,
};
