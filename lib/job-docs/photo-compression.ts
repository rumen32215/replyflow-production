import sharp from "sharp";

/**
 * ReplyFlow 2.0, Phase 2A hardening (BUG-10) — the single compression
 * chokepoint for job-record photos, called once from the upload route
 * (app/api/job-docs/[id]/photos/route.ts) before storage. Everything
 * downstream (storage, display, the initial AI analysis call built
 * from the same request, and retry — which just re-reads whatever is
 * already in storage) inherits the result for free; nothing else in
 * the pipeline needs to know compression happened.
 *
 * Deliberately no `import "server-only"` marker — same reasoning as
 * photo-validation.ts/photo-schema.ts in this directory: it's only
 * ever called from the server route above, but the marker throws
 * unconditionally outside Next's own webpack build (it has no real
 * effect under the plain Node `tsx --test` run this file's own test
 * suite uses), so omitting it here is what keeps this file unit-
 * testable the same way its two siblings already are.
 *
 * 2048px is not an arbitrary "smaller is better" number: it's the
 * same ceiling OpenAI's own vision pipeline downsamples to internally
 * before analysing an image, so capping to it costs nothing in
 * analysis quality while still meaningfully shrinking a typical
 * 12MP+ phone photo. These are evidence photos for real trade jobs
 * (cracks, corrosion, wiring, rating plates, meters, pipe fittings) —
 * quality settings below are deliberately conservative, not tuned for
 * minimum file size.
 */

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 85;

export interface CompressedPhoto {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Throws on any failure (corrupt/undecodable input, unsupported mime
 * type) rather than returning something — the caller decides the
 * fallback (store the original, log a warning), this function's only
 * job is to compress or fail cleanly, never to silently produce
 * corrupt output.
 */
export async function compressJobDocPhoto(bytes: Uint8Array, mimeType: string): Promise<CompressedPhoto> {
  // .rotate() with no arguments must run before resize/encode: it reads
  // the EXIF Orientation tag, applies it to the actual pixels, and (since
  // metadata isn't preserved unless withMetadata() is called) the output
  // carries no orientation tag of its own — the image is correctly
  // right-side-up without depending on a later viewer to apply EXIF.
  const pipeline = sharp(Buffer.from(bytes))
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  let output: Buffer;
  switch (mimeType) {
    case "image/jpeg":
      output = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
      break;
    case "image/webp":
      output = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      break;
    case "image/png":
      // Screenshots and diagrams (schematics, quotes, spec sheets) are
      // common here — PNG stays PNG, lossless, never quantized to a
      // palette, so text and sharp lines never pick up JPEG-style
      // artifacts. compressionLevel only trades encode effort for size,
      // never visual quality.
      output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      break;
    default:
      throw new Error(`Unsupported mime type for photo compression: ${mimeType}`);
  }

  return { bytes: new Uint8Array(output), mimeType };
}
