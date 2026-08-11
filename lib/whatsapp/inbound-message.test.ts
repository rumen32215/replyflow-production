import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveInboundMessage } from "./inbound-message";
import type { WhatsAppInboundMessage } from "./types";

function baseMessage(overrides: Partial<WhatsAppInboundMessage>): WhatsAppInboundMessage {
  return { id: "wamid.1", from: "447818692219", timestamp: "1723370000", type: "text", ...overrides };
}

test("normal text message", () => {
  const result = deriveInboundMessage(baseMessage({ type: "text", text: { body: "Hi, my boiler is leaking" } }));
  assert.equal(result.body, "Hi, my boiler is leaking");
  assert.equal(result.mediaId, null);
  assert.equal(result.isUnsupported, false);
});

test("normal image with a caption", () => {
  const result = deriveInboundMessage(
    baseMessage({ type: "image", image: { id: "media-1", mime_type: "image/jpeg", sha256: "abc", caption: "Under the sink" } })
  );
  assert.equal(result.body, "Under the sink");
  assert.equal(result.mediaId, "media-1");
  assert.equal(result.mediaCaption, "Under the sink");
  assert.equal(result.isUnsupported, false);
});

test("normal image with no caption still carries a mediaId to download", () => {
  const result = deriveInboundMessage(baseMessage({ type: "image", image: { id: "media-2", mime_type: "image/jpeg", sha256: "abc" } }));
  assert.equal(result.body, "[image message]");
  assert.equal(result.mediaId, "media-2");
  assert.equal(result.mediaCaption, null);
});

test("multiple images in a batch are each derived independently (no shared state)", () => {
  const first = deriveInboundMessage(baseMessage({ id: "wamid.1", type: "image", image: { id: "media-1", mime_type: "image/jpeg", sha256: "a" } }));
  const second = deriveInboundMessage(baseMessage({ id: "wamid.2", type: "image", image: { id: "media-2", mime_type: "image/jpeg", sha256: "b" } }));
  assert.equal(first.mediaId, "media-1");
  assert.equal(second.mediaId, "media-2");
  assert.notEqual(first.mediaId, second.mediaId);
});

test("unsupported media type — the real bug — never treated as an image, but never silent either", () => {
  const result = deriveInboundMessage(
    baseMessage({
      type: "unsupported",
      errors: [{ code: 131051, title: "Unsupported message type", message: "Unsupported message type" }],
    })
  );
  assert.equal(result.body, "[unsupported message]");
  assert.equal(result.mediaId, null, "must never attempt to download an unsupported message as if it were an image");
  assert.equal(result.isUnsupported, true);
  assert.equal(result.unsupportedDetail, "Unsupported message type");
});

test("unsupported media type with no error detail from Meta at all", () => {
  const result = deriveInboundMessage(baseMessage({ type: "unsupported" }));
  assert.equal(result.isUnsupported, true);
  assert.equal(result.unsupportedDetail, null);
  assert.equal(result.mediaId, null);
});

test("unsupported media type falls back to error_data.details when title/message are both absent", () => {
  const result = deriveInboundMessage(
    baseMessage({ type: "unsupported", errors: [{ error_data: { details: "Message type is not currently supported" } }] })
  );
  assert.equal(result.unsupportedDetail, "Message type is not currently supported");
});

test("malformed/unknown payload — a message type Meta hasn't documented yet — still degrades honestly", () => {
  const result = deriveInboundMessage(baseMessage({ type: "sticker" as WhatsAppInboundMessage["type"] }));
  assert.equal(result.body, "[sticker message]");
  assert.equal(result.mediaId, null);
  assert.equal(result.isUnsupported, false, "only Meta's own literal \"unsupported\" type sets this — an unrecognised type is not assumed to be the same thing");
});

test("document/audio/video/location all get the same honest fallback body, never an attempted download", () => {
  for (const type of ["document", "audio", "video", "location"] as const) {
    const result = deriveInboundMessage(baseMessage({ type }));
    assert.equal(result.body, `[${type} message]`);
    assert.equal(result.mediaId, null);
  }
});
