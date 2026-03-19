interface ScheduleFooterProps {
  generatedAt: string;
  institutionLabel: string;
  sheetId: string;
}

export function ScheduleFooter({ generatedAt, institutionLabel, sheetId }: ScheduleFooterProps) {
  return (
    <div className="mt-4 flex justify-between gap-4 text-[10px] text-slate-400 font-medium uppercase tracking-[0.24em]">
      <span>{generatedAt}</span>
      <span>{institutionLabel}</span>
      <span>{sheetId}</span>
    </div>
  );
}
