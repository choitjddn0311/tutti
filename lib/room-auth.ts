import "server-only";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 32;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export const ROOM_CODE_RE = /^[0-9]{4}$/;

// ---------- 비밀번호 ----------

/** `scrypt$<salt b64>$<hash b64>` 형식으로 저장한다. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------- 방 입장 세션 (방별 서명 쿠키) ----------

export type RoomSession = {
  roomId: string;
  nickname: string;
  instrument: string;
  exp: number; // unix 초
};

function secret(): string {
  const s = process.env.ROOM_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("환경변수 누락 또는 너무 짧음: ROOM_SESSION_SECRET");
  }
  return s;
}

function cookieName(code: string) {
  return `tutti_room_${code}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: RoomSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): RoomSession | null {
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as RoomSession;
    if (typeof s.exp !== "number" || s.exp < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}

async function isHttps(): Promise<boolean> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return h.get("origin")?.startsWith("https://") ?? false;
}

/** Server Action / Route Handler 에서만 호출 가능 (쿠키 쓰기). */
export async function setRoomSession(
  code: string,
  data: Omit<RoomSession, "exp">,
): Promise<void> {
  const session: RoomSession = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  (await cookies()).set(cookieName(code), encode(session), {
    httpOnly: true,
    // https로 접속했을 때만 Secure (Vercel은 x-forwarded-proto=https).
    // 같은 와이파이의 폰에서 http://<맥 IP>로 테스트할 때도 쿠키가 저장되도록 프로토콜로 판단한다.
    secure: await isHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * 쿠키에서 방 세션을 읽는다. 서명·만료만 확인하므로, 호출한 쪽에서
 * `roomId`가 해당 코드의 방과 일치하는지 반드시 확인한다(`lib/rooms.ts`의 `requireRoom`).
 */
export async function readRoomSession(code: string): Promise<RoomSession | null> {
  if (!ROOM_CODE_RE.test(code)) return null;
  const value = (await cookies()).get(cookieName(code))?.value;
  return value ? decode(value) : null;
}
