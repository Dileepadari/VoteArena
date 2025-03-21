
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import Header from "@/components/Header";
import AdminPanel from "@/components/AdminPanel";

const Admin = () => {
  const navigate = useNavigate();
  const { game } = useGame();
  
  useEffect(() => {
    document.title = "Admin Panel | Team Vote";
  }, []);

  return (
    <div className="min-h-screen flex flex-col container mx-auto px-4 py-8 page-transition">
      <Header />
      
      <main className="flex-1">
        <h1 className="text-3xl font-bold mb-6">
          Admin Panel
        </h1>
        
        <AdminPanel />
      </main>
    </div>
  );
};

export default Admin;
