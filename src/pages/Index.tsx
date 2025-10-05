import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ClockInOut from "@/components/ClockInOut";
import AttendanceHistory from "@/components/AttendanceHistory";
import AdminPanel from "@/components/AdminPanel";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else {
      setUser(session.user);
      await fetchProfile(session.user.id);
    }
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">SecureAttend</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome, {profile?.full_name}
                </p>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
          
          {profile && (
            <div className="flex gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                profile.role === "admin"
                  ? "bg-primary/10 text-primary"
                  : profile.role === "manager"
                  ? "bg-accent/10 text-accent"
                  : "bg-muted text-muted-foreground"
              }`}>
                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
              </span>
              {profile.is_device_registered && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
                  Device Registered
                </span>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Clock In/Out Section - Available to all users */}
          <ClockInOut />

          {/* Attendance History - Available to all users */}
          <AttendanceHistory />

          {/* Admin Panel - Only for admins and managers */}
          {(isAdmin || isManager) && <AdminPanel />}
        </div>
      </div>
    </div>
  );
};

export default Index;