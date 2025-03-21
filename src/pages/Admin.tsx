
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import Header from "@/components/Header";
import AdminPanel from "@/components/AdminPanel";
import { Button } from "@/components/ui/button";
import { AlarmCheck, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { isLocalStorageAvailable } from "@/lib/storage";

const Admin = () => {
  const navigate = useNavigate();
  const { game } = useGame();
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  
  useEffect(() => {
    document.title = "Admin Panel | Team Vote";
    
    // Check various browser storage limitations
    const checkStorageLimitations = () => {
      // Check for cookies enabled
      if (!navigator.cookieEnabled) {
        setStorageWarning("Cookies are disabled - this may affect application functionality");
        return;
      }
      
      // Check for localStorage support/availability
      if (!isLocalStorageAvailable()) {
        setStorageWarning("LocalStorage is not available (possibly in private browsing) - using memory storage fallback");
        return;
      }
      
      // Check for storage quotas in private browsing modes
      try {
        // Try to write a large string to test quota
        const testString = "a".repeat(100000);
        localStorage.setItem("storage-test", testString);
        localStorage.removeItem("storage-test");
      } catch (e) {
        setStorageWarning("Limited storage quota detected - consider using regular browsing mode for best performance");
        return;
      }
      
      setStorageWarning(null);
    };
    
    checkStorageLimitations();
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
        
        {storageWarning && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Storage Warning</AlertTitle>
            <AlertDescription>
              {storageWarning}
            </AlertDescription>
          </Alert>
        )}
        
        <AdminPanel />
      </main>
    </div>
  );
};

export default Admin;
