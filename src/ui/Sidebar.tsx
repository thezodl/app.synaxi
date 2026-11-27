"use client";

import {
  Bookmark,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Folder,
  Inbox,
  LogOut,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { FeedDto, Tree } from "@/client/hooks";
import { relativeTime } from "@/client/format";
import { viewKey, type View } from "@/core/views";
import { cn } from "@/lib/utils";

import { Favicon } from "./Favicon";

/** Views in sidebar order, for n/p navigation. */
export function orderedViews(tree: Tree | undefined): View[] {
  const out: View[] = [{ kind: "all" }, { kind: "today" }, { kind: "bookmarks" }];
  if (!tree) return out;
  for (const f of tree.folders) {
    out.push({ kind: "folder", id: f.id });
    for (const feed of tree.feeds.filter((x) => x.folderId === f.id))
      out.push({ kind: "feed", id: feed.id });
  }
  for (const feed of tree.feeds.filter((x) => !x.folderId)) out.push({ kind: "feed", id: feed.id });
  return out;
}

export function viewTitle(v: View, tree: Tree | undefined): string {
  switch (v.kind) {
    case "all":
      return "All";
    case "today":
      return "Today";
    case "bookmarks":
      return "Bookmarks";
    case "folder":
      return tree?.folders.find((f) => f.id === v.id)?.name ?? "Folder";
    case "feed":
      return tree?.feeds.find((f) => f.id === v.id)?.title ?? "Feed";
  }
}

function Item({
  active,
  onClick,
  icon,
  label,
  trailing,
  indent,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        indent && "pl-7",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

function FeedItem({
  feed,
  view,
  onSelect,
  indent,
}: {
  feed: FeedDto;
  view: View;
  onSelect: (v: View) => void;
  indent?: boolean;
}) {
  return (
    <Item
      indent={indent}
      active={view.kind === "feed" && view.id === feed.id}
      onClick={() => onSelect({ kind: "feed", id: feed.id })}
      icon={<Favicon siteUrl={feed.siteUrl} title={feed.title} />}
      label={feed.title}
      trailing={
        feed.lastError ? (
          <CircleAlert className="text-destructive size-3.5" aria-label={feed.lastError}>
            <title>{feed.lastError}</title>
          </CircleAlert>
        ) : null
      }
    />
  );
}

export function Sidebar({
  tree,
  view,
  onSelect,
  onSync,
  syncing,
  onImport,
}: {
  tree: Tree | undefined;
  view: View;
  onSelect: (v: View) => void;
  onSync: () => void;
  syncing: boolean;
  onImport: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const isActive = (v: View) => viewKey(v) === viewKey(view);
  const sync = tree?.sync;

  return (
    <nav className="bg-sidebar text-sidebar-foreground flex h-full flex-col border-r">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="font-semibold tracking-tight">Synaxi</span>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          title="Refresh (r)"
          className="hover:bg-sidebar-accent rounded-md p-1.5 disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
          <span className="sr-only">Refresh</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        <Item
          active={isActive({ kind: "all" })}
          onClick={() => onSelect({ kind: "all" })}
          icon={<Inbox className="size-4" />}
          label="All"
        />
        <Item
          active={isActive({ kind: "today" })}
          onClick={() => onSelect({ kind: "today" })}
          icon={<CalendarDays className="size-4" />}
          label="Today"
        />
        <Item
          active={isActive({ kind: "bookmarks" })}
          onClick={() => onSelect({ kind: "bookmarks" })}
          icon={<Bookmark className="size-4" />}
          label="Bookmarks"
        />

        {tree && (tree.folders.length > 0 || tree.feeds.length > 0) && (
          <div className="text-muted-foreground px-2 pt-4 pb-1 text-xs font-medium">Feeds</div>
        )}
        {tree?.folders.map((folder) => {
          const open = !collapsed.has(folder.id);
          return (
            <div key={folder.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggle(folder.id)}
                  className="hover:bg-sidebar-accent rounded p-0.5"
                  aria-label={open ? "Collapse folder" : "Expand folder"}
                  aria-expanded={open}
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", open && "rotate-90")}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <Item
                    active={isActive({ kind: "folder", id: folder.id })}
                    onClick={() => onSelect({ kind: "folder", id: folder.id })}
                    icon={<Folder className="size-4" />}
                    label={folder.name}
                  />
                </div>
              </div>
              {open &&
                tree.feeds
                  .filter((f) => f.folderId === folder.id)
                  .map((f) => (
                    <FeedItem key={f.id} feed={f} view={view} onSelect={onSelect} indent />
                  ))}
            </div>
          );
        })}
        {tree?.feeds
          .filter((f) => !f.folderId)
          .map((f) => (
            <FeedItem key={f.id} feed={f} view={view} onSelect={onSelect} />
          ))}
      </div>

      <div className="text-muted-foreground space-y-1 border-t px-3 py-2 text-xs">
        {sync?.lastFinishedAt ? (
          <p>
            Synced {relativeTime(sync.lastFinishedAt)} ago
            {sync.failedFeeds > 0 && (
              <span className="text-destructive"> · {sync.failedFeeds} failed</span>
            )}
          </p>
        ) : (
          <p>Not synced yet</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onImport}
            className="hover:text-foreground flex items-center gap-1"
          >
            <Upload className="size-3.5" /> Import OPML
          </button>
          <a href="/auth/logout" className="hover:text-foreground flex items-center gap-1">
            <LogOut className="size-3.5" /> Log out
          </a>
        </div>
      </div>
    </nav>
  );
}
