
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import VoteInterface from "@/components/VoteInterface";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const Vote = () => {
  const [searchParams] = useSearchParams();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const { game, hasVoted } = useGame();

  useEffect(() => {
    document.title = "Vote | Team Vote";
    
    const teamIdParam = searchParams.get("teamId");
    const roundParam = searchParams.get("round");
    
    if (teamIdParam && roundParam && !isNaN(Number(roundParam))) {
      setTeamId(teamIdParam);
      setRound(Number(roundParam));
      
      // Check if the team and round are valid
      const isTeamValid = game?.teams.some((team) => team.id === teamIdParam);
      const isRoundValid = game && Number(roundParam) > 0 && Number(roundParam) <= game.totalRounds;
      
      setIsValid(Boolean(isTeamValid && isRoundValid));
      
      // Check if user has already voted
      if (isTeamValid && isRoundValid) {
        setHasSubmitted(hasVoted(teamIdParam, Number(roundParam)));
      }
    } else {
      setIsValid(false);
    }
  }, [searchParams, game, hasVoted]);

  const handleVoteSubmitted = () => {
    setHasSubmitted(true);
  };

  const currentTeam = teamId && game?.teams.find((team) => team.id === teamId);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4 page-transition">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Team Vote</h1>
          {currentTeam && (
            <p className="text-muted-foreground">
              {currentTeam.name} • Round {round}
            </p>
          )}
        </div>
        
        {isValid && teamId && round ? (
          <VoteInterface
            teamId={teamId}
            round={round}
            onVoteSubmitted={handleVoteSubmitted}
            className="animate-scale-in"
          />
        ) : (
          <div className="glass-panel p-6 rounded-xl text-center animate-fade-in">
            <p className="mb-4">
              {game 
                ? "Invalid team or round information. Please scan a valid QR code."
                : "No active game session. Please start a game from the admin panel."}
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="button-scale"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Return Home
            </Button>
          </div>
        )}
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Scan a QR code to vote for a team's performance</p>
        </div>
      </div>
    </div>
  );
};

export default Vote;
