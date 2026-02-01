#!/usr/bin/env node
/**
 * Test script to verify Pipedream API connectivity
 * Run with: node scripts/test-pipedream.mjs
 */

import 'dotenv/config';

const PIPEDREAM_API_URL = "https://api.pipedream.com";
const CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID;
const CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET;
const PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID;

console.log("\n🔍 Pipedream Configuration Check\n");
console.log("================================");
console.log(`CLIENT_ID:     ${CLIENT_ID ? CLIENT_ID.substring(0, 10) + "..." : "❌ NOT SET"}`);
console.log(`CLIENT_SECRET: ${CLIENT_SECRET ? "✅ SET (hidden)" : "❌ NOT SET"}`);
console.log(`PROJECT_ID:    ${PROJECT_ID || "❌ NOT SET"}`);

// Validate Project ID format
if (PROJECT_ID) {
  if (PROJECT_ID.startsWith("o_")) {
    console.log("\n⚠️  WARNING: Your PROJECT_ID starts with 'o_' - this is an ORGANIZATION ID!");
    console.log("   Pipedream Connect requires a PROJECT ID which starts with 'proj_'");
    console.log("   Go to: https://pipedream.com/projects → Create/Select a Connect project → Settings");
  } else if (PROJECT_ID.startsWith("proj_")) {
    console.log("\n✅ PROJECT_ID format looks correct (proj_xxx)");
  } else {
    console.log(`\n⚠️  WARNING: PROJECT_ID format is unexpected: ${PROJECT_ID}`);
  }
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log("\n❌ Missing credentials. Cannot proceed with API tests.");
  process.exit(1);
}

console.log("\n================================");
console.log("🧪 Testing API Endpoints\n");

// Get OAuth token
async function getAccessToken() {
  console.log("1️⃣  Getting OAuth access token...");
  
  const response = await fetch(`${PIPEDREAM_API_URL}/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(`   ❌ Failed: ${response.status} - ${error}`);
    return null;
  }

  const data = await response.json();
  console.log(`   ✅ Success! Token expires in ${data.expires_in}s`);
  return data.access_token;
}

// Test apps endpoint (global, should work)
async function testAppsEndpoint(token) {
  console.log("\n2️⃣  Testing /v1/apps (global apps list)...");
  
  const response = await fetch(`${PIPEDREAM_API_URL}/v1/apps?limit=5`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(`   ❌ Failed: ${response.status} - ${error}`);
    return;
  }

  const data = await response.json();
  console.log(`   ✅ Success! Found ${data.data?.length || 0} apps`);
  if (data.data?.length > 0) {
    console.log(`   Sample apps: ${data.data.slice(0, 3).map(a => a.name).join(", ")}`);
  }
}

// Test Connect tokens endpoint
async function testConnectTokens(token) {
  if (!PROJECT_ID) {
    console.log("\n3️⃣  Skipping /v1/connect/{project}/tokens - no PROJECT_ID set");
    return;
  }
  
  console.log(`\n3️⃣  Testing /v1/connect/${PROJECT_ID}/tokens...`);
  
  const response = await fetch(`${PIPEDREAM_API_URL}/v1/connect/${PROJECT_ID}/tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-pd-environment": "development",
    },
    body: JSON.stringify({
      external_user_id: "test-user-123",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(`   ❌ Failed: ${response.status} - ${error}`);
    
    if (response.status === 404) {
      console.log("\n   💡 This 404 likely means:");
      console.log("      - The PROJECT_ID is wrong (should be proj_xxx, not o_xxx)");
      console.log("      - The project doesn't exist or isn't a Connect project");
      console.log("      - Go to https://pipedream.com/projects and create a Connect project");
    }
    return;
  }

  const data = await response.json();
  console.log(`   ✅ Success! Got connect token`);
  console.log(`   Token: ${data.token?.substring(0, 20)}...`);
  console.log(`   Connect URL: ${data.connect_link_url}`);
}

// Run tests
async function main() {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.log("\n❌ Cannot continue without access token");
      process.exit(1);
    }

    await testAppsEndpoint(token);
    await testConnectTokens(token);

    console.log("\n================================");
    console.log("📋 Summary\n");
    
    if (PROJECT_ID?.startsWith("o_")) {
      console.log("🔴 ISSUE FOUND: You're using an organization ID instead of a project ID.");
      console.log("\nTo fix this:");
      console.log("1. Go to https://pipedream.com/projects");
      console.log("2. Create a new project (or select existing Connect project)");
      console.log("3. Go to project Settings → OAuth Clients");
      console.log("4. Copy the Project ID (starts with proj_)");
      console.log("5. Update PIPEDREAM_PROJECT_ID in your .env file");
    }
    
    console.log("");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
