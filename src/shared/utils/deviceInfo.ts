import { Request } from "express";
import { UAParser } from "ua-parser-js"; 
import axios from "axios";
import logger from "./logger";
import redisClient from "../config/redis";

interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location: string;
}


/**
 * Normalizes IPv4-mapped IPv6 addresses to plain IPv4.
 * "::ffff:192.168.1.1" => "192.168.1.1"
 * "::ffff:8.8.8.8"     => "8.8.8.8"
 */
function normalizeIP(ip: string): string {
  if (!ip) return ip;
  const ipv4MappedPrefix = /^::ffff:/i;
  return ipv4MappedPrefix.test(ip) ? ip.replace(/^::ffff:/i, "") : ip;
}

/**
 * Returns true for any IP that cannot be geolocated externally.
 */
function isPrivateOrLocal(ip: string): boolean {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return true;

  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,  
    /^fc00:/i,  
    /^fe80:/i,  
  ];

  return privateRanges.some((r) => r.test(ip));
}

async function getLocationFromIP(ipAddress: string): Promise<string> {
  try {
    const normalized = normalizeIP(ipAddress);

    if (isPrivateOrLocal(normalized)) {
      return "Local Network";
    }

    const cacheKey = `ip_location:${normalized}`;
    const cachedLocation = await redisClient.get(cacheKey);

    if (cachedLocation) {
      logger.info("Location retrieved from cache", { ipAddress: normalized, location: cachedLocation });
      return cachedLocation;
    }

    const response = await axios.get(
      `http://ip-api.com/json/${normalized}?fields=status,country,city,regionName`,
      { timeout: 3000 }
    );

    if (response.data.status === "success") {
      const { city, regionName, country } = response.data;
      const location =
        regionName && regionName !== city
          ? `${city}, ${regionName}, ${country}`
          : `${city}, ${country}`;

      await redisClient.setex(cacheKey, 14 * 24 * 60 * 60, location);

      logger.info("Location resolved and cached", { ipAddress: normalized, location });
      return location;
    } else {
      logger.warn("IP geolocation API returned failure status", {
        ipAddress: normalized,
        status: response.data.status,
      });
      return "Unknown Location";
    }
  } catch (error: any) {
    logger.error("Error fetching IP location", {
      ipAddress,
      error: error.message,
    });
    return "Unknown Location";
  }
}

export async function extractDeviceInfo(req: Request): Promise<DeviceInfo> {
  const parser = new UAParser(req.headers["user-agent"]);
  const result = parser.getResult();

  const rawIP =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.ip ||
    req.socket?.remoteAddress || 
    "Unknown";

  const ipAddress = normalizeIP(rawIP);
  const location = await getLocationFromIP(ipAddress);

  return {
    device: result.device.type || "Desktop",
    browser: `${result.browser.name || "Unknown"} ${result.browser.version || ""}`.trim(),
    os: result.os.name || "Unknown",
    ipAddress,
    location,
  };
}