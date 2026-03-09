/**
 * @module vercel
 * Vercel Edge Functions entry point. Deploy with:
 *
 *   vercel --prod
 *
 * Rename or symlink this to `api/index.ts` in your Vercel project,
 * or configure the build output in `vercel.json`.
 */

import { handleRequest } from "./handler.js";

// ---------------------------------------------------------------------------
// Vercel edge handler
// ---------------------------------------------------------------------------

export const config = { runtime: "edge" };

export default function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}
