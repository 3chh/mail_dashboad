import { getGoogleAuthClientForUser } from "./lib/gmail/oauth";
import { google } from "googleapis";

async function main() {
  const auth = await getGoogleAuthClientForUser("cmn7v1vuu0000b2ywj9rv4iml"); // from db_output2.json
  const gmail = google.gmail({ version: "v1", auth });

  const q = 'after:2026/03/25 before:2026/03/27';

  console.log(`Query: ${q}`);
  
  const start = Date.now();
  const r = await gmail.users.messages.list({ userId: "me", q, maxResults: 500 });
  const exactCount = r.data.messages?.length || 0;
  const isExact = !r.data.nextPageToken;
  
  console.log(`Exact count: ${exactCount}, isExact: ${isExact}, took: ${Date.now() - start}ms`);
}

main().catch(console.error);
