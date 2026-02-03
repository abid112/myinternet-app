import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { 
  Globe, 
  MapPin, 
  Wifi, 
  Monitor, 
  Activity, 
  Server, 
  RefreshCw,
  Signal,
  Clock,
  Cpu,
  Languages,
  Smartphone
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { InfoCard, InfoRow } from "@/components/info-card";
import type { NetworkInfo, BrowserInfo } from "@shared/schema";

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

  const { data: networkInfo, isLoading, error, refetch, isFetching } = useQuery<NetworkInfo>({
    queryKey: ["/api/network-info"],
    staleTime: 60000,
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
    measureLatency();
  }, []);

  const connectionQuality = browserInfo ? getConnectionQuality(browserInfo.effectiveType) : null;

  return (
    <div className="min-h-screen bg-background" data-testid="page-home">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="header">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3" data-testid="header-logo">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">NetScope</h1>
              <p className="text-xs text-muted-foreground">Network Information</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8" data-testid="main-content">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Your Network at a Glance</h2>
          <p className="mt-2 text-muted-foreground" data-testid="text-page-subtitle">
            Real-time information about your network connection and browser
          </p>
        </div>

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
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Globe className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your IP Address</p>
                    {isLoading ? (
                      <Skeleton className="h-9 w-48" />
                    ) : (
                      <p className="text-3xl font-bold font-mono tracking-tight" data-testid="text-ip-address">
                        {networkInfo?.ip || "Unknown"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" data-testid="badge-online-status">
                    <span className={`mr-1.5 h-2 w-2 rounded-full ${browserInfo?.online ? "bg-green-500" : "bg-red-500"}`} />
                    {browserInfo?.online ? "Online" : "Offline"}
                  </Badge>
                  {latency !== null && (
                    <Badge variant="outline" data-testid="badge-latency">
                      <Clock className="mr-1.5 h-3 w-3" />
                      {latency}ms latency
                    </Badge>
                  )}
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
              <InfoRow 
                label="Coordinates" 
                value={`${networkInfo.latitude.toFixed(4)}, ${networkInfo.longitude.toFixed(4)}`} 
                mono 
                testId="text-coordinates"
              />
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
              label="Downlink" 
              value={browserInfo?.downlink ? `${browserInfo.downlink} Mbps` : undefined} 
              testId="text-downlink"
            />
            <InfoRow 
              label="Round-Trip Time" 
              value={browserInfo?.rtt ? `${browserInfo.rtt}ms` : undefined} 
              testId="text-rtt"
            />
            <InfoRow label="Server Latency" value={latency !== null ? `${latency}ms` : undefined} testId="text-server-latency" />
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
          </InfoCard>

          <InfoCard title="Server Info" icon={Server} isLoading={isLoading} data-testid="card-server">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3" data-testid="info-platform">
                <Cpu className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Powered by Replit</p>
                  <p className="text-xs text-muted-foreground">Node.js + Express</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3" data-testid="info-geolocation">
                <Languages className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">IP Geolocation</p>
                  <p className="text-xs text-muted-foreground">Real-time location data</p>
                </div>
              </div>
            </div>
          </InfoCard>
        </div>

        <footer className="mt-12 text-center" data-testid="footer">
          <p className="text-sm text-muted-foreground" data-testid="text-privacy-notice">
            Your data is fetched in real-time and is not stored on our servers.
          </p>
        </footer>
      </main>
    </div>
  );
}
