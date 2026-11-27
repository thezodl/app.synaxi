"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const SHORTCUTS: [string, string][] = [
  ["j / k", "Next / previous article"],
  ["n / p", "Next / previous view"],
  ["o", "Open original"],
  ["b", "Toggle bookmark"],
  ["v", "Full article ⇄ feed version"],
  ["r", "Refresh feeds"],
  ["[", "Toggle sidebar"],
  ["Esc", "Close article"],
  ["?", "Show shortcuts"],
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {SHORTCUTS.map(([k, label]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
