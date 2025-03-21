
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

// Votes storage
export const saveVote = (vote: Vote): void => {
  const votes = getVotes();
  votes.push(vote);
  localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
};

export const getVotes = (): Vote[] => {
  const data = localStorage.getItem(VOTES_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const clearVotes = (): void => {
  localStorage.removeItem(VOTES_STORAGE_KEY);
};

export const hasVoted = (teamId: string, round: number): boolean => {
  const deviceId = getDeviceId();
  const votes = getVotes();
  return votes.some(
    (vote) =>
      vote.teamId === teamId &&
      vote.round === round &&
      vote.deviceId === deviceId
  );
};

export const getTeamVotes = (teamId: string, round: number): Vote[] => {
  const votes = getVotes();
  return votes.filter(
    (vote) => vote.teamId === teamId && vote.round === round
  );
};

export const getTeamAverageScore = (teamId: string, round?: number): number => {
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
  
  if (filteredVotes.length === 0) return 0;
  
  const sum = filteredVotes.reduce((acc, vote) => acc + vote.rating, 0);
  return parseFloat((sum / filteredVotes.length).toFixed(1));
};

// Clear all data
export const clearAllData = (): void => {
  clearGame();
  clearVotes();
};
