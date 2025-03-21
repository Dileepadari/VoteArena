
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Timer from "../Timer";
import QRDisplay from "../QRDisplay";
import { ArrowLeft, ArrowRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameControlsCardProps {
  className?: string;
}

const GameControlsCard = ({ className }: GameControlsCardProps) => {
  const navigate = useNavigate();
  const { 
    game, 
    nextTeam, 
    prevTeam, 
    nextRound, 
    prevRound,
    resetGame,
    timerRunning
  } = useGame();

  if (!game) return null;
  
  const currentTeam = game.teams[game.currentTeamIndex];

  return (
    <Card className={cn("glass-panel", className)}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Game Controls</CardTitle>
            <CardDescription>
              Round {game.currentRound} of {game.totalRounds} • Team {game.currentTeamIndex + 1} of {game.teams.length}
            </CardDescription>
          </div>
          
          <Timer className="ml-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-medium">Current Status</h3>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Current Team</div>
              <div className="text-lg font-medium">{currentTeam.name}</div>
              
              <div className="text-sm text-muted-foreground mt-3 mb-1">Round</div>
              <div className="text-lg font-medium">{game.currentRound}</div>
              
              <div className="text-sm text-muted-foreground mt-3 mb-1">Vote Status</div>
              <div className="text-lg font-medium">
                {timerRunning ? (
                  <span className="text-primary">Voting Open</span>
                ) : (
                  <span className="text-muted-foreground">Voting Closed</span>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate("/results")}
                className="button-scale flex-1"
              >
                <BarChart3 className="mr-1 h-4 w-4" />
                Results
              </Button>
              
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={() => {
                  if (window.confirm("Are you sure you want to reset the game? All data will be lost.")) {
                    resetGame();
                  }
                }}
                className="button-scale flex-1"
              >
                Reset Game
              </Button>
            </div>
          </div>
          
          <QRDisplay 
            teamId={currentTeam.id} 
            round={game.currentRound} 
          />
        </div>
      </CardContent>
      <CardFooter className="flex-col space-y-4">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button 
            onClick={prevTeam}
            variant="outline"
            className="button-scale"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Previous Team
          </Button>
          
          <Button 
            onClick={nextTeam}
            className="button-scale"
          >
            Next Team
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button 
            onClick={prevRound}
            variant="outline"
            className="button-scale"
            disabled={game.currentRound <= 1}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Previous Round
          </Button>
          
          <Button 
            onClick={nextRound}
            className="button-scale"
            disabled={game.currentRound >= game.totalRounds}
          >
            Next Round
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default GameControlsCard;
