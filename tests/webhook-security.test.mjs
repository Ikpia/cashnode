import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { ObjectId, getMongoDb, __resetMongo } from "mongodb";
import { POST as paystackPost } from "../app/api/webhooks/paystack/route.ts";

const PAYSTACK_SECRET = "paystack_test_secret";

function paystackSignature(rawBody) {
  return createHmac("sha512", PAYSTACK_SECRET).update(rawBody).digest("hex");
}

async function postPaystackWebhook(rawBody, signature) {
  const request = new Request("http://cashnode.test/api/webhooks/paystack", {
    method: "POST",
    headers: {
      "x-paystack-signature": signature
    },
    body: rawBody
  });
  const response = await paystackPost(request);
  const body = await response.json();

  return { response, body };
}

beforeEach(() => {
  __resetMongo();
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
});

describe("webhook signature and idempotency handling", () => {
  it("rejects a bad Paystack webhook signature before logging the event", async () => {
    const db = await getMongoDb();
    const rawBody = JSON.stringify({
      event: "transfer.success",
      data: {
        id: "evt_bad_signature",
        reference: "transfer-bad-signature",
        status: "success"
      }
    });

    const { response, body } = await postPaystackWebhook(rawBody, "not-a-real-signature");

    assert.equal(response.status, 401);
    assert.match(body.error, /Invalid Paystack signature/);
    assert.equal(db.collection("webhook_events").__documents.length, 0);
  });

  it("treats the same Paystack webhook delivery as a duplicate the second time", async () => {
    const db = await getMongoDb();
    const rawBody = JSON.stringify({
      event: "transfer.success",
      data: {
        id: "evt_same_delivery",
        reference: "transfer-same-delivery",
        status: "success"
      }
    });
    const signature = paystackSignature(rawBody);

    const first = await postPaystackWebhook(rawBody, signature);
    const second = await postPaystackWebhook(rawBody, signature);

    assert.equal(first.response.status, 200);
    assert.equal(first.body.duplicate, false);
    assert.equal(second.response.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(db.collection("webhook_events").__documents.length, 1);
    assert.equal(db.collection("webhook_events").__documents[0]._id instanceof ObjectId, true);
  });
});
