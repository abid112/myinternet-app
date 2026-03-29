import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Globe, 
  MapPin, 
  Wifi, 
  Monitor, 
  Activity, 
  RefreshCw,
  Signal,
  Map,
  Smartphone,
  CloudSun,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  Thermometer,
  Droplets,
  Wind,
  Gauge
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { InfoCard, InfoRow } from "@/components/info-card";
import type { NetworkInfo, BrowserInfo } from "@shared/schema";

interface WeatherData {
  temperature: number;
  temperatureUnit: string;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windSpeedUnit: string;
  windDirection: number;
  pressure: number;
  uvIndex: number;
  weatherCode: number;
  description: string;
  icon: string;
  timezone: string;
}

function getWeatherIcon(icon: string) {
  switch (icon) {
    case "sun": return Sun;
    case "cloud-sun": return CloudSun;
    case "cloud": return Cloud;
    case "cloud-rain": return CloudRain;
    case "snowflake": return CloudSnow;
    case "cloud-lightning": return CloudLightning;
    case "cloud-fog": return CloudFog;
    case "cloud-drizzle": return CloudDrizzle;
    default: return Cloud;
  }
}

function getWindDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function getBrowserInfo(): BrowserInfo {
  const nav = navigator as Navigator & { connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number } };
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === "1",
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    connectionType: nav.connection?.type,
    effectiveType: nav.connection?.effectiveType,
    downlink: nav.connection?.downlink,
    rtt: nav.connection?.rtt,
  };
}

function getBrowserName(userAgent: string): string {
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) return "Safari";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Opera") || userAgent.includes("OPR")) return "Opera";
  return "Unknown";
}

function getOSName(platform: string): string {
  if (platform.includes("Win")) return "Windows";
  if (platform.includes("Mac")) return "macOS";
  if (platform.includes("Linux")) return "Linux";
  if (platform.includes("iPhone") || platform.includes("iPad")) return "iOS";
  if (platform.includes("Android")) return "Android";
  return platform;
}

function getConnectionQuality(effectiveType?: string): { label: string; color: string; value: number } {
  switch (effectiveType) {
    case "4g":
      return { label: "Excellent", color: "text-green-500", value: 100 };
    case "3g":
      return { label: "Good", color: "text-yellow-500", value: 66 };
    case "2g":
      return { label: "Poor", color: "text-orange-500", value: 33 };
    case "slow-2g":
      return { label: "Very Poor", color: "text-red-500", value: 10 };
    default:
      return { label: "Unknown", color: "text-muted-foreground", value: 50 };
  }
}

