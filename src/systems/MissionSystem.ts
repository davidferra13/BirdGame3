import type { NPCType } from '../entities/NPC';

export type MissionType =
  | 'hit_target_count'
  | 'hit_specific_npc'
  | 'reach_heat'
  | 'streak_count'
  | 'bank_amount'
  | 'collect_rings'
  | 'survive_wanted'
  | 'hit_zoo_animals'
  | 'visit_districts';

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

export interface MissionRewardPayout {
  missionId: string;
  title: string;
  reward: {
    coins: number;
    xp: number;
    feathers: number;
  };
}

const STORY_MISSIONS: Mission[] = [
  {
    id: 'tutorial_first_hit',
    title: 'Welcome to the Skies',
    description: 'Land your first playful hit',
    type: 'hit_target_count',
    target: 1,
    current: 0,
    reward: { coins: 50, xp: 25 },
    completed: false,
  },
  {
    id: 'tutorial_tourist',
    title: 'Friendly Faces',
    description: 'Greet 5 tourists with a playful plop',
    type: 'hit_specific_npc',
    target: 5,
    current: 0,
    reward: { coins: 100, xp: 50 },
    completed: false,
    npcType: 'tourist',
  },
  {
    id: 'tutorial_heat',
    title: 'Warm Breeze',
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
    description: 'Settle 150 coins at the sanctuary',
    type: 'bank_amount',
    target: 150,
    current: 0,
    reward: { coins: 200, xp: 100 },
    completed: false,
  },
  {
    id: 'district_stroll',
    title: 'Neighborhood Hopper',
    description: 'Visit 3 different city districts',
    type: 'visit_districts',
    target: 3,
    current: 0,
    reward: { coins: 125, xp: 60 },
    completed: false,
  },
  {
    id: 'hot_streak',
    title: 'Smooth Sailing',
    description: 'Achieve a 5-hit streak',
    type: 'streak_count',
    target: 5,
    current: 0,
    reward: { coins: 150, xp: 75 },
    completed: false,
  },
  {
    id: 'zoo_visit',
    title: 'Zoo Loop',
    description: 'Visit 3 zoo animals with a cheeky drop',
    type: 'hit_zoo_animals',
    target: 3,
    current: 0,
    reward: { coins: 250, xp: 125, feathers: 2 },
    completed: false,
  },
  {
    id: 'zoo_tour',
    title: 'Safari Stroll',
    description: 'Make the rounds with 8 zoo animals',
    type: 'hit_zoo_animals',
    target: 8,
    current: 0,
    reward: { coins: 500, xp: 200, feathers: 5 },
    completed: false,
  },
];

const DAILY_MISSIONS: Mission[] = [
  {
    id: 'daily_business',
    title: 'Morning Commute',
    description: 'Drop in on 10 business people',
    type: 'hit_specific_npc',
    target: 10,
    current: 0,
    reward: { coins: 200, xp: 100 },
    completed: false,
    npcType: 'business',
  },
  {
    id: 'daily_performer',
    title: 'Showtime Stroll',
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
    title: 'Ring Ramble',
    description: 'Fly through 10 flight rings',
    type: 'collect_rings',
    target: 10,
    current: 0,
    reward: { coins: 300, xp: 150 },
    completed: false,
  },
  {
    id: 'daily_districts',
    title: 'Scenic Route',
    description: 'Visit 5 different city districts',
    type: 'visit_districts',
    target: 5,
    current: 0,
    reward: { coins: 225, xp: 120, feathers: 1 },
    completed: false,
  },
  {
    id: 'daily_zoo',
    title: 'Zoo Mischief',
    description: 'Visit 5 zoo animals with a cheeky drop',
    type: 'hit_zoo_animals',
    target: 5,
    current: 0,
    reward: { coins: 350, xp: 175, feathers: 2 },
    completed: false,
  },
];

export class MissionSystem {
  private storyMissions: Mission[];
  private dailyMissions: Mission[];
  private activeMission: Mission | null = null;
  private completedMissionIds = new Set<string>();
  private rewardQueue: MissionRewardPayout[] = [];
  private activeMissionDistricts = new Set<string>();

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

  recordZooHit(): void {
    if (!this.activeMission || this.activeMission.type !== 'hit_zoo_animals') return;
    this.activeMission.current++;
    this.checkCompletion();
  }

  recordDistrictVisit(districtName: string): void {
    if (!this.activeMission || this.activeMission.type !== 'visit_districts') return;
    if (this.activeMissionDistricts.has(districtName)) return;
    this.activeMissionDistricts.add(districtName);
    this.activeMission.current = this.activeMissionDistricts.size;
    this.checkCompletion();
  }

  private checkCompletion(): void {
    if (!this.activeMission) return;

    if (this.activeMission.current >= this.activeMission.target && !this.activeMission.completed) {
      this.activeMission.completed = true;
      this.activeMission.current = this.activeMission.target;
      this.completedMissionIds.add(this.activeMission.id);
      this.queueReward(this.activeMission);
      this.triggerCompletionNotification();
      this.selectNextMission();
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
      this.setActiveMission(nextStory);
      return;
    }

    // Then check daily missions
    const nextDaily = this.dailyMissions.find(m => !this.completedMissionIds.has(m.id));
    if (nextDaily) {
      this.setActiveMission(nextDaily);
      return;
    }

    // No missions left
    this.setActiveMission(null);
  }

  getActiveMission(): Mission | null {
    return this.activeMission;
  }

  getProgress(): number {
    if (!this.activeMission) return 0;
    return Math.min(this.activeMission.current / this.activeMission.target, 1);
  }

  consumeRewardQueue(): MissionRewardPayout[] {
    const rewards = [...this.rewardQueue];
    this.rewardQueue.length = 0;
    return rewards;
  }

  claimReward(): { coins: number; xp: number; feathers: number } | null {
    const nextReward = this.rewardQueue.shift();
    return nextReward ? { ...nextReward.reward } : null;
  }

  resetDaily(): void {
    this.dailyMissions.forEach(m => {
      m.current = 0;
      m.completed = false;
      this.completedMissionIds.delete(m.id);
    });
    this.selectNextMission();
  }

  private queueReward(mission: Mission): void {
    this.rewardQueue.push({
      missionId: mission.id,
      title: mission.title,
      reward: {
        coins: mission.reward.coins || 0,
        xp: mission.reward.xp || 0,
        feathers: mission.reward.feathers || 0,
      },
    });
  }

  private setActiveMission(mission: Mission | null): void {
    this.activeMission = mission;
    this.activeMissionDistricts.clear();
  }
}
