
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGame } from "@/context/GameContext";
import { Timer, Settings, BarChart3, Smartphone, Users, QrCode, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { game } = useGame();
  
  const features = [
    {
      title: "QR-Based Voting",
      description: "Audience members scan QR codes to access voting interface",
      icon: <QrCode className="h-5 w-5" />,
    },
    {
      title: "Live Results",
      description: "Real-time vote counting and score visualization",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      title: "Multiple Rounds",
      description: "Support for multiple performance rounds and teams",
      icon: <Timer className="h-5 w-5" />,
    },
    {
      title: "Easy to Use",
      description: "No app installation required for voters",
      icon: <Smartphone className="h-5 w-5" />,
    },
    {
      title: "High Capacity",
      description: "Designed to handle 250+ simultaneous voters",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Fair Voting",
      description: "One vote per device per round for each team",
      icon: <Star className="h-5 w-5" />,
    },
  ];
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-panel w-full px-6 py-4 rounded-2xl mb-6 sticky top-4 z-50 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-xl">Team Vote</div>
          
          <div className="flex items-center space-x-3">
            {game && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/results")}
                  className="button-scale"
                >
                  Results
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                  className="button-scale"
                >
                  Admin
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <section className="mb-16 text-center">
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full -z-10 transform translate-y-1/4"></div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold">
                Team Vote Showdown
              </h1>
              <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
                A QR-based live voting system for team performances with real-time results
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              {game ? (
                <>
                  <Button 
                    size="lg" 
                    onClick={() => navigate("/admin")}
                    className="button-scale"
                  >
                    <Settings className="mr-2 h-5 w-5" />
                    Manage Game
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => navigate("/results")}
                    className="button-scale"
                  >
                    <BarChart3 className="mr-2 h-5 w-5" />
                    View Results
                  </Button>
                </>
              ) : (
                <Button 
                  size="lg" 
                  onClick={() => navigate("/admin")}
                  className="button-scale"
                >
                  Create New Game
                </Button>
              )}
            </div>
          </section>
          
          {/* Features */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-8">Key Features</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index}
                  className="hover-card glass-panel overflow-hidden"
                >
                  <CardContent className="p-6">
                    <div className="bg-primary/10 rounded-full p-3 w-fit mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="font-medium text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          
          {/* How It Works */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
            <div className="glass-panel p-6 rounded-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <div className="font-bold">1</div>
                  </div>
                  <h3 className="font-medium mb-2">Create Game</h3>
                  <p className="text-muted-foreground text-sm">
                    Set up teams, rounds, and voting duration
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <div className="font-bold">2</div>
                  </div>
                  <h3 className="font-medium mb-2">Display QR Code</h3>
                  <p className="text-muted-foreground text-sm">
                    Show QR code for audience to scan
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-primary/10 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <div className="font-bold">3</div>
                  </div>
                  <h3 className="font-medium mb-2">Collect & Show Results</h3>
                  <p className="text-muted-foreground text-sm">
                    View scores and determine the winner
                  </p>
                </div>
              </div>
            </div>
          </section>
          
          {/* CTA */}
          {!game && (
            <section className="text-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/admin")}
                className="button-scale"
              >
                Get Started Now
              </Button>
            </section>
          )}
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-sm text-muted-foreground">
        <div className="container">
          <p>Team Vote Showdown • A QR-based live voting system</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
