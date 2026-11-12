const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}
export interface CourseAttendance {
  courseId: string;
  total: number;
  present: number;
  attendancePercentage: number;
}
export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const credentials = (email: string, password: string) => JSON.stringify({ email, password });

export const api = {
  register: (email: string, password: string) =>
    request("/auth/register", { method: "POST", body: credentials(email, password) }),
  login: (email: string, password: string) =>
    request<Session>("/auth/login", { method: "POST", body: credentials(email, password) }),
  myAttendance: (token: string) => request<{ courses: CourseAttendance[] }>("/attendance/me", {}, token),
  courses: (token: string) => request<{ courses: Course[] }>("/courses", {}, token),
};