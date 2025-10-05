import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, MapPinned, Shield } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_device_registered: boolean;
}

interface AttendanceLog {
  id: string;
  timestamp: string;
  status: string;
  profiles: {
    full_name: string;
    email: string;
  };
  geofence_areas: {
    name: string;
  } | null;
}

const AdminPanel = () => {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [allLogs, setAllLogs] = useState<AttendanceLog[]>([]);

  useEffect(() => {
    fetchEmployees();
    fetchAllLogs();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setEmployees(data);
    }
  };

  const fetchAllLogs = async () => {
    const { data } = await supabase
      .from("attendance_logs")
      .select(`
        id,
        timestamp,
        status,
        profiles (
          full_name,
          email
        ),
        geofence_areas (
          name
        )
      `)
      .order("timestamp", { ascending: false })
      .limit(50);

    if (data) {
      setAllLogs(data);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Dashboard
        </CardTitle>
        <CardDescription>Manage employees and view all attendance records</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="employees">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="employees">
              <Users className="w-4 h-4 mr-2" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="logs">
              <MapPinned className="w-4 h-4 mr-2" />
              All Logs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="employees">
            <ScrollArea className="h-[400px] pr-4">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No employees found
                </p>
              ) : (
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="font-medium">{employee.full_name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : employee.role === "manager"
                            ? "bg-accent/10 text-accent"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {employee.role}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {employee.is_device_registered ? "Device registered" : "No device"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="logs">
            <ScrollArea className="h-[400px] pr-4">
              {allLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No attendance logs found
                </p>
              ) : (
                <div className="space-y-3">
                  {allLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{log.profiles.full_name}</p>
                          <p className="text-sm text-muted-foreground">{log.profiles.email}</p>
                          {log.geofence_areas && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📍 {log.geofence_areas.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            log.status === "clocked_in"
                              ? "bg-accent/10 text-accent"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {log.status === "clocked_in" ? "Clocked In" : "Clocked Out"}
                          </span>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.timestamp), "MMM dd, HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AdminPanel;