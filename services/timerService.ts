import { TimerState, TimerType } from '../types';

const LS_KEY = 'edu_timer_state';

// Default initial state
const DEFAULT_STATE: TimerState = {
  type: 'digital',
  isRunning: false,
  totalDuration: 300, // 5 minutes default
  remainingTime: 300,
  lastUpdated: Date.now(),
  isMuted: false,
};

export const getTimerState = (): TimerState => {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return DEFAULT_STATE;
  
  const state: TimerState = JSON.parse(stored);
  
  // Sync logic: If running, calculate actual remaining time based on elapsed wall-clock time
  if (state.isRunning) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
    const newRemaining = Math.max(0, state.remainingTime - elapsedSeconds);
    
    // Return the calculated state (but don't save to LS immediately to avoid write spam)
    return {
        ...state,
        remainingTime: newRemaining,
        // If time ran out while away, stop it
        isRunning: newRemaining > 0, 
    };
  }
  
  return state;
};

export const updateTimerState = (updates: Partial<TimerState>) => {
  const current = getTimerState();
  
  // If we are starting or pausing, we need to update the timestamp
  // If we are just changing type, we might want to reset
  
  const newState: TimerState = {
    ...current,
    ...updates,
    lastUpdated: Date.now(),
  };

  // Logic: changing type resets the timer
  if (updates.type && updates.type !== current.type) {
    newState.isRunning = false;
    // Keep duration or reset? Usually reset makes sense or keep if just switching view
    // PRD says: "Switching alerts and resets"
    // We'll handle the alert in UI, here we just ensure consistency
  }

  localStorage.setItem(LS_KEY, JSON.stringify(newState));
  return newState;
};

// Helper for clients to calculate precise time between polls
export const calculateRemaining = (state: TimerState): number => {
    if (!state.isRunning) return state.remainingTime;
    const now = Date.now();
    const elapsed = Math.floor((now - state.lastUpdated) / 1000);
    return Math.max(0, state.remainingTime - elapsed);
};
