import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";

interface IpApiResponse {
  query: string;
  status: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
}

const DOWNLOAD_CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const UPLOAD_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB max upload

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return req.socket.remoteAddress || '0.0.0.0';
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/network-info", async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      
      const isPrivateIp = 
        clientIp === '127.0.0.1' || 
        clientIp === '::1' || 
        clientIp.startsWith('192.168.') || 
        clientIp.startsWith('10.') || 
        clientIp.startsWith('172.') ||
        clientIp === '0.0.0.0';
      
      const ipToLookup = isPrivateIp ? '' : clientIp;
      
      const response = await fetch(
        `http://ip-api.com/json/${ipToLookup}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`
      );
      
      if (!response.ok) {
        throw new Error(`IP API returned ${response.status}`);
      }
      
      const data: IpApiResponse = await response.json();
      
      if (data.status !== 'success') {
        return res.json({
          ip: clientIp || 'Unknown',
          city: undefined,
          region: undefined,
          country: undefined,
          countryCode: undefined,
          latitude: undefined,
          longitude: undefined,
          timezone: undefined,
          isp: undefined,
          org: undefined,
          asn: undefined,
          connectionType: undefined,
        });
      }
      
      res.json({
        ip: data.query,
        city: data.city,
        region: data.regionName,
        country: data.country,
        countryCode: data.countryCode,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        asn: data.as,
        connectionType: undefined,
      });
    } catch (error) {
      console.error("Error fetching network info:", error);
      res.status(500).json({ error: "Failed to fetch network information" });
    }
  });

  app.get("/api/ping", (req, res) => {
    res.json({ pong: Date.now() });
  });

  // Speed test download endpoint - sends random data
  app.get("/api/speed-test/download", (req, res) => {
    const size = Math.min(
      parseInt(req.query.size as string) || DOWNLOAD_CHUNK_SIZE,
      DOWNLOAD_CHUNK_SIZE * 10
    );
    
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", size.toString());
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    
    // Generate and send random data in chunks
    let remaining = size;
    const chunkSize = 64 * 1024; // 64KB chunks
    
    const sendChunk = () => {
      if (remaining <= 0) {
        res.end();
        return;
      }
      
      const toSend = Math.min(remaining, chunkSize);
      const chunk = randomBytes(toSend);
      remaining -= toSend;
      
      if (!res.write(chunk)) {
        res.once("drain", sendChunk);
      } else {
        setImmediate(sendChunk);
      }
    };
    
    sendChunk();
  });

  // Speed test upload endpoint - receives data and measures
  app.post("/api/speed-test/upload", (req, res) => {
    let bytesReceived = 0;
    const startTime = Date.now();
    
    req.on("data", (chunk: Buffer) => {
      bytesReceived += chunk.length;
      
      if (bytesReceived > UPLOAD_SIZE_LIMIT) {
        res.status(413).json({ error: "Upload too large" });
        req.destroy();
      }
    });
    
    req.on("end", () => {
      const duration = Date.now() - startTime;
      res.json({
        bytesReceived,
        durationMs: duration,
        speedMbps: duration > 0 ? (bytesReceived * 8) / (duration * 1000) : 0
      });
    });
    
    req.on("error", (err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    });
  });

  // Weather endpoint - uses Open-Meteo (free, no API key required)
  app.get("/api/weather", async (req, res) => {
    try {
      const lat = req.query.lat as string;
      const lon = req.query.lon as string;
      
      if (!lat || !lon) {
        return res.status(400).json({ error: "Latitude and longitude required" });
      }
      
      // Fetch weather data from Open-Meteo
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index&timezone=auto`
      );
      
      if (!weatherResponse.ok) {
        throw new Error("Failed to fetch weather data");
      }
      
      const data = await weatherResponse.json();
      const current = data.current;
      
      // Map weather codes to descriptions
      const weatherDescriptions: Record<number, { description: string; icon: string }> = {
        0: { description: "Clear sky", icon: "sun" },
        1: { description: "Mainly clear", icon: "sun" },
        2: { description: "Partly cloudy", icon: "cloud-sun" },
        3: { description: "Overcast", icon: "cloud" },
        45: { description: "Foggy", icon: "cloud-fog" },
        48: { description: "Depositing rime fog", icon: "cloud-fog" },
        51: { description: "Light drizzle", icon: "cloud-drizzle" },
        53: { description: "Moderate drizzle", icon: "cloud-drizzle" },
        55: { description: "Dense drizzle", icon: "cloud-drizzle" },
        61: { description: "Slight rain", icon: "cloud-rain" },
        63: { description: "Moderate rain", icon: "cloud-rain" },
        65: { description: "Heavy rain", icon: "cloud-rain" },
        71: { description: "Slight snow", icon: "snowflake" },
        73: { description: "Moderate snow", icon: "snowflake" },
        75: { description: "Heavy snow", icon: "snowflake" },
        80: { description: "Slight rain showers", icon: "cloud-rain" },
        81: { description: "Moderate rain showers", icon: "cloud-rain" },
        82: { description: "Violent rain showers", icon: "cloud-rain" },
        95: { description: "Thunderstorm", icon: "cloud-lightning" },
        96: { description: "Thunderstorm with hail", icon: "cloud-lightning" },
        99: { description: "Thunderstorm with heavy hail", icon: "cloud-lightning" },
      };
      
      const weatherCode = current.weather_code || 0;
      const weatherInfo = weatherDescriptions[weatherCode] || { description: "Unknown", icon: "cloud" };
      
      res.json({
        temperature: current.temperature_2m,
        temperatureUnit: data.current_units?.temperature_2m || "°C",
        feelsLike: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        windSpeedUnit: data.current_units?.wind_speed_10m || "km/h",
        windDirection: current.wind_direction_10m,
        pressure: current.pressure_msl,
        uvIndex: current.uv_index,
        weatherCode: weatherCode,
        description: weatherInfo.description,
        icon: weatherInfo.icon,
        timezone: data.timezone
      });
    } catch (error) {
      console.error("Error fetching weather:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  return httpServer;
}
