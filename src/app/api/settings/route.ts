import { withUser } from "@/server/auth";
import { getTypography, setTypography } from "@/server/settings";
import { jsonBody } from "@/server/validate";

export const GET = withUser(async () => Response.json({ typography: await getTypography() }));

/** PUT { typography } (invalid values are clamped or replaced with defaults). */
export const PUT = withUser(async (req) => {
  const b = await jsonBody(req);
  return Response.json({ typography: await setTypography(b.typography) });
});
