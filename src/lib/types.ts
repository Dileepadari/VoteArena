
export interface Team {
  id: string;
  name: string;
  scores: Record<number, number[]>; // round -> array of ratings
}

export interface Game {
  id: string;
  name: string;
  teams: Team[];
  currentRound: number;
  totalRounds: number;
  currentTeamIndex: number;
  timerDuration: number; // in seconds
  isActive: boolean;
  dateCreated: string;
}

export interface Vote {
  teamId: string;
  round: number;
  rating: number;
  deviceId: string;
  timestamp: string;
}

export type GameContextType = {
  game: Game | null;
  setGame: (game: Game | null) => void;
  createGame: (name: string, teamCount: number, roundCount: number, timerDuration: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
  nextTeam: () => void;
  prevTeam: () => void;
  nextRound: () => void;
  prevRound: () => void;
  submitVote: (teamId: string, round: number, rating: number) => boolean;
  timerRunning: boolean;
  timeRemaining: number;
  hasVoted: (teamId: string, round: number) => boolean;
  getTeamAverageScore: (teamId: string, round?: number) => number;
  getTeamTotalScore: (teamId: string) => number;
  voteCount: (teamId: string, round: number) => number;
  resetGame: () => void;
};
