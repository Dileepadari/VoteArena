import { Game, Vote } from "./types";

const GAME_STORAGE_KEY = "team-vote-game";
const VOTES_STORAGE_KEY = "team-vote-votes";
const DEVICE_ID_KEY = "team-vote-device-id";
const VOTE_BATCH_SIZE = 10; // Batch size for vote processing

// Memory caches
let votesCache: Vote[] | null = null;
let gameCache: Game | null = null;
let voteQueue: Vote[] = [];
let processingVotes = false;

// Cache invalidation timers
let cacheInvalidationTimer: number | null = null;

// Check localStorage availability
export const isLocalStorageAvailable = (): boolean => {
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch (e) {
    return false;
  }
};

// Generate a unique device ID if not exists
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (e) {
      console.warn("LocalStorage unavailable - using memory storage");
    }
  }
  return deviceId;
};

// Game storage with memory fallback
export const saveGame = (game: Game): void => {
  gameCache = game;
  
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
    } catch (e) {
      console.warn("Failed to save game to localStorage - using memory cache");
    }
  }
};

export const getGame = (): Game | null => {
  // Use cache if available
  if (gameCache !== null) {
    return gameCache;
  }
  
  if (isLocalStorageAvailable()) {
    const data = localStorage.getItem(GAME_STORAGE_KEY);
    gameCache = data ? JSON.parse(data) : null;
  }
  
  return gameCache;
};

export const clearGame = (): void => {
  gameCache = null;
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(GAME_STORAGE_KEY);
  }
};

// Process vote queue in batches
const processVoteQueue = async (): Promise<void> => {
  if (processingVotes || voteQueue.length === 0) return;
  
  processingVotes = true;
  
  try {
    // Get current votes
    if (votesCache === null) {
      votesCache = getVotes();
    }
    
    // Process votes in batches
    while (voteQueue.length > 0) {
      const batch = voteQueue.splice(0, Math.min(VOTE_BATCH_SIZE, voteQueue.length));
      votesCache.push(...batch);
      
      // Allow UI thread to breathe
      if (voteQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    // Save to localStorage
    if (isLocalStorageAvailable()) {
      try {
        localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votesCache));
      } catch (e) {
        console.warn("Failed to save votes to localStorage - using memory cache");
      }
    }
    
    // Invalidate score caches
    invalidateScoreCache();
  } finally {
    processingVotes = false;
  }
};

// Performance-optimized votes storage with batching
export const saveVote = (vote: Vote): void => {
  // Add to queue
  voteQueue.push(vote);
  
  // Process queue with debounce
  setTimeout(() => {
    processVoteQueue();
  }, 100);
};

export const getVotes = (): Vote[] => {
  // Use cache if available and no pending votes
  if (votesCache !== null && voteQueue.length === 0) {
    return votesCache;
  }
  
  // Process any pending votes
  if (voteQueue.length > 0 && !processingVotes) {
    processVoteQueue();
  }
  
  // Initialize cache from localStorage
  if (votesCache === null && isLocalStorageAvailable()) {
    const data = localStorage.getItem(VOTES_STORAGE_KEY);
    votesCache = data ? JSON.parse(data) : [];
  } else if (votesCache === null) {
    votesCache = [];
  }
  
  return votesCache;
};

export const clearVotes = (): void => {
  votesCache = null;
  voteQueue = [];
  if (isLocalStorageAvailable()) {
    localStorage.removeItem(VOTES_STORAGE_KEY);
  }
  invalidateScoreCache();
};

export const hasVoted = (teamId: string, round: number): boolean => {
  const deviceId = getDeviceId();
  const votes = getVotes();
  
  // Check pending votes first
  if (voteQueue.some(vote => 
    vote.teamId === teamId && 
    vote.round === round && 
    vote.deviceId === deviceId
  )) {
    return true;
  }
  
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
  // Clear the immediate cache
  Object.keys(averageScoreCache).forEach(key => {
    delete averageScoreCache[key];
  });
  
  // Schedule a periodic cache refresh for long-running sessions
  if (cacheInvalidationTimer === null) {
    cacheInvalidationTimer = window.setInterval(() => {
      Object.keys(averageScoreCache).forEach(key => {
        delete averageScoreCache[key];
      });
    }, 60000); // Refresh cache every minute
  }
};

// Clear all data
export const clearAllData = (): void => {
  clearGame();
  clearVotes();
  invalidateScoreCache();
  votesCache = null;
  voteQueue = [];
  
  // Clear the cache invalidation timer
  if (cacheInvalidationTimer !== null) {
    clearInterval(cacheInvalidationTimer);
    cacheInvalidationTimer = null;
  }
};
