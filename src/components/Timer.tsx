
import { useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";
import { Button } from "@/components/ui/button";
import { Play, Pause, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimerProps {
  className?: string;
  onComplete?: () => void;
}

const Timer = ({ className, onComplete }: TimerProps) => {
  const { timerRunning, timeRemaining, startTimer, stopTimer } = useGame();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Calculate progress as a percentage
    const { game } = useGame();
    const maxTime = game?.timerDuration || 60;
    const currentProgress = (timeRemaining / maxTime) * 100;
    setProgress(currentProgress);

    // Call onComplete if timer reaches 0
    if (timeRemaining === 0 && onComplete) {
      onComplete();
    }
  }, [timeRemaining, onComplete]);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Circular progress background */}
        <div className="absolute inset-0 rounded-full bg-muted" />
        
        {/* Circular progress indicator */}
        <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            className="text-muted stroke-current"
            strokeWidth="10"
            fill="transparent"
            r="40"
            cx="50"
            cy="50"
          />
          <circle
            className={cn(
              "text-primary stroke-current transition-all duration-300 ease-in-out",
              timeRemaining < 10 && "text-destructive animate-ping-once"
            )}
            strokeWidth="10"
            strokeDasharray={251.2}
            strokeDashoffset={251.2 - (progress * 251.2) / 100}
            strokeLinecap="round"
            fill="transparent"
            r="40"
            cx="50"
            cy="50"
          />
        </svg>
        
        {/* Timer display */}
        <div className="text-2xl font-bold z-10">{formatTime(timeRemaining)}</div>
      </div>

      <div className="flex space-x-2">
        {!timerRunning ? (
          <Button 
            onClick={startTimer} 
            size="sm" 
            className="button-scale"
            disabled={timeRemaining === 0}
          >
            <Play className="mr-1 h-4 w-4" />
            Start
          </Button>
        ) : (
          <Button 
            onClick={stopTimer} 
            size="sm" 
            variant="outline" 
            className="button-scale"
          >
            <Pause className="mr-1 h-4 w-4" />
            Pause
          </Button>
        )}
      </div>
    </div>
  );
};

export default Timer;
