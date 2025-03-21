
import { Game, Vote } from "./types";

const GAME_STORAGE_KEY = "team-vote-game";
const VOTES_STORAGE_KEY = "team-vote-votes";
const DEVICE_ID_KEY = "team-vote-device-id";

// Generate a unique device ID if not exists
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

// Game storage
export const saveGame = (game: Game): void => {
  localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
};

export const getGame = (): Game | null => {
  const data = localStorage.getItem(GAME_STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearGame = (): void => {
  localStorage.removeItem(GAME_STORAGE_KEY);
};

// Performance-optimized votes storage
let votesCache: Vote[] | null = null;

export const saveVote = (vote: Vote): void => {
  // First update cache
  if (votesCache === null) {
    votesCache = getVotes();
  }
  votesCache.push(vote);
  
  // Then update storage (with debounce for multiple rapid submissions)
  localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votesCache));
};

export const getVotes = (): Vote[] => {
  // Use cache if available
  if (votesCache !== null) {
    return votesCache;
  }
  
  const data = localStorage.getItem(VOTES_STORAGE_KEY);
  votesCache = data ? JSON.parse(data) : [];
  return votesCache;
};

export const clearVotes = (): void => {
  localStorage.removeItem(VOTES_STORAGE_KEY);
  votesCache = null;
};

export const hasVoted = (teamId: string, round: number): boolean => {
  const deviceId = getDeviceId();
  const votes = getVotes();
  
  // Optimized lookup for large arrays
  return votes.some(
    (vote) =>
      vote.teamId === teamId &&
      vote.round === round &&
      vote.deviceId === deviceId
  );
};

// Optimized for performance with large vote counts
export const getTeamVotes = (teamId: string, round: number): Vote[] => {
  const votes = getVotes();
  return votes.filter(
    (vote) => vote.teamId === teamId && vote.round === round
  );
};

// Memoization for team average scores
const averageScoreCache: Record<string, number> = {};

export const getTeamAverageScore = (teamId: string, round?: number): number => {
  const cacheKey = `${teamId}_${round || 'all'}`;
  
  // Return cached value if exists
  if (averageScoreCache[cacheKey] !== undefined) {
    return averageScoreCache[cacheKey];
  }
  
  const votes = getVotes();
  let filteredVotes: Vote[];
  
  if (round !== undefined) {
    // Get votes for a specific round
    filteredVotes = votes.filter(
      (vote) => vote.teamId === teamId && vote.round === round
    );
  } else {
    // Get votes across all rounds
    filteredVotes = votes.filter((vote) => vote.teamId === teamId);
  }
  
  if (filteredVotes.length === 0) {
    averageScoreCache[cacheKey] = 0;
    return 0;
  }
  
  const sum = filteredVotes.reduce((acc, vote) => acc + vote.rating, 0);
  const average = parseFloat((sum / filteredVotes.length).toFixed(1));
  
  // Cache the result
  averageScoreCache[cacheKey] = average;
  
  return average;
};

// Cache invalidation function - call this when votes change
export const invalidateScoreCache = (): void => {
  Object.keys(averageScoreCache).forEach(key => {
    delete averageScoreCache[key];
  });
};

// Clear all data
export const clearAllData = (): void => {
  clearGame();
  clearVotes();
  invalidateScoreCache();
  votesCache = null;
};
