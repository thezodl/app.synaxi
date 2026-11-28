"use client";

import { Bookmark, PanelLeftOpen, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ArticleListItem } from "@/client/hooks";
import { relativeTime } from "@/client/format";
import { cn } from "@/lib/utils";

import { Favicon } from "./Favicon";

function Row({
  a,
  selected,
  onSelect,
}: {
  a: ArticleListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(a.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 border-b px-4 py-3 text-left",
        "hover:bg-muted/60 focus-visible:bg-muted/60 outline-none",
        selected && "bg-muted",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
          <Favicon siteUrl={a.siteUrl} title={a.feedTitle} className="size-3.5" />
          <span className="truncate">{a.feedTitle}</span>
          <span aria-hidden>·</span>
          <time dateTime={new Date(a.sortAt).toISOString()} className="shrink-0">
            {relativeTime(a.sortAt)}
          </time>
          {a.bookmarkedAt && (
            <Bookmark
              className="text-primary ml-auto size-3.5 shrink-0 fill-current"
              aria-label="Bookmarked"
            />
          )}
        </div>
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">{a.title}</h3>
        {a.excerpt && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {a.excerpt}
          </p>
        )}
      </div>
      {a.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote feed images, loaded directly
        <img
          src={a.thumbnailUrl}
          alt=""
          loading="lazy"
          className="bg-muted size-16 shrink-0 rounded-md object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
    </button>
  );
}

export function ArticleList({
  title,
  items,
  selectedId,
  onSelect,
  loading,
  error,
  hasMore,
  loadMore,
  loadingMore,
  empty,
  notice,
  refreshing,
  onShowSidebar,
  showSidebarProps,
}: {
  notice?: string | null;
  refreshing?: boolean;
  /** Shown when the sidebar is hidden (collapsed, or a drawer on small screens). */
  onShowSidebar?: () => void;
  /** Extra handlers for the show-sidebar button (hover to peek). */
  showSidebarProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  title: string;
  items: ArticleListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  empty: React.ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && loadMore(), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <section className="flex h-full min-w-0 flex-col border-r" aria-label={title}>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
        {onShowSidebar && (
          <button
            type="button"
            {...showSidebarProps}
            onClick={onShowSidebar}
            title="Show sidebar ([)"
            className="hover:bg-muted rounded-md p-1.5"
          >
            <PanelLeftOpen className="size-4" />
            <span className="sr-only">Show sidebar</span>
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate px-2 font-semibold">{title}</h2>
        {refreshing && (
          <RefreshCw
            className="text-muted-foreground mr-2 size-3.5 animate-spin"
            aria-label="Refreshing"
          />
        )}
      </header>
      {notice && (
        <p role="status" className="bg-destructive/10 text-destructive border-b px-4 py-2 text-xs">
          {notice}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && <p className="text-muted-foreground p-4 text-sm">Loading…</p>}
        {error && <p className="text-destructive p-4 text-sm">{error}</p>}
        {!loading && !error && items.length === 0 && empty}
        {items.map((a) => (
          <Row key={a.id} a={a} selected={a.id === selectedId} onSelect={onSelect} />
        ))}
        {hasMore && (
          <div ref={sentinel} className="text-muted-foreground p-4 text-center text-xs">
            {loadingMore ? "Loading…" : ""}
          </div>
        )}
      </div>
    </section>
  );
}
