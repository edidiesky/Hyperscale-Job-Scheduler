import { UAParser } from 'ua-parser-js';
export interface ParsedUserAgent {
  browser: {
    name?: string;
    version?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string;
    vendor?: string;
    model?: string;
  };
  isBot: boolean;
  full: string;
}

export const parseUserAgent = (userAgent: string): ParsedUserAgent => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const isBot = /bot|crawl|spider|headless/i.test(userAgent);

  return {
    browser: {
      name: result.browser.name,
      version: result.browser.version,
    },
    os: {
      name: result.os.name,
      version: result.os.version,
    },
    device: {
      type: result.device.type || "desktop",
      vendor: result.device.vendor,
      model: result.device.model,
    },
    isBot,
    full: userAgent,
  };
};