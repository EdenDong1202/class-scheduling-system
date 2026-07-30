import { Suspense } from "react";
import { format, startOfWeek, addDays, parseISO, isValid } from "date-fns";
import { fetchSchedule, fetchSelectOptions, fetchEvents } from "@/app/actions";
import ScheduleBoard from "@/components/schedule-board";

function getStartDate(param: string | undefined): string {
  if (param) {
    try {
      const d = parseISO(param);
      if (isValid(d)) {
        return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      }
    } catch {
      // fall through
    }
  }
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

interface PageProps {
  searchParams: Promise<{ startDate?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params    = await searchParams;
  const startDate = getStartDate(params.startDate);
  const endDate   = format(addDays(parseISO(startDate), 7), "yyyy-MM-dd");

  // Fetch schedule data, select options, and events in parallel
  const [records, selectOptions, events] = await Promise.all([
    fetchSchedule(startDate, endDate),
    fetchSelectOptions(),
    fetchEvents(startDate, endDate),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          加载中…
        </div>
      }
    >
      <ScheduleBoard records={records} startDate={startDate} selectOptions={selectOptions} events={events} />
    </Suspense>
  );
}
