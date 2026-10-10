import test from "node:test";
import assert from "node:assert/strict";
import { createVercelDatabase, postgresSql } from "../app/lib/vercel-database.ts";

test("SQL parameters remain bound and question marks in literals are preserved", async () => {
  assert.equal(postgresSql(`SELECT '?' AS literal, "?" FROM phone_listings WHERE id = ? AND model = ?`), `SELECT '?' AS literal, "?" FROM phone_listings WHERE id = $1 AND model = $2`);
  const driver = { async query(text, values) {
    assert.equal(text, "SELECT id FROM phone_listings WHERE id = $1");
    assert.deepEqual(values, ["' OR 1=1 --"]);
    return { command: "SELECT", rowCount: 1, rows: [{ id: "synthetic-id" }] };
  } };
  const db = createVercelDatabase("unused", driver);
  assert.deepEqual(await db.prepare("SELECT id FROM phone_listings WHERE id = ?").bind("' OR 1=1 --").first(), { id: "synthetic-id" });
});

test("batches are ordered serializable transactions, and changes counts distinguish reads and writes", async () => {
  const driver = { async transaction(callback, options) {
    assert.equal(options.isolationLevel, "Serializable");
    assert.equal(options.fullResults, true);
    const queries = callback({ query(text, values) { return { text, values }; } });
    assert.deepEqual(queries, [{ text: "UPDATE phone_listings SET model = $1 WHERE id = $2", values: ["Updated", "id"] }, { text: "SELECT id FROM phone_listings", values: [] }]);
    return [{ command: "UPDATE", rowCount: 1, rows: [] }, { command: "SELECT", rowCount: 1, rows: [{ id: "id" }] }];
  } };
  const db = createVercelDatabase("unused", driver);
  const results = await db.batch([db.prepare("UPDATE phone_listings SET model = ? WHERE id = ?").bind("Updated", "id"), db.prepare("SELECT id FROM phone_listings")]);
  assert.equal(results[0].meta.changes, 1);
  assert.equal(results[1].meta.changes, 0);
  assert.deepEqual(results[1].results, [{ id: "id" }]);
});

test("only guaranteed rollback failures are retried; ambiguous connection failures are not replayed", async () => {
  for (const code of ["40001", "40P01", "ECONNRESET"]) {
    let attempts = 0;
    const db = createVercelDatabase("unused", { async transaction() {
      attempts++; throw Object.assign(new Error("Synthetic failure"), { code });
    } });
    await assert.rejects(db.batch([db.prepare("SELECT id FROM phone_listings")]));
    assert.equal(attempts, code === "ECONNRESET" ? 1 : 3);
  }
});
