import { Suspense } from "react";

import { ReaderApp } from "@/ui/ReaderApp";

/**
 * Static shell. The proxy guarantees a session before this renders; all data comes from
 * `/api/*` with a Bearer token. `useSearchParams` needs the Suspense boundary to prerender.
 */
export default function Home() {
  return (
    <Suspense>
      <ReaderApp />
    </Suspense>
  );
}
