import { EmptyScheduleCell } from "./empty-schedule-cell";
import { ScheduleCell } from "./schedule-cell";

type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

type TimeSlot = {
  id: number;
  label: string;
  sequence: number;
  isBreak: boolean;
};

type Entry = {
  id: number;
  weekday: Weekday;
  timeSlotId: number;
  spanSlots: number;
  subjectName: string;
  teacherName: string;
  locationName: string;
};

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

interface ScheduleTableProps {
  timeSlots: TimeSlot[];
  weekdays: Weekday[];
  entries: Entry[];
}

export function ScheduleTable({ timeSlots, weekdays, entries }: ScheduleTableProps) {
  const sortedSlots = [...timeSlots].sort((left, right) => left.sequence - right.sequence);
  const slotIndexById = new Map(sortedSlots.map((slot) => [slot.id, slot.sequence]));
  const startMap = new Map(entries.map((entry) => [`${entry.weekday}:${entry.timeSlotId}`, entry]));
  const coveredCells = new Set<string>();

  for (const entry of entries) {
    const startSequence = slotIndexById.get(entry.timeSlotId);
    if (!startSequence) continue;

    for (let offset = 1; offset < entry.spanSlots; offset += 1) {
      const coveredSlot = sortedSlots.find((slot) => slot.sequence === startSequence + offset);
      if (coveredSlot) {
        coveredCells.add(`${entry.weekday}:${coveredSlot.id}`);
      }
    }
  }

  return (
    <table className="w-full border-collapse border border-slate-300 table-fixed min-w-[960px] bg-white">
      <thead>
        <tr>
          <th className="w-32 border border-slate-300 bg-slate-50 text-left p-3 text-xs font-bold uppercase tracking-wider text-slate-600">
            Time
          </th>
          {weekdays.map((weekday) => (
            <th
              key={weekday}
              className="border border-slate-300 bg-slate-50 text-left p-3 text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              {DAY_LABELS[weekday]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedSlots.map((timeSlot) => {
          if (timeSlot.isBreak) {
            return (
              <tr key={timeSlot.id}>
                <td className="w-32 bg-slate-100 border-y border-slate-300 font-semibold text-slate-500 text-[10px] text-center uppercase p-3">
                  {timeSlot.label}
                </td>
                <td colSpan={weekdays.length} className="bg-slate-100 border-y border-slate-300 p-3" />
              </tr>
            );
          }

          return (
            <tr key={timeSlot.id}>
              <td className="w-32 bg-slate-50 font-semibold text-slate-500 text-[10px] text-center uppercase border border-slate-300 p-3">
                {timeSlot.label}
              </td>
              {weekdays.map((weekday) => {
                const cellKey = `${weekday}:${timeSlot.id}`;
                if (coveredCells.has(cellKey)) return null;

                const entry = startMap.get(cellKey);
                if (!entry) return <EmptyScheduleCell key={cellKey} />;

                return (
                  <ScheduleCell
                    key={cellKey}
                    subjectName={entry.subjectName}
                    teacherName={entry.teacherName}
                    locationName={entry.locationName}
                    spanSlots={entry.spanSlots}
                  />
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
