import { forwardRef, useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayCalendar } from "@/components/ui/calendar";

type DateTimeLocalInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "type"> & {
  wrapperClassName?: string;
  buttonClassName?: string;
  buttonAriaLabel?: string;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateTimeLocal(value: string | undefined) {
  if (!value) return { date: undefined as Date | undefined, time: "" };

  // Expected format: YYYY-MM-DDTHH:mm (seconds optional, ignored)
  const [datePart, timePart = ""] = value.split("T");
  const [yearStr, monthStr, dayStr] = datePart.split("-");
  const [hourStr = "00", minuteStr = "00"] = timePart.split(":");

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { date: undefined as Date | undefined, time: "" };
  }

  const date = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0);
  const time = `${pad2(Number.isFinite(hour) ? hour : 0)}:${pad2(Number.isFinite(minute) ? minute : 0)}`;

  return { date, time };
}

function formatDateTimeLocal(date: Date, time: string) {
  const [hourStr = "00", minuteStr = "00"] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(Number.isFinite(hour) ? hour : 0);
  const minutes = pad2(Number.isFinite(minute) ? minute : 0);

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const DateTimeLocalInput = forwardRef<HTMLInputElement, DateTimeLocalInputProps>(
  function DateTimeLocalInput(
    {
      wrapperClassName,
      buttonClassName,
      buttonAriaLabel = "Abrir seletor de data e hora",
      className,
      ...props
    },
    ref,
  ) {
    const internalRef = useRef<HTMLInputElement | null>(null);
    const [open, setOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = useState<string>("");

    const setRef = (node: HTMLInputElement | null) => {
      internalRef.current = node;

      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
        return;
      }

      (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    };

    const syncFromInput = () => {
      const inputEl = internalRef.current;
      if (!inputEl) return;

      const parsed = parseDateTimeLocal(inputEl.value);
      setSelectedDate(parsed.date);
      setSelectedTime(parsed.time);
    };

    const commitValue = (date: Date, time: string) => {
      const inputEl = internalRef.current;
      if (!inputEl) return;

      const formatted = formatDateTimeLocal(date, time);
      inputEl.value = formatted;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    };

    useEffect(() => {
      if (open) syncFromInput();
    }, [open]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className={cn("relative", wrapperClassName)}>
          <Input
            ref={setRef}
            type="datetime-local"
            className={cn("pr-12 datetime-local-hide-native", className)}
            {...props}
          />

          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={buttonAriaLabel}
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                buttonClassName,
              )}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-auto p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <div className="p-3">
              <DayCalendar
                mode="single"
                selected={selectedDate}
                onSelect={(nextDate) => {
                  if (!nextDate) return;
                  setSelectedDate(nextDate);
                  commitValue(nextDate, selectedTime || "00:00");
                }}
              />

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hora</span>
                <Input
                  type="time"
                  className="h-9 w-32"
                  value={selectedTime}
                  onChange={(event) => {
                    const nextTime = event.target.value;
                    setSelectedTime(nextTime);
                    if (selectedDate) commitValue(selectedDate, nextTime || "00:00");
                  }}
                />
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const inputEl = internalRef.current;
                    if (!inputEl) return;
                    inputEl.value = "";
                    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                    setSelectedDate(undefined);
                    setSelectedTime("");
                  }}
                >
                  Limpar
                </button>
              </div>
            </div>
          </PopoverContent>
        </div>
      </Popover>
    );
  },
);

DateTimeLocalInput.displayName = "DateTimeLocalInput";
