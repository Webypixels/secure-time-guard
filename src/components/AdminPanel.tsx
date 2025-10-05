import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, MapPinned, Shield, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
  const [geofenceAreas, setGeofenceAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGeofence, setNewGeofence] = useState({
    name: "",
    radius_meters: 100,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEmployees();
    fetchAllLogs();
    fetchGeofenceAreas();
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

  const fetchGeofenceAreas = async () => {
    const { data } = await supabase
      .from("geofence_areas")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setGeofenceAreas(data);
    }
  };

  const addGeofenceWithCurrentLocation = async () => {
    if (!newGeofence.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the geofence area.",
        variant: "destructive",
      });
      return;
    }

    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from("geofence_areas").insert({
              name: newGeofence.name,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              radius_meters: newGeofence.radius_meters,
              created_by: user?.id,
            });

            if (error) throw error;

            toast({
              title: "Geofence Added",
              description: `Successfully added "${newGeofence.name}" at your current location.`,
            });

            setNewGeofence({ name: "", radius_meters: 100 });
            fetchGeofenceAreas();
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          setLoading(false);
          toast({
            title: "Location Error",
            description: "Please enable location services to add a geofence area.",
            variant: "destructive",
          });
        }
      );
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
        <Tabs defaultValue="geofence">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geofence">
              <MapPin className="w-4 h-4 mr-2" />
              Geofence
            </TabsTrigger>
            <TabsTrigger value="employees">
              <Users className="w-4 h-4 mr-2" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="logs">
              <MapPinned className="w-4 h-4 mr-2" />
              All Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geofence">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="geofence-name">Area Name</Label>
                  <Input
                    id="geofence-name"
                    placeholder="e.g., Main Office"
                    value={newGeofence.name}
                    onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geofence-radius">Radius (meters)</Label>
                  <Input
                    id="geofence-radius"
                    type="number"
                    placeholder="100"
                    value={newGeofence.radius_meters}
                    onChange={(e) => setNewGeofence({ ...newGeofence, radius_meters: parseInt(e.target.value) || 100 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button 
                    onClick={addGeofenceWithCurrentLocation} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <MapPin className="mr-2 h-4 w-4" />
                        Add Current Location
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {geofenceAreas.length > 0 ? (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {geofenceAreas.map((area) => (
                      <div key={area.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{area.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Radius: {area.radius_meters}m | 
                            Lat: {Number(area.latitude).toFixed(6)}, Lng: {Number(area.longitude).toFixed(6)}
                          </p>
                        </div>
                        <Badge variant={area.is_active ? "default" : "secondary"}>
                          {area.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No geofence areas found. Add your first one above!
                </p>
              )}
            </div>
          </TabsContent>
          
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