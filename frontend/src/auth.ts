export interface Claims {
  sub: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "ADMIN";
  exp: number;
}

export function decodeClaims(token: string): Claims {
  const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(payload)) as Claims;
}