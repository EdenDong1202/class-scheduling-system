import { Suspense } from "react";
import { fetchLongTermSchedules, fetchScheduleFieldOptions } from "@/app/actions/schedule";
import { computeStats } from "@/lib/schedule-utils";
import { ScheduleBoard } from "@/components/schedule-board";

// force-dynamic: skip build-time pre-rendering (TEABLE_API_URL is only
// available at runtime). fetchLongTermSchedules has no cache layer so every
// router.refresh() from the client returns the latest Teable data.
export const dynamic = "force-dynamic";

async function BoardData() {
  const [schedules, fieldOptions] = await Promise.all([
    fetchLongTermSchedules(),
    fetchScheduleFieldOptions(),
  ]);
  const stats = computeStats(schedules);
  return <ScheduleBoard schedules={schedules} stats={stats} fieldOptions={fieldOptions} />;
}

function BoardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="border-b bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-48 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
              <div className="h-9 w-9 rounded-md bg-gray-100 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-6 w-8 rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter skeleton */}
        <div className="rounded-lg border bg-white p-4 h-16 animate-pulse" />

        {/* Cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="space-y-1.5">
                  <div className="h-5 w-24 rounded bg-gray-200" />
                  <div className="h-3 w-16 rounded bg-gray-100" />
                </div>
                <div className="h-6 w-16 rounded-full bg-gray-100" />
              </div>
              <div className="space-y-1">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-2 w-full rounded-full bg-gray-100" />
              </div>
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-6 w-full rounded-md bg-gray-50" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardData />
    </Suspense>
  );
}
