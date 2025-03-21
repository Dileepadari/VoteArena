
import React, { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Star, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";

interface ResultsDisplayProps {
  className?: string;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ className }) => {
  const { game, getTeamAverageScore, getTeamTotalScore, voteCount } = useGame();
  const [tab, setTab] = useState("overview");
  const [sortedTeams, setSortedTeams] = useState<{ id: string; name: string; score: number }[]>([]);
  
  useEffect(() => {
    if (!game) return;
    
    // Calculate total scores and sort teams
    const teamsWithScores = game.teams.map((team) => ({
      id: team.id,
      name: team.name,
      score: getTeamTotalScore(team.id),
    }));
    
    // Sort by score in descending order
    const sorted = [...teamsWithScores].sort((a, b) => b.score - a.score);
    setSortedTeams(sorted);
  }, [game, getTeamTotalScore]);
  
  if (!game) {
    return (
      <Card className={cn("glass-panel", className)}>
        <CardContent className="p-6 text-center">
          <p>No active game. Start a game to see results.</p>
        </CardContent>
      </Card>
    );
  }
  
  // Prepare data for charts
  const overviewData = sortedTeams.map((team) => ({
    name: team.name,
    score: team.score,
  }));
  
  const roundsData = () => {
    if (!game) return [];
    
    return game.teams.map((team) => {
      const data: Record<string, any> = { name: team.name };
      
      for (let i = 1; i <= game.totalRounds; i++) {
        data[`Round ${i}`] = getTeamAverageScore(team.id, i);
      }
      
      return data;
    });
  };
  
  const participationData = () => {
    if (!game) return [];
    
    return game.teams.map((team) => {
      const data: Record<string, any> = { name: team.name };
      
      for (let i = 1; i <= game.totalRounds; i++) {
        data[`Round ${i}`] = voteCount(team.id, i);
      }
      
      return data;
    });
  };
  
  // Generate random colors for chart lines
  const getColor = (index: number) => {
    const colors = [
      "hsl(var(--primary))",
      "#FF6B6B",
      "#4ECDC4",
      "#FFD166",
      "#06D6A0",
      "#118AB2",
    ];
    return colors[index % colors.length];
  };
  
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="glass-panel mb-4 grid grid-cols-3 w-full p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Leaderboard</span>
          </TabsTrigger>
          <TabsTrigger value="rounds" className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Round Scores</span>
          </TabsTrigger>
          <TabsTrigger value="participation" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Participation</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-0">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Final Leaderboard</CardTitle>
              <CardDescription>Total scores across all rounds</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedTeams.length > 0 ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {sortedTeams.map((team, index) => (
                      <div
                        key={team.id}
                        className={cn(
                          "flex items-center p-4 rounded-lg transition-all",
                          index === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                        )}
                      >
                        <div className="font-bold text-2xl w-10 text-center">
                          {index + 1}
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="font-medium">{team.name}</div>
                        </div>
                        <div className="font-bold text-2xl">
                          {team.score.toFixed(1)}
                        </div>
                        {index === 0 && (
                          <div className="ml-3">
                            <Trophy className="h-5 w-5 text-primary fill-current" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="h-64 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overviewData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            background: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }} 
                        />
                        <Bar 
                          dataKey="score" 
                          name="Total Score" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6">
                  <p>No voting data available yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="rounds" className="mt-0">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Round-by-Round Scores</CardTitle>
              <CardDescription>Performance in each round</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={roundsData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" domain={[0, 5]} />
                    <Tooltip 
                      contentStyle={{ 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }} 
                    />
                    <Legend />
                    {Array.from({ length: game.totalRounds }, (_, i) => i + 1).map((round) => (
                      <Line
                        key={round}
                        type="monotone"
                        dataKey={`Round ${round}`}
                        stroke={getColor(round - 1)}
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {game.teams.map((team, index) => (
                  <div
                    key={team.id}
                    className="bg-muted/50 p-4 rounded-lg"
                  >
                    <div className="font-medium mb-2">{team.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: game.totalRounds }, (_, i) => i + 1).map((round) => (
                        <div key={round} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Round {round}:</span>
                          <span className="font-medium">{getTeamAverageScore(team.id, round).toFixed(1)}</span>
                        </div>
                      ))}
                      <div className="col-span-2 mt-2 pt-2 border-t border-border flex justify-between items-center">
                        <span className="text-sm font-medium">Average:</span>
                        <span className="font-bold">{getTeamTotalScore(team.id).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="participation" className="mt-0">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Audience Participation</CardTitle>
              <CardDescription>Number of votes in each round</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={participationData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        background: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }} 
                    />
                    <Legend />
                    {Array.from({ length: game.totalRounds }, (_, i) => i + 1).map((round) => (
                      <Bar
                        key={round}
                        dataKey={`Round ${round}`}
                        fill={getColor(round - 1)}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {game.teams.map((team) => (
                  <div
                    key={team.id}
                    className="bg-muted/50 p-4 rounded-lg"
                  >
                    <div className="font-medium mb-2">{team.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: game.totalRounds }, (_, i) => i + 1).map((round) => (
                        <div key={round} className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Round {round}:</span>
                          <span className="font-medium">{voteCount(team.id, round)} votes</span>
                        </div>
                      ))}
                      <div className="col-span-2 mt-2 pt-2 border-t border-border flex justify-between items-center">
                        <span className="text-sm font-medium">Total Votes:</span>
                        <span className="font-bold">
                          {Array.from({ length: game.totalRounds }, (_, i) => i + 1)
                            .reduce((acc, round) => acc + voteCount(team.id, round), 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResultsDisplay;
