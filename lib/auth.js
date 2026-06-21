import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "tw_session";
const MAX_AGE = 60 * 60 * 8; // 8 hours

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET must be set");
  return new TextEncoder().encode(s);
}

export async function createToken(user) {
  return new SignJWT({ name: user.name, email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function readToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { id: payload.sub, name: payload.name, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export const sessionCookie = { name: COOKIE_NAME, maxAge: MAX_AGE };
