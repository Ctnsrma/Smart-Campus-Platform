import { useEffect, useState } from "react";
import { api, ApiError, type AppNotification } from "../api";

interface Props {
  token: string;
  onUnauthorized: () => void;
  courseCode: (courseId: string) => string;
}

export default function NotificationsPanel({ token, onUnauthorized, courseCode }: Props) {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .notifications(token)
      .then((res) => {
        if (!cancelled) setItems(res.notifications);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) onUnauthorized();
        else setError(err instanceof Error ? err.message : "Failed to load notifications");
      });
    return () => {
      cancelled = true;
    };
  }, [token, onUnauthorized]);

  async function markRead(id: string) {
    try {
      const { notification } = await api.markRead(token, id);
      setItems((prev) => (prev ? prev.map((n) => (n.id === id ? notification : n)) : prev));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onUnauthorized();
      else setError(err instanceof Error ? err.message : "Could not update notification");
    }
  }

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <section className="mt-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
        Notifications
        {unread > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {unread} unread
          </span>
        )}
      </h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items === null && !error && <p className="text-sm text-slate-500">Loading...</p>}
      {items?.length === 0 && <p className="text-sm text-slate-500">No notifications yet.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div>
                <p className={n.read ? "text-sm text-slate-500" : "text-sm font-medium text-slate-900"}>
                  {courseCode(n.courseId)}: {n.message}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {n.read ? (
                <span className="shrink-0 text-xs text-slate-400">Read</span>
              ) : (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 text-xs text-indigo-600 hover:underline"
                >
                  Mark as read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}