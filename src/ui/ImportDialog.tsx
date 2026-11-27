"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/client/api";
import { useImportOpml } from "@/client/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const importOpml = useImportOpml();

  async function submit() {
    if (!file) return;
    try {
      const r = await importOpml.mutateAsync(await file.text());
      toast.success(
        `Imported ${r.added} feed${r.added === 1 ? "" : "s"}` +
          (r.skipped ? ` (${r.skipped} already followed)` : ""),
      );
      setFile(null);
      onOpenChange(false);
      if (r.added) onImported();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Import failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import OPML</DialogTitle>
          <DialogDescription>
            Choose the OPML file exported from Feedly. Folders are kept; feeds you already follow
            are skipped. Feed URLs are stored encrypted.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={input}
          type="file"
          accept=".opml,.xml,text/x-opml,text/xml,application/xml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="file:bg-muted file:text-foreground text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || importOpml.isPending}>
            {importOpml.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
