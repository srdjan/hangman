import { AUTH_CONFIG } from "../auth/config.ts";

const kv = await Deno.openKv();

interface RateLimitInfo {
  requests: number;
  resetTime: number;
}

export async function rateLimit(request: Request): Promise<{ response?: Response; rateLimitHeaders?: Record<string, string> }> {
  const clientIp = request.headers.get("x-forwarded-for") || 
                   request.headers.get("x-real-ip") || 
                   "unknown";
  
  const key = ["rate_limit", clientIp];
  const now = Date.now();
  
  // Get current rate limit info
  const result = await kv.get<RateLimitInfo>(key);
  let rateLimitInfo = result.value;
  
  if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
    // Reset or initialize rate limit
    rateLimitInfo = {
      requests: 1,
      resetTime: now + AUTH_CONFIG.RATE_LIMIT_WINDOW_MS,
    };
  } else {
    rateLimitInfo.requests++;
  }
  
  // Store updated rate limit info
  await kv.set(key, rateLimitInfo, { expireIn: AUTH_CONFIG.RATE_LIMIT_WINDOW_MS });
  
  const rateLimitHeaders = {
    "X-RateLimit-Limit": AUTH_CONFIG.RATE_LIMIT_MAX_REQ.toString(),
    "X-RateLimit-Remaining": Math.max(0, AUTH_CONFIG.RATE_LIMIT_MAX_REQ - rateLimitInfo.requests).toString(),
    "X-RateLimit-Reset": rateLimitInfo.resetTime.toString(),
  };
  
  // Check if limit exceeded
  if (rateLimitInfo.requests > AUTH_CONFIG.RATE_LIMIT_MAX_REQ) {
    const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
    
    return {
      response: new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          ...rateLimitHeaders,
        },
      })
    };
  }
  
  return { rateLimitHeaders };
}

export async function securityHeaders(response: Response, additionalHeaders?: Record<string, string>): Promise<Response> {
  const headers = new Headers(response.headers);
  
  // Add additional headers first
  if (additionalHeaders) {
    for (const [key, value] of Object.entries(additionalHeaders)) {
      headers.set(key, value);
    }
  }
  
  // Security headers
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self'; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'"
  );
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}