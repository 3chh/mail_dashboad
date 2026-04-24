"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";


type Preset = { value: number; label: string };

const DEFAULT_PRESETS: Preset[] = [
  { value: 1, label: "1 ngày" },
  { value: 7, label: "7 ngày" },
  { value: 30, label: "30 ngày" },
];

type Props = {
  name?: string;
  defaultValue?: number;
  value?: string;
  onValueChange?: (val: string) => void;
  min?: number;
  max?: number;
  presets?: Preset[];
  className?: string;
};

export function DaysInput({
  name,
  defaultValue = 30,
  value: controlledValue,
  onValueChange,
  min = 1,
  max = 90,
  presets = DEFAULT_PRESETS,
  className,
}: Props) {
  const [internalValue, setInternalValue] = useState(String(defaultValue));
  const [open, setOpen] = useState(false);
  const value = controlledValue ?? internalValue;
  const setValue = onValueChange ?? setInternalValue;

  function clamp(raw: string): string {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) return String(min);
    if (parsed > max) return String(max);
    return String(parsed);
  }

  function commitAndClose() {
    setValue(clamp(value));
    setOpen(false);
  }

  const activePreset = presets.find((p) => String(p.value) === value);
  const triggerLabel = activePreset ? activePreset.label : `${value} ngày`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value} />}

      <Popover.Trigger
        className={cn(
          "control-surface flex h-10 w-full items-center justify-between gap-1.5 rounded-xl px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        <span>{triggerLabel}</span>
        <ChevronDown className="pointer-events-none size-4 text-muted-foreground" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" sideOffset={4} align="start" className="isolate z-50">
          <Popover.Popup className="panel-surface w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-hidden rounded-xl text-popover-foreground duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2">
            <div className="p-1">
              {presets.map((preset) => (
                <Popover.Close
                  key={preset.value}
                  onClick={() => setValue(String(preset.value))}
                  className="flex w-full cursor-default items-center justify-between rounded-lg px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  {preset.label}
                  {value === String(preset.value) && <Check className="size-3.5 text-primary" />}
                </Popover.Close>
              ))}
            </div>

            <div className="border-t border-border p-2">
              <div className="relative">
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={() => setValue(clamp(value))}
                  onKeyDown={(e) => { if (e.key === "Enter") commitAndClose(); }}
                  placeholder="Tùy chỉnh..."
                  className="h-8 w-full rounded-lg border border-input bg-transparent pl-2.5 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ngày
                </span>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
