
import React, { useState } from "react";
import { useGame } from "@/context/GameContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoteInterfaceProps {
  teamId: string;
  round: number;
  onVoteSubmitted?: () => void;
  className?: string;
}

const VoteInterface: React.FC<VoteInterfaceProps> = ({
  teamId,
  round,
  onVoteSubmitted,
  className,
}) => {
  const { game, submitVote, hasVoted } = useGame();
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(hasVoted(teamId, round));
  
  const currentTeam = game?.teams.find((team) => team.id === teamId);
  
  const handleRatingSelect = (rating: number) => {
    if (submitted) return;
    setSelectedRating(rating);
  };
  
  const handleSubmit = () => {
    if (!selectedRating || submitted || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Submit the vote
    const success = submitVote(teamId, round, selectedRating);
    
    if (success) {
      setSubmitted(true);
      if (onVoteSubmitted) onVoteSubmitted();
    }
    
    setIsSubmitting(false);
  };
  
  if (!currentTeam || !game) {
    return (
      <Card className={cn("glass-panel", className)}>
        <CardContent className="p-6 text-center">
          <p>Invalid team or round information.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={cn("glass-panel", className)}>
      <CardContent className="p-6">
        <div className="text-center mb-6">
          <div className="text-sm text-primary font-medium mb-1">Rate Performance</div>
          <h2 className="text-2xl font-bold">{currentTeam.name}</h2>
          <div className="mt-1 text-muted-foreground">Round {round}</div>
        </div>
        
        {submitted ? (
          <div className="text-center py-6 animate-fade-in">
            <div className="inline-flex items-center justify-center mb-4 bg-primary/10 text-primary rounded-full p-4">
              <Star className="h-8 w-8 fill-current" />
            </div>
            <h3 className="text-xl font-semibold">Thank You!</h3>
            <p className="text-muted-foreground mt-2">
              Your vote has been submitted successfully.
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center space-x-2 mb-8">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    selectedRating === rating
                      ? "bg-primary text-white scale-110"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                  onClick={() => handleRatingSelect(rating)}
                >
                  <span className="font-bold">{rating}</span>
                </button>
              ))}
            </div>
            
            <Button
              className="w-full button-scale"
              size="lg"
              disabled={!selectedRating || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Submitting..." : "Submit Vote"}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              You can only vote once per team per round.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VoteInterface;
