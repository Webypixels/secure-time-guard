import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Clock } from "lucide-react";
import { format } from "date-fns";

interface AttendanceLog {
  id: string;
  status: "clocked_in" | "clocked_out";
  timestamp: string;
  geofence_areas: {
    name: string;
  } | null;
}

const AttendanceHistory = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    fetchLogs();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_logs",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("attendance_logs")
      .select(`
        id,
        status,
        timestamp,
        geofence_areas (
          name
        )
      `)
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false })
      .limit(20);

    if (data) {
      setLogs(data);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>Your attendance history</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attendance records yet
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      log.status === "clocked_in" ? "bg-accent" : "bg-muted-foreground"
                    }`} />
                    <div>
                      <p className="text-sm font-medium">
                        {log.status === "clocked_in" ? "Clocked In" : "Clocked Out"}
                      </p>
                      {log.geofence_areas && (
                        <p className="text-xs text-muted-foreground">
                          {log.geofence_areas.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.timestamp), "HH:mm")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.timestamp), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AttendanceHistory;