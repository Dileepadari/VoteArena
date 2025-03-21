
import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameSetupFormProps {
  className?: string;
}

const GameSetupForm = ({ className }: GameSetupFormProps) => {
  const { createGame } = useGame();
  const [gameName, setGameName] = useState("");
  const [teamCount, setTeamCount] = useState(3);
  const [roundCount, setRoundCount] = useState(2);
  const [timerDuration, setTimerDuration] = useState(60);

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
};

export default GameSetupForm;
