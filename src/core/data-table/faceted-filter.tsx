"use client";

import { Check, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type FacetedFilterOption = { label: string; value: string };

/**
 * Single-select faceted filter: the server query carries one value per filter
 * key, so picking an option replaces the previous one.
 */
export function DataTableFacetedFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FacetedFilterOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle className="size-4" />
          {label}
          {selected ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-1 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {selected.label}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={label} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() =>
                      onChange(isSelected ? undefined : option.value)
                    }
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-xs border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      <Check className={cn("size-3", !isSelected && "hidden")} />
                    </span>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
