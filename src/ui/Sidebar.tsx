"use client";

import {
  Bookmark,
  Download,
  FolderPlus,
  Keyboard,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Folder,
  Inbox,
  LogOut,
  Monitor,
  Moon,
  Sun,
  SunMoon,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import type { FeedDto, FolderDto, Tree } from "@/client/hooks";
import { relativeTime } from "@/client/format";
import { useThemePref } from "@/client/theme";
import type { ThemePref } from "@/client/themeScript";
import { viewKey, type View } from "@/core/views";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Favicon } from "./Favicon";

/** What the sidebar asks the app to do; ReaderApp owns the dialogs. */
export type SidebarAction =
  | { kind: "addFeed"; folderId: string | null }
  | { kind: "newFolder" }
  | { kind: "renameFeed"; feed: FeedDto }
  | { kind: "moveFeed"; feed: FeedDto; folderId: string | null }
  | { kind: "unfollow"; feed: FeedDto }
  | { kind: "renameFolder"; folder: FolderDto }
  | { kind: "deleteFolder"; folder: FolderDto }
  | { kind: "import" }
  | { kind: "export" }
  | { kind: "shortcuts" }
  | { kind: "logout" }
  | { kind: "collapse" };

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-sidebar-accent data-popup-open:bg-sidebar-accent text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
        aria-label={label}
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMenu() {
  const [pref, setPref] = useThemePref();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SunMoon /> Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-36">
        <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setPref(v as ThemePref)}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

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
  folders,
  onAction,
}: {
  feed: FeedDto;
  view: View;
  onSelect: (v: View) => void;
  indent?: boolean;
  folders: FolderDto[];
  onAction: (a: SidebarAction) => void;
}) {
  return (
    <div className="group/row relative">
      <Item
        indent={indent}
        active={view.kind === "feed" && view.id === feed.id}
        onClick={() => onSelect({ kind: "feed", id: feed.id })}
        icon={<Favicon siteUrl={feed.siteUrl} title={feed.title} />}
        label={feed.title}
        trailing={
          feed.lastError ? (
            <CircleAlert
              className="text-destructive size-3.5 group-hover/row:invisible"
              aria-label={feed.lastError}
            >
              <title>{feed.lastError}</title>
            </CircleAlert>
          ) : null
        }
      />
      <RowMenu label={`Options for ${feed.title}`}>
        <DropdownMenuItem onClick={() => onAction({ kind: "renameFeed", feed })}>
          Rename…
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem
              disabled={!feed.folderId}
              onClick={() => onAction({ kind: "moveFeed", feed, folderId: null })}
            >
              No folder
            </DropdownMenuItem>
            {folders.map((f) => (
              <DropdownMenuItem
                key={f.id}
                disabled={feed.folderId === f.id}
                onClick={() => onAction({ kind: "moveFeed", feed, folderId: f.id })}
              >
                {f.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onAction({ kind: "unfollow", feed })}
        >
          Unfollow…
        </DropdownMenuItem>
      </RowMenu>
    </div>
  );
}

export function Sidebar({
  tree,
  view,
  onSelect,
  onSync,
  syncing,
  onAction,
}: {
  tree: Tree | undefined;
  view: View;
  onSelect: (v: View) => void;
  onSync: () => void;
  syncing: boolean;
  onAction: (a: SidebarAction) => void;
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
  const syncLabel = sync?.lastFinishedAt
    ? `Synced ${relativeTime(sync.lastFinishedAt)}${relativeTime(sync.lastFinishedAt) === "now" ? "" : " ago"}`
    : "Not synced yet";

  return (
    <nav className="bg-sidebar text-sidebar-foreground flex h-full flex-col border-r">
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-2">
        <button
          type="button"
          onClick={() => onAction({ kind: "collapse" })}
          title="Hide sidebar ([)"
          className="hover:bg-sidebar-accent rounded-md p-1.5"
        >
          <PanelLeftClose className="size-4" />
          <span className="sr-only">Hide sidebar</span>
        </button>
        <span className="flex-1 px-1 font-semibold tracking-tight">Synaxi</span>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          title={`Refresh all (r) · ${syncLabel}`}
          className="hover:bg-sidebar-accent rounded-md p-1.5 disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} />
          <span className="sr-only">Refresh all</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hover:bg-sidebar-accent data-popup-open:bg-sidebar-accent rounded-md p-1.5"
            aria-label="Menu"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="text-muted-foreground px-1.5 py-1 text-xs">
              {syncLabel}
              {sync && sync.failedFeeds > 0 && (
                <span className="text-destructive"> · {sync.failedFeeds} failed</span>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction({ kind: "import" })}>
              <Upload /> Import OPML…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ kind: "export" })}>
              <Download /> Export OPML
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction({ kind: "shortcuts" })}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
            <ThemeMenu />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction({ kind: "logout" })}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

        <div className="text-muted-foreground flex items-center px-2 pt-4 pb-1 text-xs font-medium">
          <span className="flex-1">Feeds</span>
          <button
            type="button"
            onClick={() => onAction({ kind: "newFolder" })}
            className="hover:bg-sidebar-accent hover:text-foreground rounded p-1"
            title="New folder"
          >
            <FolderPlus className="size-3.5" />
            <span className="sr-only">New folder</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onAction({ kind: "addFeed", folderId: view.kind === "folder" ? view.id : null })
            }
            className="hover:bg-sidebar-accent hover:text-foreground rounded p-1"
            title="Add feed (a)"
          >
            <Plus className="size-3.5" />
            <span className="sr-only">Add feed</span>
          </button>
        </div>
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
                <div className="group/row relative min-w-0 flex-1">
                  <Item
                    active={isActive({ kind: "folder", id: folder.id })}
                    onClick={() => onSelect({ kind: "folder", id: folder.id })}
                    icon={<Folder className="size-4" />}
                    label={folder.name}
                  />
                  <RowMenu label={`Options for ${folder.name}`}>
                    <DropdownMenuItem
                      onClick={() => onAction({ kind: "addFeed", folderId: folder.id })}
                    >
                      Add feed here…
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onAction({ kind: "renameFolder", folder })}>
                      Rename…
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onAction({ kind: "deleteFolder", folder })}
                    >
                      Delete folder…
                    </DropdownMenuItem>
                  </RowMenu>
                </div>
              </div>
              {open &&
                tree.feeds
                  .filter((f) => f.folderId === folder.id)
                  .map((f) => (
                    <FeedItem
                      key={f.id}
                      feed={f}
                      view={view}
                      onSelect={onSelect}
                      folders={tree.folders}
                      onAction={onAction}
                      indent
                    />
                  ))}
            </div>
          );
        })}
        {tree?.feeds
          .filter((f) => !f.folderId)
          .map((f) => (
            <FeedItem
              key={f.id}
              feed={f}
              view={view}
              onSelect={onSelect}
              folders={tree.folders}
              onAction={onAction}
            />
          ))}
      </div>
    </nav>
  );
}
