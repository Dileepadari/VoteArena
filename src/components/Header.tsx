
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { Button } from "@/components/ui/button";
import { Home, BarChart3, Settings } from "lucide-react";

const Header = () => {
  const navigate = useNavigate();
  const { game } = useGame();

  return (
    <header className="glass-panel w-full px-6 py-4 rounded-2xl mb-6 sticky top-4 z-50 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xl">Team Vote</span>
          {game && (
            <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full">
              {game.name}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="button-scale"
          >
            <Home className="h-5 w-5" />
          </Button>
          
          {game && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/results")}
                className="button-scale"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="button-scale"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
