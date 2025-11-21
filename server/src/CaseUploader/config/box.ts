// import BoxSDK from "box-node-sdk";
// import dotenv from "dotenv";
// import axios from "axios";

// dotenv.config();

// const sdk = new BoxSDK({
//   clientID: process.env.BOX_CLIENT_ID,
//   clientSecret: process.env.BOX_CLIENT_SECRET,
// });

// // Token cache
// let cachedToken: string | null = null;
// let tokenExpiry: number = 0;

// // Fetch token from Box
// async function fetchNewToken(): Promise<string> {
//   const response = await axios.post(
//     "https://api.box.com/oauth2/token",
//     new URLSearchParams({
//       client_id: process.env.BOX_CLIENT_ID!,
//       client_secret: process.env.BOX_CLIENT_SECRET!,
//       grant_type: "client_credentials",
//       box_subject_type: "enterprise",
//       box_subject_id: "943437932",
//       scopes: "base_upload",
//     }),
//     {
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//       },
//     }
//   );

//   const accessToken = response.data.access_token;
//   console.log("🔑 New Box token fetched:", accessToken);

//   // Cache token with expiry
//   cachedToken = accessToken;
//   tokenExpiry = Date.now() + 40 * 60 * 1000; // 40 minutes

//   return accessToken;
// }

// // Get token (from cache or refresh if expired)
// async function getBoxAccessToken(): Promise<string> {
//   const now = Date.now();
//   if (cachedToken && now < tokenExpiry) {
//     return cachedToken;
//   }
//   return fetchNewToken();
// }

// // Background auto-refresh every 40 min
// setInterval(() => {
//   fetchNewToken().catch((err) =>
//     console.error("⚠️ Failed to refresh Box token:", err.message)
//   );
// }, 40 * 60 * 1000); // 40 minutes

// // Initialize Box client
// async function initializeBoxClient() {
//   const accessToken = await getBoxAccessToken();
//   return sdk.getBasicClient(accessToken);
// }

// export { initializeBoxClient, getBoxAccessToken };
// export default initializeBoxClient;



import BoxSDK from "box-node-sdk";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const sdk = new BoxSDK({
  clientID: process.env.BOX_CLIENT_ID!,
  clientSecret: process.env.BOX_CLIENT_SECRET!,
});

// Token cache
let cachedToken: string | null = null;
let tokenExpiry = 0;

// Fetch token from Box
async function fetchNewToken(): Promise<string> {
  const response = await axios.post(
    "https://api.box.com/oauth2/token",
    new URLSearchParams({
      client_id: process.env.BOX_CLIENT_ID!,
      client_secret: process.env.BOX_CLIENT_SECRET!,
      grant_type: "client_credentials",
      box_subject_type: "enterprise",
      box_subject_id: "943437932",
      scopes: "base_upload",
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const accessToken = response.data.access_token;
  console.log("🔑 New Box token fetched:", accessToken);

  cachedToken = accessToken;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000) - (5 * 60 * 1000); 
  // expire 5 min early for safety

  return accessToken;
}

// Get token (cached or refresh)
async function getBoxAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  return fetchNewToken();
}

// Initialize Box client (async/await version)
async function initializeBoxClient() {
  const accessToken = await getBoxAccessToken();
  return sdk.getBasicClient(accessToken);
}

// 🔙 Backward-compatible wrapper for old code
function getClient(cb: (client: any) => void, force = false) {
  (async () => {
    try {
      if (!force && cachedToken && Date.now() < tokenExpiry) {
        cb(sdk.getBasicClient(cachedToken));
        return;
      }
      const token = await fetchNewToken();
      cb(sdk.getBasicClient(token));
    } catch (err: any) {
      console.error("⚠️ Failed to get Box client:", err.message);
      throw err;
    }
  })();
}

export { initializeBoxClient, getBoxAccessToken, getClient };
export default initializeBoxClient;
