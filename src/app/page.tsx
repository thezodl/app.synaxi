"use client";

import { useQuery } from "@tanstack/react-query";

import { buttonVariants } from "@/components/ui/button";
import { api } from "@/client/api";

interface Me {
  sub: string;
  db: { ok: boolean; ms: number };
}

/** Phase 0 placeholder: proves login → access token → /api → Neon. Replaced by the reader in Phase 1. */
export default function Home() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/me") });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Synaxi</h1>
      <section className="rounded-lg border p-4 text-sm">
        {me.isPending && <p className="text-muted-foreground">Checking API…</p>}
        {me.isError && <p className="text-destructive">API error: {me.error.message}</p>}
        {me.data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">User</dt>
            <dd className="font-mono break-all">{me.data.sub}</dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd>{me.data.db.ok ? `ok (${me.data.db.ms} ms)` : "unavailable"}</dd>
          </dl>
        )}
      </section>
      <div>
        {/* Plain <a>: logout must be a real navigation, not a prefetched Link. */}
        <a className={buttonVariants({ variant: "outline" })} href="/auth/logout">
          Log out
        </a>
      </div>
    </main>
  );
}
