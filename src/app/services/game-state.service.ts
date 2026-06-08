import { Injectable, inject, signal } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, docData, setDoc, updateDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

export interface GameResources {
  minerals: number;
  gas: number;
  crystals: number;
  food: number;
}

export interface GameState {
  resources: GameResources;
  skills: Record<string, number>;
}

const DEFAULT_STATE: GameState = {
  resources: {
    minerals: 1000,
    gas: 500,
    crystals: 100,
    food: 2000
  },
  skills: {}
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  // Signals for components to consume
  resources = signal<GameResources>(DEFAULT_STATE.resources);
  skills = signal<Record<string, number>>(DEFAULT_STATE.skills);
  
  private userSub: Subscription | null = null;
  private stateSub: Subscription | null = null;

  constructor() {
    // Listen to auth state changes
    this.userSub = user(this.auth).subscribe(currentUser => {
      if (currentUser) {
        this.loadGameState(currentUser.uid);
      } else {
        this.clearState();
      }
    });
  }

  private loadGameState(uid: string) {
    if (this.stateSub) {
      this.stateSub.unsubscribe();
    }

    const stateRef = doc(this.firestore, `users/${uid}/game/state`);
    
    this.stateSub = docData(stateRef).subscribe(async (data) => {
      if (!data) {
        // Initialize default state in Firestore if it doesn't exist
        await setDoc(stateRef, DEFAULT_STATE);
        this.resources.set(DEFAULT_STATE.resources);
        this.skills.set(DEFAULT_STATE.skills);
      } else {
        const state = data as GameState;
        this.resources.set(state.resources || DEFAULT_STATE.resources);
        this.skills.set(state.skills || {});
      }
    });
  }

  private clearState() {
    if (this.stateSub) {
      this.stateSub.unsubscribe();
      this.stateSub = null;
    }
    this.resources.set(DEFAULT_STATE.resources);
    this.skills.set({});
  }

  // Cost parameter: mapping resource name to amount needed
  canAfford(cost: Partial<GameResources>): boolean {
    const current = this.resources();
    if (cost.minerals && current.minerals < cost.minerals) return false;
    if (cost.gas && current.gas < cost.gas) return false;
    if (cost.crystals && current.crystals < cost.crystals) return false;
    if (cost.food && current.food < cost.food) return false;
    return true;
  }

  async upgradeSkill(skillId: string, cost: Partial<GameResources>) {
    if (!this.canAfford(cost)) {
      throw new Error('Not enough resources');
    }

    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const currentRes = this.resources();
    const newRes = {
      minerals: currentRes.minerals - (cost.minerals || 0),
      gas: currentRes.gas - (cost.gas || 0),
      crystals: currentRes.crystals - (cost.crystals || 0),
      food: currentRes.food - (cost.food || 0),
    };

    const currentSkills = this.skills();
    const currentLevel = currentSkills[skillId] || 0;
    const newSkills = {
      ...currentSkills,
      [skillId]: currentLevel + 1
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    
    // Optimistic update locally
    this.resources.set(newRes);
    this.skills.set(newSkills);

    // Update Firestore
    await updateDoc(stateRef, {
      resources: newRes,
      [`skills.${skillId}`]: currentLevel + 1
    });
  }

  getSkillLevel(skillId: string): number {
    return this.skills()[skillId] || 0;
  }
}
