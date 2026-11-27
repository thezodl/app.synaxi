"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, download } from "@/client/api";
import { useIsLarge, usePersistentFlag } from "@/client/useLayout";
import {
  useArticle,
  useArticles,
  useBookmark,
  useManage,
  useRefreshFeed,
  useSync,
  useTree,
} from "@/client/hooks";
import { isUuid, parseView, viewKey, type View } from "@/core/views";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ArticleList } from "./ArticleList";
import { ImportDialog } from "./ImportDialog";
import { Reader } from "./Reader";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { AddFeedDialog } from "./AddFeedDialog";
import { ConfirmDialog, PromptDialog } from "./dialogs";
import { orderedViews, Sidebar, viewTitle, type SidebarAction } from "./Sidebar";

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

/** `?view=…&article=…` in the URL, so reload and back/forward work (same scheme as mobile). */
function useUrlState() {
  const params = useSearchParams();
  const view = useMemo(() => parseView(params.get("view")), [params]);
  const articleParam = params.get("article");
  const articleId = isUuid(articleParam) ? articleParam : null;

  const navigate = useCallback(
    (next: { view?: View; article?: string | null }, mode: "push" | "replace" = "push") => {
      const q = new URLSearchParams(window.location.search);
      if (next.view) {
        const k = viewKey(next.view);
        if (k === "all") q.delete("view");
        else q.set("view", k);
      }
      if (next.article !== undefined) {
        if (next.article) q.set("article", next.article);
        else q.delete("article");
      }
      const url = `${window.location.pathname}${q.size ? `?${q}` : ""}`;
      // Next syncs useSearchParams with the native History API.
      window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
    },
    [],
  );
  return { view, articleId, navigate };
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

export function ReaderApp() {
  const { view, articleId, navigate } = useUrlState();
  const tree = useTree();
  const list = useArticles(view);
  const article = useArticle(articleId);
  const bookmark = useBookmark();
  const sync = useSync();

  // Sidebar: a column on large screens (remembered), an overlay drawer below `lg`.
  const isLarge = useIsLarge();
  const [sidebarPinned, setSidebarPinned] = usePersistentFlag("synaxi.sidebar", true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleSidebar = useCallback(() => {
    if (isLarge) setSidebarPinned(!sidebarPinned);
    else setDrawerOpen((o) => !o);
  }, [isLarge, sidebarPinned, setSidebarPinned]);
  const sidebarColumn = isLarge && sidebarPinned;
  const refreshFeed = useRefreshFeed();
  const [importOpen, setImportOpen] = useState(false);
  /** The open management dialog, if any (from the sidebar menus). */
  const [action, setAction] = useState<SidebarAction | null>(null);
  const manage = useManage();
  const [helpOpen, setHelpOpen] = useState(false);
  // "Feed version" toggle, remembered per article so it resets when the article changes.
  const [altFor, setAltFor] = useState<string | null>(null);
  const showAlt = !!articleId && altFor === articleId;
  const toggleAlt = useCallback(
    () => setAltFor((cur) => (cur === articleId ? null : articleId)),
    [articleId],
  );

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const views = useMemo(() => orderedViews(tree.data), [tree.data]);

  // Sync on open (the server skips it if one finished in the last 15 minutes).
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    sync.mutate(true);
  }, [sync]);

  const selectView = useCallback(
    (v: View) => {
      navigate({ view: v, article: null });
      setDrawerOpen(false);
    },
    [navigate],
  );
  const selectArticle = useCallback((id: string | null) => navigate({ article: id }), [navigate]);

  const runSync = useCallback(() => {
    sync.mutate(false, {
      onSuccess: (r) => {
        if (r.status === "skipped" && r.reason === "running") toast("A sync is already running");
        else if (r.status === "done") {
          const { lastAdded, failedFeeds } = r.state;
          toast(
            `${lastAdded} new article${lastAdded === 1 ? "" : "s"}` +
              (failedFeeds ? ` · ${failedFeeds} feed${failedFeeds === 1 ? "" : "s"} failed` : ""),
          );
        }
      },
      onError: (e) => toast.error(errorText(e) ?? "Sync failed"),
    });
  }, [sync]);

  const toggleBookmark = useCallback(() => {
    const a = article.data;
    if (!a) return;
    bookmark.mutate({ id: a.id, on: !a.bookmarkedAt });
  }, [article.data, bookmark]);

  // Reaching the end of a bookmarked article clears the bookmark, with Undo.
  const onEndReached = useCallback(() => {
    const a = article.data;
    if (!a?.bookmarkedAt) return;
    const restoreAt = a.bookmarkedAt;
    bookmark.mutate({ id: a.id, on: false });
    toast("Bookmark cleared", {
      action: { label: "Undo", onClick: () => bookmark.mutate({ id: a.id, on: true, restoreAt }) },
    });
  }, [article.data, bookmark]);

  const onAction = useCallback(
    (a: SidebarAction) => {
      switch (a.kind) {
        case "import":
          setImportOpen(true);
          return;
        case "shortcuts":
          setHelpOpen(true);
          return;
        case "collapse":
          toggleSidebar();
          return;
        case "logout":
          // /auth/logout is handled by the Auth0 SDK in proxy.ts: it needs a full navigation.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/auth/logout");
          return;
        case "export":
          download("/api/opml", "synaxi.opml").catch((e) =>
            toast.error(errorText(e) ?? "Export failed"),
          );
          return;
        case "moveFeed":
          manage.updateFeed.mutate(
            { id: a.feed.id, folderId: a.folderId },
            { onError: (e) => toast.error(errorText(e) ?? "Couldn't move the feed") },
          );
          return;
        default:
          setAction(a);
      }
    },
    [manage.updateFeed, toggleSidebar],
  );
  const dialogsOpen = importOpen || helpOpen || action !== null;

  // Opening a feed refreshes it (server skips it if fetched in the last 30s).
  const openedFeedId = view.kind === "feed" ? view.id : null;
  const refreshFeedMutate = refreshFeed.mutate;
  useEffect(() => {
    if (openedFeedId) refreshFeedMutate(openedFeedId);
  }, [openedFeedId, refreshFeedMutate]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e) || dialogsOpen) return;
      // Let open menus/popovers (Base UI) handle their own keys.
      if (document.querySelector("[data-open][role=menu], [data-open][role=dialog]")) return;
      const idx = items.findIndex((a) => a.id === articleId);
      const step = (d: number) => {
        const next = items[idx < 0 ? 0 : Math.min(items.length - 1, Math.max(0, idx + d))];
        if (next) selectArticle(next.id);
        if (d > 0 && idx >= items.length - 3 && list.hasNextPage) list.fetchNextPage();
      };
      const vi = views.findIndex((v) => viewKey(v) === viewKey(view));
      switch (e.key) {
        case "j":
          step(1);
          break;
        case "k":
          step(-1);
          break;
        case "n":
          if (views[vi + 1]) selectView(views[vi + 1]!);
          break;
        case "p":
          if (vi > 0) selectView(views[vi - 1]!);
          break;
        case "o":
          if (article.data?.url) window.open(article.data.url, "_blank", "noopener,noreferrer");
          break;
        case "b":
          toggleBookmark();
          break;
        case "v":
          if (article.data?.altHtml) toggleAlt();
          break;
        case "a":
          onAction({ kind: "addFeed", folderId: view.kind === "folder" ? view.id : null });
          break;
        case "r":
          runSync();
          break;
        case "[":
          toggleSidebar();
          break;
        case "Escape":
          if (articleId) selectArticle(null);
          break;
        case "?":
          setHelpOpen(true);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    items,
    articleId,
    views,
    view,
    article.data,
    list,
    dialogsOpen,
    onAction,
    toggleSidebar,
    selectArticle,
    selectView,
    toggleBookmark,
    runSync,
    toggleAlt,
  ]);

  const noFeeds = tree.data && tree.data.feeds.length === 0;
  const currentFeed =
    view.kind === "feed" ? tree.data?.feeds.find((f) => f.id === view.id) : undefined;
  const feedNotice = currentFeed?.lastError
    ? `Last fetch failed: ${currentFeed.lastError}. Showing what was fetched before.`
    : null;
  const empty = noFeeds ? (
    <div className="space-y-3 p-6 text-sm">
      <p>No feeds yet. Import your Feedly OPML export to get started.</p>
      <Button onClick={() => setImportOpen(true)}>Import OPML</Button>
    </div>
  ) : (
    <p className="text-muted-foreground p-6 text-sm">
      {view.kind === "bookmarks" ? "No bookmarks." : "Nothing here yet."}
    </p>
  );

  return (
    <div
      className={cn(
        "grid h-dvh overflow-hidden",
        sidebarColumn
          ? "grid-cols-1 lg:grid-cols-[16rem_24rem_minmax(0,1fr)]"
          : "grid-cols-1 lg:grid-cols-[24rem_minmax(0,1fr)]",
      )}
    >
      {(sidebarColumn || (!isLarge && drawerOpen)) && (
        <div
          className={cn(
            "min-h-0",
            !sidebarColumn && "fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] shadow-xl",
          )}
        >
          <Sidebar
            tree={tree.data}
            view={view}
            onSelect={selectView}
            onSync={runSync}
            syncing={sync.isPending}
            onAction={onAction}
          />
        </div>
      )}
      {!isLarge && drawerOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      {/* Below lg, the reader replaces the list when an article is open. */}
      <div className={cn("min-h-0", articleId && "hidden lg:block")}>
        <ArticleList
          title={viewTitle(view, tree.data)}
          items={items}
          selectedId={articleId}
          onSelect={selectArticle}
          loading={list.isPending}
          error={errorText(list.error)}
          hasMore={!!list.hasNextPage}
          loadMore={() => !list.isFetchingNextPage && list.fetchNextPage()}
          loadingMore={list.isFetchingNextPage}
          empty={empty}
          notice={feedNotice}
          refreshing={refreshFeed.isPending || sync.isPending}
          onShowSidebar={sidebarColumn ? undefined : toggleSidebar}
        />
      </div>
      <div className={cn("min-h-0", !articleId && "hidden lg:block")}>
        <Reader
          article={article.data}
          loading={article.isFetching && !article.data}
          error={errorText(article.error)}
          showAlt={showAlt}
          onToggleAlt={toggleAlt}
          onToggleBookmark={toggleBookmark}
          onEndReached={onEndReached}
          onBack={() => selectArticle(null)}
        />
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={runSync} />
      <AddFeedDialog
        open={action?.kind === "addFeed"}
        onOpenChange={(o) => !o && setAction(null)}
        folders={tree.data?.folders ?? []}
        defaultFolderId={action?.kind === "addFeed" ? action.folderId : null}
        onAdded={(id) => selectView({ kind: "feed", id })}
      />
      <PromptDialog
        open={action?.kind === "newFolder"}
        onOpenChange={(o) => !o && setAction(null)}
        title="New folder"
        label="Name"
        submitLabel="Create"
        onSubmit={(name) => manage.createFolder.mutateAsync(name)}
      />
      <PromptDialog
        open={action?.kind === "renameFeed" || action?.kind === "renameFolder"}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === "renameFolder" ? "Rename folder" : "Rename feed"}
        label="Name"
        initial={
          action?.kind === "renameFeed"
            ? action.feed.title
            : action?.kind === "renameFolder"
              ? action.folder.name
              : ""
        }
        onSubmit={async (name) => {
          if (action?.kind === "renameFeed")
            await manage.updateFeed.mutateAsync({ id: action.feed.id, title: name });
          else if (action?.kind === "renameFolder")
            await manage.renameFolder.mutateAsync({ id: action.folder.id, name });
        }}
      />
      <ConfirmDialog
        open={action?.kind === "unfollow"}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === "unfollow" ? `Unfollow ${action.feed.title}?` : ""}
        confirmLabel="Unfollow"
        onConfirm={async () => {
          if (action?.kind !== "unfollow") return;
          const r = await manage.removeFeed.mutateAsync(action.feed.id);
          if (view.kind === "feed" && view.id === action.feed.id) selectView({ kind: "all" });
          toast(
            `Unfollowed ${action.feed.title}` +
              (r.keptBookmarks ? ` · ${r.keptBookmarks} bookmark(s) kept` : ""),
          );
        }}
      >
        Its articles are removed. Bookmarked ones stay in Bookmarks. You can follow it again later.
      </ConfirmDialog>
      <ConfirmDialog
        open={action?.kind === "deleteFolder"}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.kind === "deleteFolder" ? `Delete ${action.folder.name}?` : ""}
        confirmLabel="Delete folder"
        onConfirm={async () => {
          if (action?.kind !== "deleteFolder") return;
          await manage.deleteFolder.mutateAsync(action.folder.id);
          if (view.kind === "folder" && view.id === action.folder.id) selectView({ kind: "all" });
        }}
      >
        The feeds in it aren&apos;t unfollowed. They move out of the folder.
      </ConfirmDialog>
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
