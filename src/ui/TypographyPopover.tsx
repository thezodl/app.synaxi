"use client";

import { Type } from "lucide-react";
import type { CSSProperties } from "react";

import { useSetTypography, useTypography } from "@/client/hooks";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_TYPOGRAPHY,
  LINE_HEIGHT_VALUE,
  SIZE_RANGE,
  WIDTH_RANGE,
  type Typography,
} from "@/core/typography";
import { cn } from "@/lib/utils";

const FONT_STACK: Record<Typography["font"], string> = {
  serif: 'Charter, "Bitstream Charter", "Iowan Old Style", Georgia, Cambria, serif',
  sans: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/** CSS variables the `.reader` styles read. */
export function typographyStyle(t: Typography | undefined): CSSProperties {
  const v = t ?? DEFAULT_TYPOGRAPHY;
  return {
    "--reader-font": FONT_STACK[v.font],
    "--reader-size": `${v.size}px`,
    "--reader-leading": String(LINE_HEIGHT_VALUE[v.lineHeight]),
    "--reader-width": `${v.width}ch`,
  } as CSSProperties;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted grid grid-flow-col gap-1 rounded-md p-1"
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded px-2 py-1 text-xs",
            value === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function TypographyPopover() {
  const { data: t = DEFAULT_TYPOGRAPHY } = useTypography();
  const save = useSetTypography();
  const set = (patch: Partial<Typography>) => save.mutate({ ...t, ...patch });

  return (
    <Popover>
      <PopoverTrigger className="hover:bg-muted rounded-md p-1.5" title="Text settings">
        <Type className="size-4" />
        <span className="sr-only">Text settings</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-4">
        <Segmented
          label="Font"
          value={t.font}
          onChange={(font) => set({ font })}
          options={[
            ["serif", "Serif"],
            ["sans", "Sans"],
            ["system", "System"],
          ]}
        />
        <label className="grid gap-1.5 text-xs">
          <span className="text-muted-foreground flex justify-between">
            Size <span>{t.size}px</span>
          </span>
          <input
            type="range"
            min={SIZE_RANGE.min}
            max={SIZE_RANGE.max}
            step={SIZE_RANGE.step}
            value={t.size}
            onChange={(e) => set({ size: Number(e.target.value) })}
          />
        </label>
        <Segmented
          label="Line height"
          value={t.lineHeight}
          onChange={(lineHeight) => set({ lineHeight })}
          options={[
            ["compact", "Compact"],
            ["normal", "Normal"],
            ["relaxed", "Relaxed"],
          ]}
        />
        <label className="grid gap-1.5 text-xs">
          <span className="text-muted-foreground flex justify-between">
            Width <span>{t.width}ch</span>
          </span>
          <input
            type="range"
            min={WIDTH_RANGE.min}
            max={WIDTH_RANGE.max}
            step={WIDTH_RANGE.step}
            value={t.width}
            onChange={(e) => set({ width: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          onClick={() => save.mutate(DEFAULT_TYPOGRAPHY)}
          className="text-muted-foreground hover:text-foreground justify-self-start text-xs"
        >
          Reset to defaults
        </button>
      </PopoverContent>
    </Popover>
  );
}
