'use strict';

/**
 * The sweep — the half of the reminder system that can send twice.
 *
 * The planner decides *what* to say; this decides *whether the send is allowed*,
 * and that is a different kind of question. It is the one place where a bug is
 * not a bad sentence but a second notification in the same evening, which is how
 * an app loses its permission for good.
 *
 * So it is built as a factory with its dependencies passed in rather than
 * required. The server hands it the real store and the real push sender; a test
 * hands it a fake sender and a throwaway database and can then assert the thing
 * that actually matters: run the sweep twice in one evening, and exactly one
 * notification is attempted.
 *
 * The order inside is deliberate:
 *
 *   1. plan (pure)
 *   2. claim the day in push_log  ← the gate
 *   3. only if the claim succeeded, send
 *   4. prune the subscription if the push service says it is gone
 *
 * Claiming before sending means a crash between the two loses one reminder,
 * which is the right way to be wrong: a missed nudge costs nothing, a duplicate
 * costs the permission.
 */

function createSweeper({ store, push, reminders }) {
  return async function runPushSweep({ dryRun = false, nowMs = Date.now() } = {}) {
    if (!push.isEnabled()) return { disabled: true, planned: [], sent: 0 };

    const targets = store.listPushTargets(nowMs);
    const plan = reminders.planSweep(targets, nowMs);
    const sentOn = reminders.hktParts(nowMs).date;

    const summary = {
      at: new Date(nowMs).toISOString(),
      hkt: reminders.hktParts(nowMs),
      candidates: targets.length,
      planned: plan.map((p) => ({ kind: p.kind, lang: p.lang, title: p.payload.title })),
      claimed: 0,
      sent: 0,
      failed: 0,
      expired: 0,
    };

    // A dry run answers "what would you say right now?" without writing the
    // claim, so it can be run at any hour from the admin screen.
    if (dryRun || !plan.length) return summary;

    const byEndpoint = new Map(targets.map((t) => [t.endpoint, t]));

    for (const item of plan) {
      // The gate. Only the sweep that inserted today's row may send.
      if (!store.claimPush(item.endpoint, item.kind, sentOn)) continue;
      summary.claimed += 1;

      const target = byEndpoint.get(item.endpoint);
      if (!target || !target.keys) continue;

      try {
        const res = await push.sendNotification(
          { endpoint: item.endpoint, keys: target.keys },
          item.payload
        );
        if (res.expired) {
          store.removeSubscription(item.endpoint);
          summary.expired += 1;
        } else if (res.ok) {
          store.markReminded(item.endpoint);
          summary.sent += 1;
        } else {
          summary.failed += 1;
        }
      } catch (e) {
        summary.failed += 1;
        console.error('push send failed:', e.message);
      }
    }

    return summary;
  };
}

module.exports = { createSweeper };
