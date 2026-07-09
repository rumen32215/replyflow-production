import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta signs every webhook POST body with your App Secret and sends it
 * as `X-Hub-Signature-256: sha256=<hex>`. This endpoint is public by
 * necessity (Meta has to be able to reach it without auth), so this
 * check is what stops anyone else from POSTing fake messages into your
 * database. Always verify against the *raw* request body — parsing to
 * JSON first and re-stringifying will not match Meta's signature due
 * to key ordering/whitespace differences.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;

  const [scheme, providedSignature] = signatureHeader.split("=");
  if (scheme !== "sha256" || !providedSignature) return false;

  const expectedSignature = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const provided = Buffer.from(providedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
