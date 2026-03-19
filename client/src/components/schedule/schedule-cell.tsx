interface ScheduleCellProps {
  subjectName: string;
  teacherName: string;
  locationName: string;
  spanSlots: number;
}

export function ScheduleCell({ subjectName, teacherName, locationName, spanSlots }: ScheduleCellProps) {
  return (
    <td rowSpan={spanSlots} className="border border-slate-200 p-3 align-top text-xs leading-relaxed bg-white">
      <span className="font-bold text-slate-950 text-[13px] block mb-1">{subjectName}</span>
      <span className="text-slate-500 italic block">{teacherName}</span>
      <span className="font-semibold text-slate-700 block mt-2">{locationName}</span>
      {spanSlots > 1 && (
        <span className="text-[9px] text-slate-400 mt-1 block italic">{`Sessao continua por ${spanSlots} blocos`}</span>
      )}
    </td>
  );
}
