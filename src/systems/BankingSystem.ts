import { Bird } from '../entities/Bird';
import { Sanctuary } from '../world/Sanctuary';
import { ScoreSystem } from './ScoreSystem';
import { PlayerStateMachine } from './PlayerStateMachine';
import { SCORE } from '../utils/Constants';

export class BankingSystem {
  progress = 0;
  showBankPrompt = false;
  private lastPosition = { x: 0, z: 0 };
  private readonly MOVE_THRESHOLD = 0.5;

  update(
    dt: number,
    bird: Bird,
    sanctuary: Sanctuary,
    score: ScoreSystem,
    playerState: PlayerStateMachine,
  ): void {
    const pos = bird.controller.position;
    const inRange = sanctuary.isInRange(pos);
    const hasCoins = score.coins > 0;
    const state = playerState.state;

    if (inRange && state === 'NORMAL') {
      playerState.enterSanctuary();
    } else if (!inRange && state === 'SANCTUARY') {
      playerState.exitSanctuary();
    } else if (!inRange && state === 'BANKING') {
      playerState.cancelBanking();
      this.progress = 0;
    }

    this.showBankPrompt = playerState.state === 'SANCTUARY' && hasCoins;

    if (state === 'SANCTUARY' && hasCoins && bird.controller.forwardSpeed <= 5) {
      playerState.startBanking();
      this.progress = 0;
      this.lastPosition.x = pos.x;
      this.lastPosition.z = pos.z;
    }

    if (playerState.state === 'BANKING') {
      const dx = pos.x - this.lastPosition.x;
      const dz = pos.z - this.lastPosition.z;
      const moved = Math.sqrt(dx * dx + dz * dz);

      if (moved > this.MOVE_THRESHOLD) {
        playerState.cancelBanking();
        this.progress = 0;
        return;
      }

      this.progress += dt / SCORE.BANK_CHANNEL_TIME;
      this.lastPosition.x = pos.x;
      this.lastPosition.z = pos.z;

      if (this.progress >= 1) {
        this.progress = 1;
      }
    }
  }

  get isComplete(): boolean {
    return this.progress >= 1;
  }

  reset(): void {
    this.progress = 0;
  }
}
