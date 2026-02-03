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

  // Server info endpoint - returns server location
  app.get("/api/server-info", async (req, res) => {
    try {
      // Get server's public IP and location
      const response = await fetch(
        "http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,lat,lon,timezone,query"
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch server info");
      }
      
      const data = await response.json();
      
      res.json({
        ip: data.query,
        city: data.city,
        region: data.regionName,
        country: data.country,
        countryCode: data.countryCode,
        latitude: data.lat,
        longitude: data.lon,
        timezone: data.timezone,
        provider: "Replit (Google Cloud)"
      });
    } catch (error) {
      console.error("Error fetching server info:", error);
      res.json({
        ip: "Unknown",
        city: "The Dalles",
        region: "Oregon",
        country: "United States",
        countryCode: "US",
        provider: "Replit (Google Cloud)"
      });
    }
  });

  return httpServer;
}
