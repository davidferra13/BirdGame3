import type { NPCType } from '../entities/NPC';

export type MissionType =
  | 'hit_target_count'
  | 'hit_specific_npc'
  | 'reach_heat'
  | 'streak_count'
  | 'bank_amount'
  | 'collect_rings'
  | 'survive_wanted';

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  target: number;
  current: number;
  reward: {
    coins?: number;
    xp?: number;
    feathers?: number;
  };
  completed: boolean;
  npcType?: 'tourist' | 'business' | 'performer' | 'police' | 'chef' | 'treeman';
}

const STORY_MISSIONS: Mission[] = [
  {
    id: 'tutorial_first_hit',
    title: 'Welcome to the Skies',
    description: 'Hit your first NPC',
    type: 'hit_target_count',
    target: 1,
    current: 0,
    reward: { coins: 50, xp: 25 },
    completed: false,
  },
  {
    id: 'tutorial_tourist',
    title: 'Tourist Trouble',
    description: 'Hit 5 tourists',
    type: 'hit_specific_npc',
    target: 5,
    current: 0,
    reward: { coins: 100, xp: 50 },
    completed: false,
    npcType: 'tourist',
  },
  {
    id: 'tutorial_heat',
    title: 'Feeling the Heat',
    description: 'Reach Heat level 10',
    type: 'reach_heat',
    target: 10,
    current: 0,
    reward: { coins: 75, xp: 40 },
    completed: false,
  },
  {
    id: 'tutorial_bank',
    title: 'Banking Basics',
    description: 'Bank 150 coins at the sanctuary',
    type: 'bank_amount',
    target: 150,
    current: 0,
    reward: { coins: 200, xp: 100 },
    completed: false,
  },
  {
    id: 'hot_streak',
    title: 'Hot Streak',
    description: 'Achieve a 5-hit streak',
    type: 'streak_count',
    target: 5,
    current: 0,
    reward: { coins: 150, xp: 75 },
    completed: false,
  },
];

const DAILY_MISSIONS: Mission[] = [
  {
    id: 'daily_business',
    title: 'Business District',
    description: 'Hit 10 business people',
    type: 'hit_specific_npc',
    target: 10,
    current: 0,
    reward: { coins: 200, xp: 100 },
    completed: false,
    npcType: 'business',
  },
  {
    id: 'daily_performer',
    title: 'Show Stopper',
    description: 'Hit 3 street performers',
    type: 'hit_specific_npc',
    target: 3,
    current: 0,
    reward: { coins: 250, xp: 125, feathers: 1 },
    completed: false,
    npcType: 'performer',
  },
  {
    id: 'daily_rings',
    title: 'Ring Master',
    description: 'Fly through 10 flight rings',
    type: 'collect_rings',
    target: 10,
    current: 0,
    reward: { coins: 300, xp: 150 },
    completed: false,
  },
];

export class MissionSystem {
  private storyMissions: Mission[];
  private dailyMissions: Mission[];
  private activeMission: Mission | null = null;
  private completedMissionIds = new Set<string>();

  // UI notification state
  missionCompletedText = '';
  missionCompletedOpacity = 0;
  private missionCompletedTimer = 0;
  private missionCompletedDuration = 3.0;

  constructor() {
    this.storyMissions = [...STORY_MISSIONS];
    this.dailyMissions = [...DAILY_MISSIONS];
    this.selectNextMission();
  }

  update(dt: number): void {
    // Update mission completed notification
    if (this.missionCompletedTimer > 0) {
      this.missionCompletedTimer -= dt;
      const progress = 1 - (this.missionCompletedTimer / this.missionCompletedDuration);

      if (progress < 0.1) {
        this.missionCompletedOpacity = progress / 0.1;
      } else if (progress < 0.8) {
        this.missionCompletedOpacity = 1;
      } else {
        this.missionCompletedOpacity = 1 - ((progress - 0.8) / 0.2);
      }

      if (this.missionCompletedTimer <= 0) {
        this.missionCompletedOpacity = 0;
      }
    }
  }

  recordHit(npcType?: NPCType): void {
    if (!this.activeMission) return;

    if (this.activeMission.type === 'hit_target_count') {
      this.activeMission.current++;
      this.checkCompletion();
    } else if (this.activeMission.type === 'hit_specific_npc' && this.activeMission.npcType === npcType) {
      this.activeMission.current++;
      this.checkCompletion();
    }
  }

  recordHeat(heat: number): void {
    if (!this.activeMission || this.activeMission.type !== 'reach_heat') return;
    this.activeMission.current = Math.max(this.activeMission.current, heat);
    this.checkCompletion();
  }

  recordStreak(streak: number): void {
    if (!this.activeMission || this.activeMission.type !== 'streak_count') return;
    this.activeMission.current = Math.max(this.activeMission.current, streak);
    this.checkCompletion();
  }

  recordBank(amount: number): void {
    if (!this.activeMission || this.activeMission.type !== 'bank_amount') return;
    this.activeMission.current += amount;
    this.checkCompletion();
  }

  recordRingCollection(): void {
    if (!this.activeMission || this.activeMission.type !== 'collect_rings') return;
    this.activeMission.current++;
    this.checkCompletion();
  }

  private checkCompletion(): void {
    if (!this.activeMission) return;

    if (this.activeMission.current >= this.activeMission.target && !this.activeMission.completed) {
      this.activeMission.completed = true;
      this.completedMissionIds.add(this.activeMission.id);
      this.triggerCompletionNotification();

      // Auto-select next mission after 1 second
      setTimeout(() => {
        this.selectNextMission();
      }, 1000);
    }
  }

  private triggerCompletionNotification(): void {
    if (!this.activeMission) return;
    const r = this.activeMission.reward;
    const rewards = [];
    if (r.coins) rewards.push(`+${r.coins} coins`);
    if (r.xp) rewards.push(`+${r.xp} XP`);
    if (r.feathers) rewards.push(`+${r.feathers} feathers`);

    this.missionCompletedText = `MISSION COMPLETE: ${this.activeMission.title}\n${rewards.join(', ')}`;
    this.missionCompletedTimer = this.missionCompletedDuration;
    this.missionCompletedOpacity = 0;
  }

  private selectNextMission(): void {
    // First, check for incomplete story missions
    const nextStory = this.storyMissions.find(m => !this.completedMissionIds.has(m.id));
    if (nextStory) {
      this.activeMission = nextStory;
      return;
    }

    // Then check daily missions
    const nextDaily = this.dailyMissions.find(m => !this.completedMissionIds.has(m.id));
    if (nextDaily) {
      this.activeMission = nextDaily;
      return;
    }

    // No missions left
    this.activeMission = null;
  }

  getActiveMission(): Mission | null {
    return this.activeMission;
  }

  getProgress(): number {
    if (!this.activeMission) return 0;
    return Math.min(this.activeMission.current / this.activeMission.target, 1);
  }

  claimReward(): { coins: number; xp: number; feathers: number } | null {
    if (!this.activeMission || !this.activeMission.completed) return null;

    const r = this.activeMission.reward;
    const reward = { coins: r.coins || 0, xp: r.xp || 0, feathers: r.feathers || 0 };

    // Move to next mission
    this.selectNextMission();

    return reward;
  }

  resetDaily(): void {
    this.dailyMissions.forEach(m => {
      m.current = 0;
      m.completed = false;
      this.completedMissionIds.delete(m.id);
    });
    this.selectNextMission();
  }
}
