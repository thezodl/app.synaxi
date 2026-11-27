"use client";

import { ArrowLeft, Bookmark, ExternalLink, FileText, Rss } from "lucide-react";
import { useEffect, useRef } from "react";

import type { ArticleDetail } from "@/client/hooks";
import { fullDate } from "@/client/format";
import { cn } from "@/lib/utils";

import { Favicon } from "./Favicon";

/** End-of-article visibility needed before a bookmark auto-clears. */
const CLEAR_AFTER_MS = 1500;
/** Short articles show their end immediately; wait longer so opening isn't "reading". */
const CLEAR_AFTER_SHORT_MS = 5000;

/**
 * Called once per article open when the end of the article has been visible long enough.
 * Mirrors mobile: bookmarks are the only read state, and reaching the end clears them.
 */
function useEndReached(
  scroller: React.RefObject<HTMLElement | null>,
  sentinel: React.RefObject<HTMLElement | null>,
  key: string | null,
  onReached: () => void,
) {
  const cb = useRef(onReached);
  useEffect(() => {
    cb.current = onReached;
  });

  useEffect(() => {
    const root = scroller.current;
    const el = sentinel.current;
    if (!key || !root || !el) return;
    const openedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fired = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (fired) return;
        if (e?.isIntersecting) {
          const short = Date.now() - openedAt < 300; // visible right away → short article
          timer = setTimeout(
            () => {
              fired = true;
              cb.current();
            },
            short ? CLEAR_AFTER_SHORT_MS : CLEAR_AFTER_MS,
          );
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { root },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [key, scroller, sentinel]);
}

/** Post-process sanitised HTML in the DOM: lazy images, safe external links, video posters. */
function useArticleDom(body: React.RefObject<HTMLElement | null>, html: string | undefined) {
  useEffect(() => {
    const root = body.current;
    if (!root || !html) return;
    for (const img of root.querySelectorAll("img")) {
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", () => img.classList.add("img-failed"), { once: true });
    }
    for (const a of root.querySelectorAll("a[href]")) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    }
    for (const fig of root.querySelectorAll<HTMLElement>("figure.video")) {
      fig.tabIndex = 0;
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "Play video");
    }
  }, [body, html]);
}

/** Swap a video poster for its player on click / Enter. */
function activateVideo(target: EventTarget | null) {
  const fig = (target as HTMLElement | null)?.closest?.<HTMLElement>("figure.video");
  const embed = fig?.dataset.embed;
  if (!fig || !embed || fig.querySelector("iframe")) return false;
  const iframe = document.createElement("iframe");
  iframe.src = embed;
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.title = "Video";
  fig.replaceChildren(iframe);
  fig.classList.add("playing");
  return true;
}

export function Reader({
  article,
  loading,
  error,
  showAlt,
  onToggleAlt,
  onToggleBookmark,
  onEndReached,
  onBack,
}: {
  article: ArticleDetail | undefined;
  loading: boolean;
  error: string | null;
  showAlt: boolean;
  onToggleAlt: () => void;
  onToggleBookmark: () => void;
  onEndReached: () => void;
  onBack?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const html = article ? (showAlt && article.altHtml ? article.altHtml : article.html) : undefined;

  useArticleDom(body, html);
  useEndReached(scroller, sentinel, article?.id ?? null, onEndReached);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [article?.id]);

  if (!article) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
        {loading ? (
          "Loading…"
        ) : error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          "Select an article"
        )}
      </div>
    );
  }

  const when = article.publishedAt ?? article.sortAt;
  return (
    <article className="flex h-full min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="hover:bg-muted rounded-md p-1.5"
            title="Back (Esc)"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </button>
        )}
        <div className="flex-1" />
        {article.altHtml && (
          <button
            type="button"
            onClick={onToggleAlt}
            className="hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs"
            title="Switch between the full page and the feed's version (v)"
          >
            {showAlt ? <FileText className="size-4" /> : <Rss className="size-4" />}
            {showAlt ? "Full article" : "Feed version"}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleBookmark}
          className="hover:bg-muted rounded-md p-1.5"
          title={article.bookmarkedAt ? "Remove bookmark (b)" : "Bookmark (b)"}
          aria-pressed={!!article.bookmarkedAt}
        >
          <Bookmark className={cn("size-4", article.bookmarkedAt && "text-primary fill-current")} />
          <span className="sr-only">Bookmark</span>
        </button>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-muted rounded-md p-1.5"
            title="Open original (o)"
          >
            <ExternalLink className="size-4" />
            <span className="sr-only">Open original</span>
          </a>
        )}
      </header>

      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto"
        onClick={(e) => activateVideo(e.target)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && activateVideo(e.target)) e.preventDefault();
        }}
      >
        <div className="reader mx-auto max-w-[70ch] px-6 py-8">
          <div className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
            <Favicon siteUrl={article.siteUrl} title={article.feedTitle} />
            <span>{article.feedTitle}</span>
          </div>
          <h1 className="mb-2 text-3xl leading-tight font-bold tracking-tight text-balance">
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {article.title}
              </a>
            ) : (
              article.title
            )}
          </h1>
          <p className="text-muted-foreground mb-8 text-sm">
            {article.author && <>{article.author} · </>}
            <time dateTime={new Date(when).toISOString()}>{fullDate(when)}</time>
          </p>
          <div
            ref={body}
            className="prose prose-neutral dark:prose-invert max-w-none"
            // Sanitised server-side by core/extract/sanitize (allowlisted tags/attrs only).
            dangerouslySetInnerHTML={{ __html: html ?? "" }}
          />
          <div ref={sentinel} aria-hidden className="h-px" />
          <footer className="text-muted-foreground mt-12 border-t pt-4 text-xs">
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Read on {article.feedTitle} →
              </a>
            )}
          </footer>
        </div>
      </div>
    </article>
  );
}
