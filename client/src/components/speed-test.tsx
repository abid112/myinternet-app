import { useState, useCallback } from "react";
import { 
  Play, 
  Download, 
  Upload, 
  Activity,
  MapPin,
  Server,
  CheckCircle2,
  Loader2,
  Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";

interface SpeedTestResult {
  timestamp: number;
  download: number;
  upload: number;
  ping: number;
  server: string;
}

interface TestServer {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  provider: string;
}

const TEST_SERVERS: TestServer[] = [
  { id: "us-west", city: "The Dalles", country: "United States", countryCode: "🇺🇸", provider: "Google Cloud" },
  { id: "us-east", city: "Ashburn", country: "United States", countryCode: "🇺🇸", provider: "AWS" },
  { id: "eu-west", city: "Dublin", country: "Ireland", countryCode: "🇮🇪", provider: "AWS" },
  { id: "eu-central", city: "Frankfurt", country: "Germany", countryCode: "🇩🇪", provider: "Google Cloud" },
  { id: "uk", city: "London", country: "United Kingdom", countryCode: "🇬🇧", provider: "Google Cloud" },
  { id: "asia-east", city: "Tokyo", country: "Japan", countryCode: "🇯🇵", provider: "Google Cloud" },
  { id: "asia-south", city: "Singapore", country: "Singapore", countryCode: "🇸🇬", provider: "AWS" },
  { id: "asia-pacific", city: "Sydney", country: "Australia", countryCode: "🇦🇺", provider: "Google Cloud" },
  { id: "sa-east", city: "São Paulo", country: "Brazil", countryCode: "🇧🇷", provider: "AWS" },
  { id: "ca-central", city: "Montreal", country: "Canada", countryCode: "🇨🇦", provider: "Google Cloud" },
  { id: "india", city: "Mumbai", country: "India", countryCode: "🇮🇳", provider: "AWS" },
  { id: "korea", city: "Seoul", country: "South Korea", countryCode: "🇰🇷", provider: "Google Cloud" },
];

type TestPhase = "idle" | "ping" | "download" | "upload" | "complete";

export function SpeedTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [currentDownload, setCurrentDownload] = useState<number | null>(null);
  const [currentUpload, setCurrentUpload] = useState<number | null>(null);
  const [currentPing, setCurrentPing] = useState<number | null>(null);
  const [results, setResults] = useState<SpeedTestResult[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>("us-west");

  const selectedServer = TEST_SERVERS.find(s => s.id === selectedServerId) || TEST_SERVERS[0];

  const measurePing = useCallback(async (): Promise<number> => {
    const pings: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await fetch("/api/ping", { cache: "no-store" });
      const end = performance.now();
      pings.push(end - start);
    }
    
    // Return average ping, excluding outliers
    pings.sort((a, b) => a - b);
    const trimmed = pings.slice(1, -1);
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  }, []);

  const measureDownload = useCallback(async (): Promise<number> => {
    const testSizes = [512 * 1024, 1024 * 1024, 2 * 1024 * 1024];
    const speeds: number[] = [];
    
    for (let i = 0; i < testSizes.length; i++) {
      const size = testSizes[i];
      const start = performance.now();
      
      const response = await fetch(`/api/speed-test/download?size=${size}`, {
        cache: "no-store"
      });
      
      const blob = await response.blob();
      const end = performance.now();
      
      const durationSec = (end - start) / 1000;
      const speedMbps = (blob.size * 8) / (durationSec * 1000000);
      speeds.push(speedMbps);
      
      setProgress(((i + 1) / testSizes.length) * 100);
      setCurrentDownload(speedMbps);
    }
    
    // Return the best speed (accounts for slow start)
    return Math.max(...speeds);
  }, []);

  const measureUpload = useCallback(async (): Promise<number> => {
    const testSizes = [256 * 1024, 512 * 1024, 1024 * 1024];
    const speeds: number[] = [];
    
    for (let i = 0; i < testSizes.length; i++) {
      const size = testSizes[i];
      const data = new Uint8Array(size);
      
      const start = performance.now();
      
      const response = await fetch("/api/speed-test/upload", {
        method: "POST",
        body: data,
        headers: {
          "Content-Type": "application/octet-stream"
        }
      });
      
      const end = performance.now();
      
      if (response.ok) {
        const durationSec = (end - start) / 1000;
        const speedMbps = (size * 8) / (durationSec * 1000000);
        speeds.push(speedMbps);
        setCurrentUpload(speedMbps);
      }
      
      setProgress(((i + 1) / testSizes.length) * 100);
    }
    
    return Math.max(...speeds);
  }, []);

  const runSpeedTest = useCallback(async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setCurrentDownload(null);
    setCurrentUpload(null);
    setCurrentPing(null);
    
    try {
      // Phase 1: Ping
      setPhase("ping");
      setProgress(0);
      const ping = await measurePing();
      setCurrentPing(ping);
      setProgress(100);
      
      // Phase 2: Download
      setPhase("download");
      setProgress(0);
      const download = await measureDownload();
      
      // Phase 3: Upload
      setPhase("upload");
      setProgress(0);
      const upload = await measureUpload();
      
      // Complete
      setPhase("complete");
      setProgress(100);
      
      // Add to results history
      setResults(prev => [
        ...prev.slice(-9), // Keep last 10 results
        {
          timestamp: Date.now(),
          download: Math.round(download * 100) / 100,
          upload: Math.round(upload * 100) / 100,
          ping,
          server: selectedServer.countryCode
        }
      ]);
      
    } catch (error) {
      console.error("Speed test failed:", error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, measurePing, measureDownload, measureUpload]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case "ping": return "Testing latency...";
      case "download": return "Testing download speed...";
      case "upload": return "Testing upload speed...";
      case "complete": return "Test complete!";
      default: return "Ready to test";
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-speed-test">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Speed Test</CardTitle>
          </div>
          <Button
            onClick={runSpeedTest}
            disabled={isRunning}
            data-testid="button-start-speed-test"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Test
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Server Selector */}
          <div className="mb-6 flex flex-col gap-3 rounded-lg bg-muted/50 p-4" data-testid="info-server-location">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Select Test Server</p>
            </div>
            <Select
              value={selectedServerId}
              onValueChange={setSelectedServerId}
              disabled={isRunning}
            >
              <SelectTrigger className="w-full" data-testid="select-server">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {TEST_SERVERS.map((server) => (
                  <SelectItem key={server.id} value={server.id} data-testid={`server-option-${server.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{server.countryCode}</span>
                      <span className="font-medium">{server.city}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-muted-foreground">{server.country}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span data-testid="text-server-provider">Provider: {selectedServer.provider}</span>
            </div>
          </div>

          {/* Progress indicator */}
          {isRunning && (
            <div className="mb-6 space-y-2" data-testid="speed-test-progress">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getPhaseLabel()}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Current Results */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-4" data-testid="result-ping">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Server className="h-4 w-4" />
                <span className="text-sm">Ping</span>
              </div>
              <p className="text-2xl font-bold" data-testid="text-ping-value">
                {currentPing !== null ? `${currentPing}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">ms</p>
            </div>
            
            <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-4" data-testid="result-download">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Download className="h-4 w-4" />
                <span className="text-sm">Download</span>
              </div>
              <p className="text-2xl font-bold text-green-500" data-testid="text-download-value">
                {currentDownload !== null ? currentDownload.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Mbps</p>
            </div>
            
            <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-4" data-testid="result-upload">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Upload className="h-4 w-4" />
                <span className="text-sm">Upload</span>
              </div>
              <p className="text-2xl font-bold text-blue-500" data-testid="text-upload-value">
                {currentUpload !== null ? currentUpload.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Mbps</p>
            </div>
          </div>

          {phase === "complete" && (
            <div className="mt-4 flex items-center justify-center gap-2 text-green-500" data-testid="test-complete-indicator">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Test completed successfully</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results History Graph */}
      {results.length > 0 && (
        <Card data-testid="card-speed-history">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Speed Test History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full" data-testid="chart-speed-history">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={results} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatTime}
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                    label={{ 
                      value: 'Mbps', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { fill: 'hsl(var(--muted-foreground))' }
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    labelFormatter={formatTime}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="download" 
                    name="Download" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="upload" 
                    name="Upload" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            {/* Ping history as badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {results.map((result, index) => (
                <Badge key={result.timestamp} variant="outline" data-testid={`badge-ping-history-${index}`}>
                  {formatTime(result.timestamp)}: {result.ping}ms ping
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