export default function Home() {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [ipv4, setIpv4] = useState<string | null>(null);
  const [ipv6, setIpv6] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const { data: networkInfo, isLoading, error, refetch, isFetching } = useQuery<NetworkInfo>({
    queryKey: ["/api/network-info"],
    staleTime: 60000,
  });

  const { data: weatherData, isLoading: weatherLoading } = useQuery<WeatherData>({
    queryKey: ["/api/weather", networkInfo?.latitude, networkInfo?.longitude],
    queryFn: async () => {
      if (!networkInfo?.latitude || !networkInfo?.longitude) {
        throw new Error("Location not available");
      }
      const response = await fetch(`/api/weather?lat=${networkInfo.latitude}&lon=${networkInfo.longitude}`);
      if (!response.ok) throw new Error("Failed to fetch weather");
      return response.json();
    },
    enabled: !!networkInfo?.latitude && !!networkInfo?.longitude,
    staleTime: 300000,
  });

  useEffect(() => {
    setBrowserInfo(getBrowserInfo());
    
    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch("/api/ping", { method: "GET", cache: "no-store" });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    const measureUpload = async () => {
      try {
        const payload = new Uint8Array(100 * 1024);
        const start = performance.now();
        await fetch("/api/upload-test", {
          method: "POST",
          body: payload,
          cache: "no-store",
        });
        const end = performance.now();
        const durationSec = (end - start) / 1000;
        const bits = payload.byteLength * 8;
        const mbps = bits / durationSec / 1_000_000;
        setUploadSpeed(Math.round(mbps * 100) / 100);
      } catch {
        setUploadSpeed(null);
      }
    };

    measureLatency();
    measureUpload();

    const fetchIpVersions = async () => {
      setIpLoading(true);
      try {
        const fetchWithTimeout = (url: string) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          return fetch(url, { signal: controller.signal })
            .then(r => { clearTimeout(timer); if (!r.ok) throw new Error("non-ok"); return r.json(); })
            .catch(err => { clearTimeout(timer); throw err; });
        };
        const [v4Result, v6Result] = await Promise.allSettled([
          fetchWithTimeout("https://api4.ipify.org?format=json"),
          fetchWithTimeout("https://api6.ipify.org?format=json"),
        ]);
        setIpv4(v4Result.status === "fulfilled" ? v4Result.value.ip : null);
        setIpv6(v6Result.status === "fulfilled" ? v6Result.value.ip : null);
      } finally {
        setIpLoading(false);
      }
    };

    fetchIpVersions();
  }, []);

  useEffect(() => {
    if (!mapOpen) return;

    setGeoStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => {
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [mapOpen]);

  useEffect(() => {
    const coords =
      deviceCoords ??
      (networkInfo?.latitude && networkInfo?.longitude
        ? { lat: networkInfo.latitude, lng: networkInfo.longitude }
        : null);

    if (!mapOpen || (geoStatus === "loading") || !coords || !mapContainerRef.current) return;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([coords.lat, coords.lng], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const icon = L.divIcon({
        html: '<div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      L.marker([coords.lat, coords.lng], { icon }).addTo(map);
      mapInstanceRef.current = map;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapOpen, geoStatus, deviceCoords, networkInfo?.latitude, networkInfo?.longitude]);

  const connectionQuality = browserInfo ? getConnectionQuality(browserInfo.effectiveType) : null;

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="header">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-2.5" data-testid="header-logo">
              <div className="relative flex h-8 w-8 items-center justify-center">
                <img src="/android-chrome-192x192.png" alt="My Internet logo" className="h-8 w-8 object-contain" />
              </div>
              <span className="text-base font-semibold tracking-tight">My Internet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
              <ThemeToggle />
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" data-testid="main-content">
        {error && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5" data-testid="card-error">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <Activity className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive" data-testid="text-error-title">Failed to load network information</p>
                <p className="text-sm text-muted-foreground" data-testid="text-error-message">Please try refreshing the page</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8" data-testid="card-ip-hero">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Globe className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    {ipLoading ? (
                      <Skeleton className="h-8 w-48" />
                    ) : ipv6 ? (
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium shrink-0">IPv4:</span>
                          <span className="text-base sm:text-lg font-bold font-mono tracking-tight break-all" data-testid="text-ip-address">
                            {ipv4 ?? <span className="text-muted-foreground font-normal italic text-sm">Not detected</span>}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium shrink-0">IPv6:</span>
                          <span className="text-base sm:text-lg font-bold font-mono tracking-tight break-all" data-testid="text-ip-address-v6">
                            {ipv6}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Your IP Address</p>
                        <p className="text-xl sm:text-3xl font-bold font-mono tracking-tight break-all" data-testid="text-ip-address">
                          {ipv4 ?? "Unknown"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" data-testid="badge-online-status">
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${browserInfo?.online ? "bg-green-500" : "bg-red-500"}`} />
                    {browserInfo?.online ? "Online" : "Offline"}
                  </Badge>
                  {networkInfo?.countryCode && (
                    <Badge variant="outline" className="uppercase" data-testid="badge-country">
                      <MapPin className="mr-1.5 h-3 w-3" />
                      {networkInfo.countryCode}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <InfoCard title="Location" icon={MapPin} isLoading={isLoading} data-testid="card-location">
            <InfoRow label="City" value={networkInfo?.city} testId="text-city" />
            <InfoRow label="Region" value={networkInfo?.region} testId="text-region" />
            <InfoRow label="Country" value={networkInfo?.country} testId="text-country" />
            <InfoRow label="Timezone" value={networkInfo?.timezone} testId="text-timezone" />
            {networkInfo?.latitude && networkInfo?.longitude && (
              <>
                <InfoRow 
                  label="Coordinates" 
                  value={`${networkInfo.latitude.toFixed(4)}, ${networkInfo.longitude.toFixed(4)}`} 
                  mono 
                  testId="text-coordinates"
                />
                <div className="pt-3 mt-2 border-t border-border/50">
                  <Dialog onOpenChange={(open) => {
                    setMapOpen(open);
                    if (!open) { setDeviceCoords(null); setGeoStatus("idle"); }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" data-testid="button-show-map">
                        <Map className="mr-2 h-4 w-4" />
                        Show Map
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md" data-testid="dialog-map" aria-describedby={undefined}>
                      <DialogHeader>
                        <DialogTitle>Your Location</DialogTitle>
                      </DialogHeader>
                      <div className="relative overflow-hidden rounded-md border" style={{ height: 300 }}>
                        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} data-testid="map-container" />
                        {geoStatus === "loading" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                            <div className="text-center">
                              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              <p className="text-sm text-muted-foreground">Getting your location...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground text-center" data-testid="text-map-attribution">
                        {geoStatus === "granted"
                          ? "Showing your live device location · OpenStreetMap"
                          : "Approximate location based on IP · OpenStreetMap"}
                      </p>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
          </InfoCard>

          <InfoCard title="Connection" icon={Wifi} isLoading={isLoading} data-testid="card-connection">
            <InfoRow label="ISP" value={networkInfo?.isp} testId="text-isp" />
            <InfoRow label="Organization" value={networkInfo?.org} testId="text-org" />
            <InfoRow label="ASN" value={networkInfo?.asn} testId="text-asn" />
            {connectionQuality && (
              <div className="pt-3 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Connection Quality</span>
                  <span className={`text-sm font-medium ${connectionQuality.color}`} data-testid="text-connection-quality">
                    {connectionQuality.label}
                  </span>
                </div>
                <Progress value={connectionQuality.value} className="h-2" data-testid="progress-connection" />
              </div>
            )}
          </InfoCard>

          <InfoCard title="Network Speed" icon={Signal} isLoading={!browserInfo} data-testid="card-network-speed">
            <InfoRow label="Connection Type" value={browserInfo?.connectionType || browserInfo?.effectiveType} testId="text-connection-type" />
            <InfoRow 
              label="Download Speed" 
              value={browserInfo?.downlink ? `${browserInfo.downlink} Mbps` : undefined} 
              testId="text-download-speed"
            />
            <InfoRow 
              label="Upload Speed" 
              value={uploadSpeed !== null ? `${uploadSpeed} Mbps` : undefined} 
              testId="text-upload-speed"
            />
            <InfoRow 
              label={`Latency${networkInfo?.city ? ` (${networkInfo.city} to USA)` : ""}`}
              value={latency !== null ? `${latency}ms` : undefined} 
              testId="text-server-latency"
            />
          </InfoCard>

          <InfoCard title="Browser" icon={Monitor} isLoading={!browserInfo} data-testid="card-browser">
            <InfoRow label="Browser" value={browserInfo ? getBrowserName(browserInfo.userAgent) : undefined} testId="text-browser-name" />
            <InfoRow label="Operating System" value={browserInfo ? getOSName(browserInfo.platform) : undefined} testId="text-os" />
            <InfoRow label="Language" value={browserInfo?.language} testId="text-language" />
            <InfoRow label="Cookies" value={browserInfo?.cookiesEnabled ? "Enabled" : "Disabled"} testId="text-cookies" />
            <InfoRow label="Do Not Track" value={browserInfo?.doNotTrack ? "Enabled" : "Disabled"} testId="text-dnt" />
          </InfoCard>

          <InfoCard title="Display" icon={Smartphone} isLoading={!browserInfo} data-testid="card-display">
            <InfoRow 
              label="Screen Resolution" 
              value={browserInfo ? `${browserInfo.screenWidth} × ${browserInfo.screenHeight}` : undefined} 
              testId="text-resolution"
            />
            <InfoRow 
              label="Color Depth" 
              value={browserInfo?.colorDepth ? `${browserInfo.colorDepth}-bit` : undefined} 
              testId="text-color-depth"
            />
            <InfoRow 
              label="Pixel Ratio" 
              value={browserInfo?.pixelRatio ? `${browserInfo.pixelRatio}x` : undefined} 
              testId="text-pixel-ratio"
            />
            <InfoRow 
              label="HDR Support" 
              value={browserInfo ? (window.matchMedia("(dynamic-range: high)").matches ? "Supported" : "Not Supported") : undefined} 
              testId="text-hdr-support"
            />
          </InfoCard>

          <InfoCard title="Weather" icon={CloudSun} isLoading={weatherLoading || isLoading} data-testid="card-weather">
            {weatherData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4" data-testid="weather-main">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const WeatherIcon = getWeatherIcon(weatherData.icon);
                      return <WeatherIcon className="h-10 w-10 text-primary" />;
                    })()}
                    <div>
                      <p className="text-3xl font-bold" data-testid="text-temperature">
                        {Math.round(weatherData.temperature)}{weatherData.temperatureUnit}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-weather-description">
                        {weatherData.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" data-testid="badge-feels-like">
                    Feels {Math.round(weatherData.feelsLike)}{weatherData.temperatureUnit}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3" data-testid="weather-humidity">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Humidity</p>
                      <p className="text-sm font-medium" data-testid="text-humidity">{weatherData.humidity}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3" data-testid="weather-wind">
                    <Wind className="h-4 w-4 text-teal-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Wind</p>
                      <p className="text-sm font-medium" data-testid="text-wind">
                        {Math.round(weatherData.windSpeed)} {weatherData.windSpeedUnit} {getWindDirection(weatherData.windDirection)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3" data-testid="weather-pressure">
                    <Gauge className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pressure</p>
                      <p className="text-sm font-medium" data-testid="text-pressure">{Math.round(weatherData.pressure)} hPa</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3" data-testid="weather-uv">
                    <Sun className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">UV Index</p>
                      <p className="text-sm font-medium" data-testid="text-uv">{weatherData.uvIndex}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-weather-unavailable">
                Weather data unavailable. Location required.
              </p>
            )}
          </InfoCard>
        </div>

        <footer className="mt-12 text-center" data-testid="footer">
          <p className="text-sm text-muted-foreground" data-testid="text-privacy-notice">
            Your data is fetched in real-time and is not stored on our servers.
          </p>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="text-made-by">
            Made with ❤️ by Abid Hasan. If you like this tool or find it helpful,{" "}
            <a
              href="https://buymeacoffee.com/abid_hasan112"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              data-testid="link-buy-me-coffee"
            >
              Buy Me a Coffee from here
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
