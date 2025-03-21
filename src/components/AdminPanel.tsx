
import { useGame } from "@/context/GameContext";
import { cn } from "@/lib/utils";
import GameSetupForm from "./admin/GameSetupForm";
import GameControlsCard from "./admin/GameControlsCard";
import TeamManagementCard from "./admin/TeamManagementCard";

interface AdminPanelProps {
  className?: string;
}

const AdminPanel = ({ className }: AdminPanelProps) => {
  const { game } = useGame();
  
  // If there's no game, show setup form
  if (!game) {
    return <GameSetupForm className={className} />;
  }
  
  return (
    <div className={cn("space-y-6 animate-fade-in", className)}>
      <GameControlsCard />
      <TeamManagementCard />
    </div>
  );
};

export default AdminPanel;
