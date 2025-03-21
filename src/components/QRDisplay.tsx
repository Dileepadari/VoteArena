
import React, { useState, useEffect } from "react";
import { useGame } from "@/context/GameContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QRDisplayProps {
  teamId: string;
  round: number;
  className?: string;
}

const QRDisplay: React.FC<QRDisplayProps> = ({ teamId, round, className }) => {
  const { game, voteCount } = useGame();
  const [copied, setCopied] = useState(false);
  const [voteCounter, setVoteCounter] = useState(0);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const currentTeam = game?.teams.find((team) => team.id === teamId);
  const votes = voteCount(teamId, round);

  // Generate QR code URL
  useEffect(() => {
    if (!teamId || !round) return;

    // Create the voting URL (base URL + teamId + round)
    const voteUrl = `${window.location.origin}/vote?teamId=${teamId}&round=${round}`;
    
    // Generate QR code using QR Server API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(voteUrl)}`;
    setQrCode(qrUrl);

  }, [teamId, round]);

  // Update votes counter with animation
  useEffect(() => {
    if (votes > voteCounter) {
      const diff = votes - voteCounter;
      const increment = Math.max(1, Math.floor(diff / 10));
      
      const timeout = setTimeout(() => {
        setVoteCounter(prev => Math.min(votes, prev + increment));
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [votes, voteCounter]);

  // Handle copy URL to clipboard
  const handleCopyUrl = () => {
    const voteUrl = `${window.location.origin}/vote?teamId=${teamId}&round=${round}`;
    navigator.clipboard.writeText(voteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!currentTeam || !game) return null;

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      "glass-panel hover-card",
      className
    )}>
      <CardContent className="p-6 flex flex-col items-center">
        <div className="mb-4 text-center">
          <h3 className="text-lg font-medium">{currentTeam.name}</h3>
          <p className="text-muted-foreground mt-1">Round {round}</p>
        </div>
        
        {qrCode ? (
          <div className="relative rounded-lg overflow-hidden bg-white p-2 mb-4 shadow-md animate-scale-in">
            <img
              src={qrCode}
              alt={`QR Code for ${currentTeam.name}`}
              className="w-48 h-48 object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-primary/10 backdrop-blur-sm">
              <QrCode className="h-10 w-10 text-primary opacity-70" />
            </div>
          </div>
        ) : (
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
            <QrCode className="h-10 w-10 text-muted-foreground animate-pulse" />
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          className="mb-4 button-scale"
          onClick={handleCopyUrl}
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Vote URL
            </>
          )}
        </Button>
        
        <div className="mt-2 text-center">
          <div className="text-sm text-muted-foreground">Votes Received</div>
          <div className="text-2xl font-bold mt-1">{voteCounter}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRDisplay;
