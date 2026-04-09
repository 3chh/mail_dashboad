import type { NextConfig } from "next";

function getAllowedDevOrigins() {
  const origins = new Set<string>(["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "172.16.0.89", "172.29.13.46", "172.29.13.46:3000"]);
  const candidates = [process.env.APP_PUBLIC_URL, process.env.NEXTAUTH_URL, process.env.APP_URL];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const parsed = new URL(candidate);

      if (parsed.host) {
        origins.add(parsed.host);
      }

      if (parsed.hostname) {
        origins.add(parsed.hostname);
      }
    } catch {
      // Ignore invalid env values in local development.
    }
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
