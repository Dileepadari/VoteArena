
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Game, Team, Vote, GameContextType } from "@/lib/types";
import {
  getGame,
  saveGame,
  saveVote,
  hasVoted as hasVotedStorage,
  getTeamAverageScore as getTeamAvgScore,
  getTeamVotes,
  getDeviceId,
  clearAllData,
  invalidateScoreCache
} from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

// Create context with default values
const GameContext = createContext<GameContextType>({
  game: null,
  setGame: () => {},
  createGame: () => {},
  startTimer: () => {},
  stopTimer: () => {},
  nextTeam: () => {},
  prevTeam: () => {},
  nextRound: () => {},
  prevRound: () => {},
  submitVote: () => false,
  timerRunning: false,
  timeRemaining: 0,
  hasVoted: () => false,
  getTeamAverageScore: () => 0,
  getTeamTotalScore: () => 0,
  voteCount: () => 0,
  resetGame: () => {},
});

// Performance optimization for high concurrency
let voteSubmissionThrottled = false;
const THROTTLE_TIMEOUT = 100; // ms

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [game, setGameState] = useState<Game | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { toast } = useToast();

  // Initialize from local storage
  useEffect(() => {
    const savedGame = getGame();
    if (savedGame) {
      setGameState(savedGame);
      setTimeRemaining(savedGame.timerDuration);
    }
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: number | undefined;
    
    if (timerRunning && timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeRemaining === 0) {
      setTimerRunning(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timeRemaining]);

  // Game management functions
  const setGame = useCallback((newGame: Game | null) => {
    setGameState(newGame);
    if (newGame) {
      saveGame(newGame);
      setTimeRemaining(newGame.timerDuration);
    }
  }, []);

  const createGame = useCallback((
    name: string,
    teamCount: number,
    roundCount: number,
    timerDuration: number
  ) => {
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
      id: `team_${i + 1}_${Date.now()}`,
      name: `Team ${i + 1}`,
      scores: {},
    }));

    const newGame: Game = {
      id: `game_${Date.now()}`,
      name,
      teams,
      currentRound: 1,
      totalRounds: roundCount,
      currentTeamIndex: 0,
      timerDuration,
      isActive: true,
      dateCreated: new Date().toISOString(),
    };

    setGame(newGame);
    toast({
      title: "Game Created",
      description: `${name} has been created with ${teamCount} teams and ${roundCount} rounds.`,
    });
  }, [setGame, toast]);

  const startTimer = useCallback(() => {
    if (game && !timerRunning) {
      setTimerRunning(true);
      toast({
        title: "Timer Started",
        description: "The voting period has begun!",
      });
    }
  }, [game, timerRunning, toast]);

  const stopTimer = useCallback(() => {
    if (timerRunning) {
      setTimerRunning(false);
      toast({
        title: "Timer Stopped",
        description: "The voting period has been paused.",
      });
    }
  }, [timerRunning, toast]);

  const nextTeam = useCallback(() => {
    if (!game) return;
    
    const nextIndex = (game.currentTeamIndex + 1) % game.teams.length;
    
    const updatedGame = {
      ...game,
      currentTeamIndex: nextIndex,
    };
    
    setGame(updatedGame);
    setTimeRemaining(updatedGame.timerDuration);
    setTimerRunning(false);
    
    toast({
      title: "Next Team",
      description: `Now voting for ${game.teams[nextIndex].name}`,
    });
  }, [game, setGame, toast]);

  const prevTeam = useCallback(() => {
    if (!game) return;
    
    const prevIndex = (game.currentTeamIndex - 1 + game.teams.length) % game.teams.length;
    
    const updatedGame = {
      ...game,
      currentTeamIndex: prevIndex,
    };
    
    setGame(updatedGame);
    setTimeRemaining(updatedGame.timerDuration);
    setTimerRunning(false);
    
    toast({
      title: "Previous Team",
      description: `Now voting for ${game.teams[prevIndex].name}`,
    });
  }, [game, setGame, toast]);

  const nextRound = useCallback(() => {
    if (!game || game.currentRound >= game.totalRounds) return;
    
    const updatedGame = {
      ...game,
      currentRound: game.currentRound + 1,
      currentTeamIndex: 0,
    };
    
    setGame(updatedGame);
    setTimeRemaining(updatedGame.timerDuration);
    setTimerRunning(false);
    
    toast({
      title: "Next Round",
      description: `Round ${updatedGame.currentRound} has started!`,
    });
  }, [game, setGame, toast]);

  const prevRound = useCallback(() => {
    if (!game || game.currentRound <= 1) return;
    
    const updatedGame = {
      ...game,
      currentRound: game.currentRound - 1,
      currentTeamIndex: 0,
    };
    
    setGame(updatedGame);
    setTimeRemaining(updatedGame.timerDuration);
    setTimerRunning(false);
    
    toast({
      title: "Previous Round",
      description: `Returned to Round ${updatedGame.currentRound}`,
    });
  }, [game, setGame, toast]);

  // Optimized for high-concurrency vote submission
  const submitVote = useCallback((teamId: string, round: number, rating: number): boolean => {
    // Check if already voted
    if (hasVotedStorage(teamId, round)) {
      toast({
        title: "Already Voted",
        description: "You've already submitted a vote for this team in this round.",
        variant: "destructive",
      });
      return false;
    }
    
    // Throttle submissions to prevent localStorage hammering
    if (voteSubmissionThrottled) {
      setTimeout(() => {
        const vote: Vote = {
          teamId,
          round,
          rating,
          deviceId: getDeviceId(),
          timestamp: new Date().toISOString(),
        };
        
        saveVote(vote);
        invalidateScoreCache();
      }, Math.random() * THROTTLE_TIMEOUT);
      
      toast({
        title: "Vote Submitted",
        description: `You rated the team ${rating} out of 5!`,
      });
      
      return true;
    }
    
    // Normal submission
    const vote: Vote = {
      teamId,
      round,
      rating,
      deviceId: getDeviceId(),
      timestamp: new Date().toISOString(),
    };
    
    saveVote(vote);
    invalidateScoreCache();
    
    // Throttle for a short period
    voteSubmissionThrottled = true;
    setTimeout(() => {
      voteSubmissionThrottled = false;
    }, THROTTLE_TIMEOUT);
    
    toast({
      title: "Vote Submitted",
      description: `You rated the team ${rating} out of 5!`,
    });
    
    return true;
  }, [toast]);

  const hasVoted = useCallback((teamId: string, round: number): boolean => {
    return hasVotedStorage(teamId, round);
  }, []);

  const getTeamAverageScore = useCallback((teamId: string, round?: number): number => {
    return getTeamAvgScore(teamId, round);
  }, []);

  const getTeamTotalScore = useCallback((teamId: string): number => {
    if (!game) return 0;
    
    let total = 0;
    for (let i = 1; i <= game.totalRounds; i++) {
      total += getTeamAvgScore(teamId, i);
    }
    
    return parseFloat((total).toFixed(1));
  }, [game]);

  const voteCount = useCallback((teamId: string, round: number): number => {
    return getTeamVotes(teamId, round).length;
  }, []);

  const resetGame = useCallback(() => {
    clearAllData();
    setGameState(null);
    setTimeRemaining(0);
    setTimerRunning(false);
    toast({
      title: "Game Reset",
      description: "All game data has been cleared.",
    });
  }, [toast]);

  return (
    <GameContext.Provider
      value={{
        game,
        setGame,
        createGame,
        startTimer,
        stopTimer,
        nextTeam,
        prevTeam,
        nextRound,
        prevRound,
        submitVote,
        timerRunning,
        timeRemaining,
        hasVoted,
        getTeamAverageScore,
        getTeamTotalScore,
        voteCount,
        resetGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
