import type { Express, Request } from "express";
import { createServer, type Server } from "http";

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

  return httpServer;
}
