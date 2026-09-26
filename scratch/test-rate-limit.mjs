// scratch/test-rate-limit.mjs
async function testRateLimitBypass() {
  const url = "http://localhost:3001/api/auth/login";
  console.log("Testing X-Forwarded-For rate limit header spoofing...");

  // Send request with spoofed IP
  const res1 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "203.0.113.195",
    },
    body: JSON.stringify({ email: "invalid@test.com", password: "invalid" }),
  });

  const remaining1 = res1.headers.get("ratelimit-remaining");
  console.log("Response 1 status:", res1.status, "RateLimit-Remaining:", remaining1);

  // Send request with different spoofed IP
  const res2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.42",
    },
    body: JSON.stringify({ email: "invalid@test.com", password: "invalid" }),
  });

  const remaining2 = res2.headers.get("ratelimit-remaining");
  console.log("Response 2 status:", res2.status, "RateLimit-Remaining:", remaining2);

  if (remaining1 === remaining2) {
    console.log("VULNERABILITY CONFIRMED: Rate limiter reset by changing X-Forwarded-For header! Attacker can brute-force indefinitely by rotating client IP header.");
  } else {
    console.log("Header was ignored or keyed differently.");
  }
}

testRateLimitBypass();
