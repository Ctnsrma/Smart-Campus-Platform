import { useEffect, useState } from "react";
import { api, ApiError, type Course, type CourseAttendance } from "../api";
import { decodeClaims } from "../auth";

const THRESHOLD = 75;

export default function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const claims = decodeClaims(token);
  const [rows, setRows] = useState<CourseAttendance[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.myAttendance(token), api.courses(token)])
      .then(([attendance, courseList]) => {
        if (cancelled) return;
        setRows(attendance.courses);
        setCourses(courseList.courses);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) onLogout();
        else setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [token, onLogout]);

  const byId = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-3 shadow-sm">
        <h1 className="font-semibold text-slate-900">Smart Campus</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">{claims.email}</span>
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {claims.role}
          </span>
          <button onClick={onLogout} className="text-indigo-600 hover:underline">
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">My attendance</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {claims.role !== "STUDENT" && (
          <p className="text-sm text-slate-500">Faculty tools arrive in the next step.</p>
        )}
        {claims.role === "STUDENT" && rows === null && !error && (
          <p className="text-sm text-slate-500">Loading...</p>
        )}
        {claims.role === "STUDENT" && rows?.length === 0 && (
          <p className="text-sm text-slate-500">No attendance has been recorded for you yet.</p>
        )}
        {claims.role === "STUDENT" && rows && rows.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Present</th>
                  <th className="px-4 py-2 font-medium">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const course = byId.get(r.courseId);
                  const low = r.attendancePercentage < THRESHOLD;
                  return (
                    <tr key={r.courseId} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{course?.code ?? "Unknown course"}</div>
                        <div className="text-xs text-slate-500">{course?.title ?? r.courseId}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.present} / {r.total}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 rounded bg-slate-200">
                            <div
                              className={low ? "h-2 rounded bg-red-500" : "h-2 rounded bg-emerald-500"}
                              style={{ width: `${r.attendancePercentage}%` }}
                            />
                          </div>
                          <span className={low ? "font-medium text-red-600" : "text-slate-700"}>
                            {r.attendancePercentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}