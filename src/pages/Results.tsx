
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import Header from "@/components/Header";
import ResultsDisplay from "@/components/ResultsDisplay";
import { Button } from "@/components/ui/button";
import { Settings, BarChart3 } from "lucide-react";

const Results = () => {
  const navigate = useNavigate();
  const { game } = useGame();
  
  useEffect(() => {
    document.title = "Results | Team Vote";
  }, []);

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col container mx-auto px-4 py-8 page-transition">
        <Header />
        
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md glass-panel p-8 rounded-xl">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-4">No Active Game</h1>
            <p className="text-muted-foreground mb-6">
              You need to create a game before you can view results.
            </p>
            <Button onClick={() => navigate("/admin")} className="button-scale">
              <Settings className="mr-2 h-4 w-4" />
              Create Game
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col container mx-auto px-4 py-8 page-transition">
      <Header />
      
      <main className="flex-1">
        <h1 className="text-3xl font-bold mb-6">
          Results
        </h1>
        
        <ResultsDisplay />
      </main>
    </div>
  );
};

export default Results;
