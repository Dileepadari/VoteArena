
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Timer from "./Timer";
import QRDisplay from "./QRDisplay";
import { ArrowLeft, ArrowRight, Play, BarChart3, Check, Save, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPanelProps {
  className?: string;
}

const AdminPanel = ({ className }: AdminPanelProps) => {
  const navigate = useNavigate();
  const { 
    game, 
    createGame, 
    nextTeam, 
    prevTeam, 
    nextRound, 
    prevRound,
    resetGame, 
    timerRunning,
  } = useGame();
  
  const [gameName, setGameName] = useState("");
  const [teamCount, setTeamCount] = useState(3);
  const [roundCount, setRoundCount] = useState(2);
  const [timerDuration, setTimerDuration] = useState(60);
  const [isEditing, setIsEditing] = useState(false);
  const [teamEdits, setTeamEdits] = useState<Record<string, string>>({});
  
  // If there's no game, show setup form
  if (!game) {
    return (
      <Card className={cn("glass-panel animate-fade-in max-w-md mx-auto", className)}>
        <CardHeader>
          <CardTitle>Create New Game</CardTitle>
          <CardDescription>Set up your team voting session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="game-name">Game Name</Label>
            <Input
              id="game-name"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Enter game name"
              className="focus-within-ring"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="team-count">Number of Teams</Label>
            <Input
              id="team-count"
              type="number"
              min={1}
              max={20}
              value={teamCount}
              onChange={(e) => setTeamCount(parseInt(e.target.value) || 1)}
              className="focus-within-ring"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="round-count">Number of Rounds</Label>
            <Input
              id="round-count"
              type="number"
              min={1}
              max={10}
              value={roundCount}
              onChange={(e) => setRoundCount(parseInt(e.target.value) || 1)}
              className="focus-within-ring"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timer-duration">Timer Duration (seconds)</Label>
            <Input
              id="timer-duration"
              type="number"
              min={10}
              max={300}
              value={timerDuration}
              onChange={(e) => setTimerDuration(parseInt(e.target.value) || 60)}
              className="focus-within-ring"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => createGame(gameName || "Team Vote", teamCount, roundCount, timerDuration)}
            className="w-full button-scale"
            disabled={teamCount < 1 || roundCount < 1 || timerDuration < 10}
          >
            <Play className="mr-2 h-4 w-4" />
            Create Game
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  const currentTeam = game.teams[game.currentTeamIndex];
  
  const handleTeamNameChange = (teamId: string, newName: string) => {
    setTeamEdits({
      ...teamEdits,
      [teamId]: newName,
    });
  };
  
  const saveTeamNames = () => {
    if (!game) return;
    
    const updatedTeams = game.teams.map((team) => ({
      ...team,
      name: teamEdits[team.id] || team.name,
    }));
    
    const updatedGame = {
      ...game,
      teams: updatedTeams,
    };
    
    useGame().setGame(updatedGame);
    setIsEditing(false);
  };
  
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <Card className="glass-panel">
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
      
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Management</CardTitle>
            {isEditing ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={saveTeamNames}
                className="button-scale"
              >
                <Save className="mr-1 h-4 w-4" />
                Save Names
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="button-scale"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit Names
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {game.teams.map((team, index) => (
              <div 
                key={team.id} 
                className={cn(
                  "p-3 rounded-lg flex justify-between items-center",
                  game.currentTeamIndex === index 
                    ? "bg-primary/10 border border-primary/20" 
                    : "bg-muted/50"
                )}
              >
                {isEditing ? (
                  <Input
                    value={teamEdits[team.id] || team.name}
                    onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                    className="focus-within-ring"
                  />
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="font-medium">{team.name}</div>
                    {game.currentTeamIndex === index && (
                      <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded">
                        Current
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
