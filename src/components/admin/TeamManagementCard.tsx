
import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamManagementCardProps {
  className?: string;
}

const TeamManagementCard = ({ className }: TeamManagementCardProps) => {
  const { game, setGame } = useGame();
  const [isEditing, setIsEditing] = useState(false);
  const [teamEdits, setTeamEdits] = useState<Record<string, string>>({});
  
  if (!game) return null;

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
    
    setGame(updatedGame);
    setIsEditing(false);
  };

  return (
    <Card className={cn("glass-panel", className)}>
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
  );
};

export default TeamManagementCard;
