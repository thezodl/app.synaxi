"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAddFeed, useDiscover, type FolderDto, type FoundFeed } from "@/client/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { inputClass } from "./dialogs";

/** Add a feed by URL: a feed address, or a web page whose advertised feeds we discover. */
export function AddFeedDialog({
  open,
  onOpenChange,
  folders,
  defaultFolderId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: FolderDto[];
  defaultFolderId: string | null;
  onAdded: (feedId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <AddFeedBody
            folders={folders}
            defaultFolderId={defaultFolderId}
            onClose={() => onOpenChange(false)}
            onAdded={onAdded}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddFeedBody({
  folders,
  defaultFolderId,
  onClose,
  onAdded,
}: {
  folders: FolderDto[];
  defaultFolderId: string | null;
  onClose: () => void;
  onAdded: (feedId: string) => void;
}) {
  const discover = useDiscover();
  const add = useAddFeed();
  const [input, setInput] = useState("");
  const [found, setFound] = useState<FoundFeed[] | null>(null);
  const [choice, setChoice] = useState(0);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);

  const selected = found?.[choice];

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setFound(null);
    const r = await discover.mutateAsync(input).catch(() => null);
    if (!r) return;
    const first = Math.max(
      0,
      r.feeds.findIndex((f) => !f.followed),
    );
    setFound(r.feeds);
    setChoice(first);
    setTitle(r.feeds[first]?.title ?? "");
  }

  async function submit() {
    if (!selected) return;
    try {
      const r = await add.mutateAsync({
        url: selected.url,
        title: title.trim() || selected.title,
        siteUrl: selected.siteUrl,
        folderId,
      });
      toast(
        r.sync.ok
          ? `Following ${title.trim() || selected.title} · ${r.sync.added ?? 0} articles`
          : `Following ${title.trim() || selected.title} · first fetch failed (${r.sync.error})`,
      );
      onAdded(r.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the feed");
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Add feed</DialogTitle>
        <DialogDescription>
          Paste a feed address, or a site&apos;s address and Synaxi will look for its feed.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={find} className="flex gap-2">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com"
          inputMode="url"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" disabled={!input.trim() || discover.isPending}>
          {discover.isPending ? "Looking…" : "Find"}
        </Button>
      </form>
      {discover.error && <p className="text-destructive text-sm">{discover.error.message}</p>}

      {found && (
        <div className="grid gap-3">
          {found.length > 1 && (
            <fieldset className="grid gap-1">
              <legend className="text-muted-foreground mb-1 text-sm">
                This site has several feeds
              </legend>
              {found.map((f, i) => (
                <label key={f.url} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="feed"
                    checked={choice === i}
                    disabled={f.followed}
                    onChange={() => {
                      setChoice(i);
                      setTitle(f.title);
                    }}
                  />
                  <span className={f.followed ? "text-muted-foreground" : ""}>
                    {f.title}
                    {f.followed && " (already following)"}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {selected?.followed ? (
            <p className="text-muted-foreground text-sm">You already follow {selected.title}.</p>
          ) : (
            <>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Name</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">Folder</span>
                <select
                  value={folderId ?? ""}
                  onChange={(e) => setFolderId(e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!selected || selected.followed || add.isPending}>
          {add.isPending ? "Adding…" : "Follow"}
        </Button>
      </DialogFooter>
    </div>
  );
}
