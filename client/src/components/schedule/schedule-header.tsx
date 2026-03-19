interface ScheduleHeaderProps {
  title: string;
  subtitle: string;
  semesterLabel: string;
}

export function ScheduleHeader({ title, subtitle, semesterLabel }: ScheduleHeaderProps) {
  return (
    <div className="mb-8 border-b border-slate-900/80 pb-4 flex justify-between items-end gap-4">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-tight text-slate-950">{title}</h1>
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{semesterLabel}</p>
      </div>
    </div>
  );
}
