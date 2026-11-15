import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Course, type CourseSummary, type Student } from "../api";

const THRESHOLD = 75;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function FacultyPanel({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [courseId, setCourseId] = useState("");
  const [results, setResults] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState("");
  const [summary, setSummary] = useState<CourseSummary | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: "", title: "", department: "" });
  const [creating, setCreating] = useState(false);

  const fail = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof Error ? err.message : "Something went wrong");
    },
    [onUnauthorized],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.courses(token), api.students(token)])
      .then(([c, s]) => {
        if (cancelled) return;
        setCourses(c.courses);
        setStudents(s.students);
        setCourseId((current) => current || c.courses[0]?.id || "");
      })
      .catch((err) => {
        if (!cancelled) fail(err);
      });
    return () => {
      cancelled = true;
    };
  }, [token, fail]);

  const refreshSummary = useCallback(() => {
    if (!courseId) return;
    api.courseSummary(token, courseId).then(setSummary).catch(fail);
  }, [token, courseId, fail]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  async function mark(studentUserId: string, status: "PRESENT" | "ABSENT") {
    setError("");
    setBusyId(studentUserId);
    try {
      const res = await api.markAttendance(token, studentUserId, courseId, status);
      setResults((prev) => ({ ...prev, [`${courseId}:${studentUserId}`]: res.attendancePercentage }));
      // Analytics is updated by an event, so give it a moment before re-reading.
      setTimeout(refreshSummary, 1000);
    } catch (err) {
      fail(err);
    } finally {
      setBusyId("");
    }
  }

  async function createCourse(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const { course } = await api.createCourse(token, form);
      setCourses((prev) => [...(prev ?? []), course]);
      setCourseId(course.id);
      setForm({ code: "", title: "", department: "" });
    } catch (err) {
      fail(err);
    } finally {
      setCreating(false);
    }
  }

  const selected = courses?.find((c) => c.id === courseId);
  const shown = summary && summary.courseId === courseId ? summary : null;
  const input = "rounded border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Course</h2>
        <div className="space-y-4 rounded-xl bg-white p-4 shadow">
          {courses === null ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <label className="block text-sm text-slate-600">
              Selected course
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={`mt-1 block w-full text-slate-900 ${input}`}
              >
                {courses.length === 0 && <option value="">No courses yet</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <form onSubmit={createCourse} className="grid gap-2 sm:grid-cols-4">
            <input
              required
              minLength={3}
              maxLength={8}
              placeholder="Code (3-8)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={input}
            />
            <input
              required
              minLength={3}
              maxLength={40}
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={input}
            />
            <input
              required
              minLength={3}
              maxLength={20}
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className={input}
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? "Adding..." : "Add course"}
            </button>
          </form>
        </div>
      </section>

      {selected && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{selected.code} summary</h2>
            <button onClick={refreshSummary} className="text-sm text-indigo-600 hover:underline">
              Refresh
            </button>
          </div>
          {shown === null ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Students tracked" value={shown.studentsTracked} />
              <Stat label="Average attendance" value={`${shown.averageAttendance}%`} />
              <Stat label={`Below ${THRESHOLD}%`} value={shown.studentsBelowThreshold} />
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Mark attendance</h2>
        <p className="mb-4 text-sm text-slate-500">
          {courseId ? "Each click records one class session for that student." : "Add a course to start marking."}
        </p>
        {students === null ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : students.length === 0 ? (
          <p className="text-sm text-slate-500">No student profiles yet. A student must create a profile first.</p>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Student</th>
                  <th className="px-4 py-2 font-medium">Attendance</th>
                  <th className="px-4 py-2 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const pct = results[`${courseId}:${s.userId}`];
                  return (
                    <tr key={s.userId} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{s.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {s.department} · semester {s.semester}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {pct === undefined ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          <span className={pct < THRESHOLD ? "font-medium text-red-600" : "text-slate-700"}>
                            {pct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            disabled={!courseId || busyId === s.userId}
                            onClick={() => mark(s.userId, "PRESENT")}
                            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Present
                          </button>
                          <button
                            disabled={!courseId || busyId === s.userId}
                            onClick={() => mark(s.userId, "ABSENT")}
                            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}