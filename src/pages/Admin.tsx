
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import Header from "@/components/Header";
import AdminPanel from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { AlarmCheck } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { game } = useGame();
  
  useEffect(() => {
    document.title = "Admin Panel | Team Vote";
    
    // Performance warning for localStorage in private browsing
    if (!navigator.cookieEnabled) {
      console.warn("Cookies disabled - this may affect application performance");
    }
    
    // Check for localStorage support/availability
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (e) {
      console.error("LocalStorage not available - voting functionality may be impaired");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col container mx-auto px-4 py-8 page-transition">
      <Header />
      
      <main className="flex-1">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            Admin Panel
          </h1>
          
          {game && (
            <div className="text-sm text-muted-foreground rounded-lg bg-muted px-3 py-1 flex items-center">
              <AlarmCheck className="w-4 h-4 mr-1.5" />
              <span>Optimized for {game.teams.length * game.totalRounds * 250}+ votes</span>
            </div>
          )}
        </div>
        
        <AdminPanel />
      </main>
    </div>
  );
};

export default Admin;
