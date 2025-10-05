import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";

interface GeofenceArea {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

const ClockInOut = () => {
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<"clocked_in" | "clocked_out" | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geofenceAreas, setGeofenceAreas] = useState<GeofenceArea[]>([]);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentStatus();
    fetchGeofenceAreas();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (location && geofenceAreas.length > 0) {
      checkGeofence();
    }
  }, [location, geofenceAreas]);

  const fetchCurrentStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("attendance_logs")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setCurrentStatus(data.status);
    } else {
      setCurrentStatus("clocked_out");
    }
  };

  const fetchGeofenceAreas = async () => {
    const { data } = await supabase
      .from("geofence_areas")
      .select("*")
      .eq("is_active", true);

    if (data) {
      setGeofenceAreas(data);
    }
  };

  const getCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Please enable location services to clock in/out.",
            variant: "destructive",
          });
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const checkGeofence = () => {
    if (!location) return;

    const withinAnyArea = geofenceAreas.some((area) => {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        Number(area.latitude),
        Number(area.longitude)
      );
      return distance <= area.radius_meters;
    });

    setIsWithinGeofence(withinAnyArea);
  };

  const handleClockAction = async () => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable location services.",
        variant: "destructive",
      });
      return;
    }

    if (!isWithinGeofence && currentStatus === "clocked_out") {
      toast({
        title: "Outside Geofence",
        description: "You must be within the designated area to clock in.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const deviceId = await getDeviceFingerprint();

      // Check device registration
      const { data: profile } = await supabase
        .from("profiles")
        .select("device_id, is_device_registered")
        .eq("id", user.id)
        .single();

      if (!profile?.is_device_registered) {
        // Register device
        await supabase
          .from("profiles")
          .update({ device_id: deviceId, is_device_registered: true })
          .eq("id", user.id);
      } else if (profile.device_id !== deviceId) {
        throw new Error("This device is not registered. Please use your registered device.");
      }

      const newStatus = currentStatus === "clocked_out" ? "clocked_in" : "clocked_out";
      const nearestArea = geofenceAreas.reduce((nearest, area) => {
        const distance = calculateDistance(
          location.lat,
          location.lng,
          Number(area.latitude),
          Number(area.longitude)
        );
        if (!nearest || distance < nearest.distance) {
          return { area, distance };
        }
        return nearest;
      }, null as { area: GeofenceArea; distance: number } | null);

      const { error } = await supabase.from("attendance_logs").insert({
        user_id: user.id,
        status: newStatus,
        latitude: location.lat,
        longitude: location.lng,
        device_id: deviceId,
        geofence_area_id: nearestArea?.area.id || null,
      });

      if (error) throw error;

      setCurrentStatus(newStatus);
      toast({
        title: newStatus === "clocked_in" ? "Clocked In" : "Clocked Out",
        description: `Successfully ${newStatus === "clocked_in" ? "clocked in" : "clocked out"} at ${new Date().toLocaleTimeString()}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Attendance
        </CardTitle>
        <CardDescription>
          Current Status:{" "}
          <span className={currentStatus === "clocked_in" ? "text-accent font-semibold" : "text-muted-foreground"}>
            {currentStatus === "clocked_in" ? "Clocked In" : "Clocked Out"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {location ? (
            <span>Location detected</span>
          ) : (
            <span>Detecting location...</span>
          )}
          {location && (
            isWithinGeofence ? (
              <CheckCircle2 className="w-4 h-4 text-accent" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )
          )}
        </div>
        
        <Button
          onClick={handleClockAction}
          disabled={loading || !location}
          className="w-full"
          size="lg"
          variant={currentStatus === "clocked_in" ? "destructive" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : currentStatus === "clocked_in" ? (
            "Clock Out"
          ) : (
            "Clock In"
          )}
        </Button>

        {!isWithinGeofence && currentStatus === "clocked_out" && location && (
          <p className="text-sm text-warning text-center">
            You are outside the designated area. Please move closer to clock in.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ClockInOut;