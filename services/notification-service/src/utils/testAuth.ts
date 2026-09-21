export async function getTestToken(email: string, password: string): Promise<string> {
  const response = await fetch("http://localhost:3001/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status} - is auth-service running on port 3001?`);
  }

  const body = await response.json();
  return body.accessToken;
}