import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { currentUser, ensureAnonId } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, ProtocolError, extractFromProtocol, toConfidential, toCriteria } from "@/lib/protocol";
import { DEFAULT_CRITERIA } from "@/lib/types";
import { SEARCH } from "@/lib/i18n/pro/search";
import { langFromRequest } from "@/lib/i18n/server";

type Msgs = (typeof SEARCH)["en"]["api"]["protocol"];

export const maxDuration = 300; // long protocols can take a while to read

// Abuse / cost limits. The anonymous cookie limit is a courtesy for real browsers; the IP and global
// caps hold even for clients that drop cookies.
const LIMITS = { anonymousPerBrowser: 5, anonymousPerIp: 10, anonymousGlobal: 200, account: 30 };
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024; // file + form fields / multipart overhead
const MAX_TEXT_CHARS = 600_000;
const MAX_DOCX_UNCOMPRESSED = 50 * 1024 * 1024;
// Kept documents live outside the web root. Production: encrypted, EU-region object storage.
const STORAGE_DIR = path.join(process.cwd(), "storage", "protocols");

type Kind = "pdf" | "docx" | "txt";
const MIME: Record<Kind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Detects the real file type from its first bytes (never trusts the browser's MIME type). */
function detectKind(bytes: Buffer, filename: string): Kind | null {
  const head = bytes.subarray(0, 5).toString("latin1");
  if (head === "%PDF-") return "pdf";
  if (head.startsWith("PK\x03\x04") && filename.toLowerCase().endsWith(".docx")) return "docx";
  if (/\.(txt|md|text)$/i.test(filename) && !bytes.subarray(0, 8192).includes(0)) return "txt";
  return null;
}

/** Reads the multipart body without ever buffering more than MAX_BODY_BYTES. */
async function readForm(request: Request, m: Msgs): Promise<FormData | Response> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, m.tooLarge);
  if (!request.body) return fail(400, m.noInput);
  let seen = 0;
  const limited = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        seen += chunk.byteLength;
        if (seen > MAX_BODY_BYTES) ctrl.error(new Error("too large"));
        else ctrl.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Request(request.url, { method: "POST", headers: request.headers, body: limited, duplex: "half" } as RequestInit).formData();
  } catch {
    return seen > MAX_BODY_BYTES ? fail(413, m.tooLarge) : fail(400, m.invalidUpload);
  }
}

function clientIpHash(request: Request): string | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.IP_HASH_SALT ?? "solera-dev"}:${ip}`).digest("hex").slice(0, 32);
}

async function docxText(bytes: Buffer, m: Msgs): Promise<string | Response> {
  // Refuse archives that would expand to an unreasonable size before handing them to the converter.
  try {
    const zip = await JSZip.loadAsync(bytes);
    let total = 0;
    zip.forEach((_, entry) => {
      total += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    });
    if (total > MAX_DOCX_UNCOMPRESSED) return fail(413, m.docxTooLarge);
    return (await mammoth.extractRawText({ buffer: bytes })).value;
  } catch {
    return fail(422, m.docxUnreadable);
  }
}

export async function POST(request: Request) {
  const m = SEARCH[langFromRequest(request)].api.protocol;
  const form = await readForm(request, m);
  if (form instanceof Response) return form;
  if (form.get("agreeTerms") !== "on") return fail(400, m.agreeTerms);
  const keepDocument = form.get("keepDocument") === "on";
  const keepConfidential = form.get("keepConfidential") === "on";

  const user = await currentUser();
  const anonId = user ? null : await ensureAnonId();
  const ipHash = user ? null : clientIpHash(request);

  // Prepare the input before writing anything.
  const file = form.get("file");
  const pasted = String(form.get("text") ?? "").trim();
  let originalName = "pasted-text.txt";
  let kind: Kind;
  let bytes: Buffer;
  let pdf: Buffer | undefined;
  let text: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return fail(413, m.tooLarge);
    originalName = file.name.slice(0, 200);
    bytes = Buffer.from(await file.arrayBuffer());
    const detected = detectKind(bytes, originalName);
    if (!detected) return fail(415, m.badType);
    kind = detected;
    if (kind === "pdf") pdf = bytes;
    else if (kind === "docx") {
      const t = await docxText(bytes, m);
      if (t instanceof Response) return t;
      text = t;
    } else text = bytes.toString("utf8");
  } else if (pasted) {
    kind = "txt";
    text = pasted;
    bytes = Buffer.from(pasted, "utf8");
  } else {
    return fail(400, m.noInput);
  }
  if (text !== undefined && text.trim().length < 200) return fail(422, m.tooShort);
  if (text && text.length > MAX_TEXT_CHARS) return fail(413, m.tooLong);

  // Insert first, then count including this row, so parallel requests see each other.
  const upload = await db.protocolUpload.create({
    data: {
      userId: user?.id ?? null,
      anonId,
      ipHash,
      filename: keepDocument ? originalName : null,
      mimeType: MIME[kind],
      sizeBytes: bytes.length,
      agreedTermsAt: new Date(),
      keepDocument,
      keepConfidential,
      status: "pending",
    },
  });
  const since = new Date(Date.now() - 86400_000);
  const upTo = { gte: since, lte: upload.createdAt };
  const over = user
    ? (await db.protocolUpload.count({ where: { userId: user.id, createdAt: upTo } })) > LIMITS.account
    : (await db.protocolUpload.count({ where: { anonId, createdAt: upTo } })) > LIMITS.anonymousPerBrowser ||
      (!!ipHash && (await db.protocolUpload.count({ where: { ipHash, createdAt: upTo } })) > LIMITS.anonymousPerIp) ||
      (await db.protocolUpload.count({ where: { userId: null, createdAt: upTo } })) > LIMITS.anonymousGlobal;
  if (over) {
    await db.protocolUpload.update({ where: { id: upload.id }, data: { status: "rate_limited" } });
    return fail(429, user ? m.limitAccount : m.limitAnonymous);
  }

  let storedPath: string | null = null;
  try {
    const extraction = await extractFromProtocol({ pdf, text }, request.signal);
    if (keepDocument) {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      storedPath = path.join(STORAGE_DIR, `${upload.id}.${kind}`);
      await fs.writeFile(storedPath, bytes, { mode: 0o600 });
    }
    await db.protocolUpload.update({ where: { id: upload.id }, data: { status: "extracted", storedPath } });
    return Response.json({
      uploadId: upload.id,
      criteria: toCriteria(extraction, DEFAULT_CRITERIA),
      confidential: toConfidential(extraction),
      keptConfidential: keepConfidential,
      evidence: extraction.evidence,
      kept: keepDocument,
    });
  } catch (e) {
    if (storedPath) await fs.unlink(storedPath).catch(() => {});
    await db.protocolUpload.update({ where: { id: upload.id }, data: { status: "failed", storedPath: null } }).catch(() => {});
    if (e instanceof ProtocolError) return fail(422, m.extraction[e.code] ?? e.message);
    console.error("protocol extraction failed", e instanceof Error ? e.name : "unknown"); // never log document content
    return fail(500, m.generic);
  }
  // Without consent the document only ever existed in this request's memory.
}
