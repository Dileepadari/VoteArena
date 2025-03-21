
import React, { createContext, useContext, useState, useEffect } from "react";
import { Game, Team, Vote, GameContextType } from "@/lib/types";
import {
  getGame,
  saveGame,
  saveVote,
  hasVoted as hasVotedStorage,
  getTeamAverageScore as getTeamAvgScore,
  getTeamVotes,
  getDeviceId,
  clearAllData
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
  const setGame = (newGame: Game | null) => {
    setGameState(newGame);
    if (newGame) {
      saveGame(newGame);
      setTimeRemaining(newGame.timerDuration);
    }
  };

  const createGame = (
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
  };

  const startTimer = () => {
    if (game && !timerRunning) {
      setTimerRunning(true);
      toast({
        title: "Timer Started",
        description: "The voting period has begun!",
      });
    }
  };

  const stopTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      toast({
        title: "Timer Stopped",
        description: "The voting period has been paused.",
      });
    }
  };

  const nextTeam = () => {
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
  };

  const prevTeam = () => {
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
  };

  const nextRound = () => {
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
  };

  const prevRound = () => {
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
  };

  const submitVote = (teamId: string, round: number, rating: number): boolean => {
    if (hasVotedStorage(teamId, round)) {
      toast({
        title: "Already Voted",
        description: "You've already submitted a vote for this team in this round.",
        variant: "destructive",
      });
      return false;
    }
    
    const vote: Vote = {
      teamId,
      round,
      rating,
      deviceId: getDeviceId(),
      timestamp: new Date().toISOString(),
    };
    
    saveVote(vote);
    
    toast({
      title: "Vote Submitted",
      description: `You rated the team ${rating} out of 5!`,
    });
    
    return true;
  };

  const hasVoted = (teamId: string, round: number): boolean => {
    return hasVotedStorage(teamId, round);
  };

  const getTeamAverageScore = (teamId: string, round?: number): number => {
    return getTeamAvgScore(teamId, round);
  };

  const getTeamTotalScore = (teamId: string): number => {
    if (!game) return 0;
    
    let total = 0;
    for (let i = 1; i <= game.totalRounds; i++) {
      total += getTeamAvgScore(teamId, i);
    }
    
    return parseFloat((total).toFixed(1));
  };

  const voteCount = (teamId: string, round: number): number => {
    return getTeamVotes(teamId, round).length;
  };

  const resetGame = () => {
    clearAllData();
    setGameState(null);
    setTimeRemaining(0);
    setTimerRunning(false);
    toast({
      title: "Game Reset",
      description: "All game data has been cleared.",
    });
  };

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
