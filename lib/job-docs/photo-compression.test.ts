import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compressJobDocPhoto } from "./photo-compression";

const MAX_DIMENSION = 2048;

async function makeImage(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
  options: { rotate?: number } = {}
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } },
  });
  if (options.rotate) {
    // Bakes a real EXIF Orientation tag onto an otherwise plain image —
    // withMetadata({ orientation }) is sharp's supported way to attach
    // one without needing a real camera-captured fixture file.
    pipeline = pipeline.withMetadata({ orientation: options.rotate });
  }
  const bytes = await pipeline[format]().toBuffer();
  const mimeType = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
  return { bytes: new Uint8Array(bytes), mimeType };
}

test("an oversized JPEG is capped to 2048px on its longest edge", async () => {
  const { bytes, mimeType } = await makeImage(4000, 3000, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.ok(meta.width! <= MAX_DIMENSION);
  assert.ok(meta.height! <= MAX_DIMENSION);
});

test("JPEG input remains JPEG", async () => {
  const { bytes, mimeType } = await makeImage(3000, 2000, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  assert.equal(result.mimeType, "image/jpeg");
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.equal(meta.format, "jpeg");
});

test("JPEG output is valid and decodable", async () => {
  const { bytes, mimeType } = await makeImage(3000, 2000, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const decoded = await sharp(Buffer.from(result.bytes)).raw().toBuffer();
  assert.ok(decoded.length > 0);
});

test("an oversized PNG is capped to 2048px on its longest edge", async () => {
  const { bytes, mimeType } = await makeImage(3500, 3500, "png");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.ok(meta.width! <= MAX_DIMENSION);
  assert.ok(meta.height! <= MAX_DIMENSION);
});

test("PNG input remains PNG (never silently converted to JPEG)", async () => {
  const { bytes, mimeType } = await makeImage(3000, 2200, "png");
  const result = await compressJobDocPhoto(bytes, mimeType);
  assert.equal(result.mimeType, "image/png");
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.equal(meta.format, "png");
});

test("an oversized WebP is capped to 2048px on its longest edge", async () => {
  const { bytes, mimeType } = await makeImage(3200, 2400, "webp");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.ok(meta.width! <= MAX_DIMENSION);
  assert.ok(meta.height! <= MAX_DIMENSION);
});

test("WebP input remains WebP", async () => {
  const { bytes, mimeType } = await makeImage(2800, 1900, "webp");
  const result = await compressJobDocPhoto(bytes, mimeType);
  assert.equal(result.mimeType, "image/webp");
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.equal(meta.format, "webp");
});

test("a small image is never upscaled", async () => {
  const { bytes, mimeType } = await makeImage(400, 300, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 300);
});

test("portrait aspect ratio is preserved", async () => {
  const { bytes, mimeType } = await makeImage(2000, 4000, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.ok(meta.height! > meta.width!, "portrait orientation should be preserved");
  assert.equal(meta.height, MAX_DIMENSION);
  assert.ok(Math.abs(meta.width! / meta.height! - 2000 / 4000) < 0.01);
});

test("landscape aspect ratio is preserved", async () => {
  const { bytes, mimeType } = await makeImage(4000, 2000, "jpeg");
  const result = await compressJobDocPhoto(bytes, mimeType);
  const meta = await sharp(Buffer.from(result.bytes)).metadata();
  assert.ok(meta.width! > meta.height!, "landscape orientation should be preserved");
  assert.equal(meta.width, MAX_DIMENSION);
  assert.ok(Math.abs(meta.height! / meta.width! - 2000 / 4000) < 0.01);
});

test("an EXIF-rotated JPEG is correctly oriented after compression", async () => {
  // A wide (landscape pixel data) image tagged with EXIF orientation 6
  // ("rotate 90deg CW to display correctly") is how a phone held in
  // portrait actually stores a photo — the raw pixel grid is landscape,
  // and only the EXIF tag says it should display as portrait.
  const { bytes, mimeType } = await makeImage(3000, 2000, "jpeg", { rotate: 6 });
  const beforeMeta = await sharp(Buffer.from(bytes)).metadata();
  assert.equal(beforeMeta.orientation, 6, "fixture sanity check: the source image carries the EXIF tag");

  const result = await compressJobDocPhoto(bytes, mimeType);
  const afterMeta = await sharp(Buffer.from(result.bytes)).metadata();

  // .rotate() bakes the 90deg turn into the actual pixels, so the
  // output's real dimensions are swapped (portrait), and no orientation
  // tag remains to reapply — a viewer that ignores EXIF entirely still
  // renders it right-side-up.
  assert.ok(afterMeta.height! > afterMeta.width!, "pixel data itself should now be portrait");
  assert.ok(!afterMeta.orientation || afterMeta.orientation === 1, "no further rotation should be needed downstream");
});

test("an invalid/corrupt image buffer causes compression to fail, not produce corrupt output", async () => {
  const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  await assert.rejects(() => compressJobDocPhoto(garbage, "image/jpeg"));
});

test("an unsupported mime type is rejected rather than silently passed through", async () => {
  const { bytes } = await makeImage(400, 300, "jpeg");
  await assert.rejects(() => compressJobDocPhoto(bytes, "image/gif"));
});
