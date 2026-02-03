import { z } from "zod";

export const networkInfoSchema = z.object({
  ip: z.string(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().optional(),
  isp: z.string().optional(),
  org: z.string().optional(),
  asn: z.string().optional(),
  connectionType: z.string().optional(),
});

export type NetworkInfo = z.infer<typeof networkInfoSchema>;

export const browserInfoSchema = z.object({
  userAgent: z.string(),
  platform: z.string(),
  language: z.string(),
  cookiesEnabled: z.boolean(),
  doNotTrack: z.boolean(),
  screenWidth: z.number(),
  screenHeight: z.number(),
  colorDepth: z.number(),
  pixelRatio: z.number(),
  online: z.boolean(),
  connectionType: z.string().optional(),
  effectiveType: z.string().optional(),
  downlink: z.number().optional(),
  rtt: z.number().optional(),
});

export type BrowserInfo = z.infer<typeof browserInfoSchema>;
