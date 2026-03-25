"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { formatDateMMDDYYYY } from "@/lib/format";

/** Format Date to YYYY-MM-DD. */
function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD to Date (local). */
function fromYYYYMMDD(s: string): Date | undefined {
  if (!s || s.length < 10) return undefined;
  const parsed = new Date(s + "T12:00:00");
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

interface StyledDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function StyledDatePicker({
  value,
  onChange,
  id,
  required,
  className = "",
  placeholder = "Select date",
}: StyledDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => fromYYYYMMDD(value) ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = fromYYYYMMDD(value);
  const displayValue = value ? formatDateMMDDYYYY(value) : "";

  const { startMonth, endMonth } = useMemo(() => {
    const y = new Date().getFullYear();
    return {
      startMonth: new Date(y - 100, 0),
      endMonth: new Date(y + 10, 11, 31),
    };
  }, []);

  useEffect(() => {
    const d = fromYYYYMMDD(value);
    if (d) setMonth(d);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(toYYYYMMDD(selectedDate));
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        id={id}
        readOnly
        value={displayValue}
        placeholder={placeholder}
        required={required}
        className={className}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      />
      {open && (
        <div
          className="rdp-dark z-50 mt-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg"
          role="dialog"
          aria-label="Choose date"
        >
          <DayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={handleSelect}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            navLayout="around"
          />
        </div>
      )}
    </div>
  );
}
