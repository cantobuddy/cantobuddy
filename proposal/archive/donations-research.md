# ARCHIVED — Donations research (Hong Kong)

> **Status: removed from the CantoBuddy plan on 4 October 2026**, at the operator's request.
> Nothing in this file is part of the product any more. There is no donations screen in
> `prototype.html`, no donations tab in the admin back office, and no donation records in the
> data model.
>
> It is kept only so the research is not thrown away — if donations are ever reconsidered, the
> legal position is already established and does not need re-researching. **Delete this file if
> you would rather it not exist at all.**

---

## Why it was removed

Not for legal reasons — the opposite. The research below found that accepting donations online in
Hong Kong is lawful with no licence. It was removed as a **product decision**: donations are a
receipt-and-record chore with a tax question attached, and at this stage the revenue model rests on
the employer side (paid tier, agency sponsorship, NGO grants, white-label licensing). Fewer moving
parts.

**Removing it also reduces risk.** Donations were always the one money-adjacent feature left in the
product, and the rule that keeps CantoBuddy outside Money Service Operator licensing is that no
money ever enters it. With donations gone, **nothing** enters. That constraint is now absolute
rather than qualified.

**One knock-on effect worth noting:** the "sole trader or limited company?" question used to matter
for two reasons — donations tax and personal liability. The donations half is now moot. The
liability half is not, so the question still stands, just narrower.

---

## The original finding

You asked whether receiving donations is legal. **Yes — and Hong Kong's position is unusually clear
on this.**

In a 2020 Legislative Council reply on the regulation of *online* fundraising, the Government stated
that the permit regime under the Summary Offences Ordinance (Cap. 228) exists **"to prevent nuisance
and obstruction caused by the relevant fund-raising activities in public places"** and that **"the
relevant regulation is not applicable to online fund-raising activities"**, adding: **"We have no
intention to extend the existing regulatory regime to online fund-raising activities at the
moment."** That remains the position — Hong Kong has **no charity regulator**, and the Law Reform
Commission's 2013 proposal for a charities commission was never enacted.

**So: no licence, no permit, no registration is required to accept donations online in Hong Kong.**
But four conditions mattered, and all four were cheap to satisfy:

| Condition | Why | What we would have done |
|---|---|---|
| **Never claim to be a charity** | Representing yourself as a registered charity when you are not is a deception offence (Theft Ordinance, Cap. 210) | Say "CantoBuddy is not a registered charity" plainly on the donations screen |
| **Never claim donations are tax-deductible** | Only gifts to a **s.88** tax-exempt institution are deductible — min HK$100, capped at 35% of assessable income | State that donations are **not** tax-deductible |
| **Never pass donated money to helpers** | This is the one that would have re-opened the MSO risk — routing donated funds onward to helpers looks like money transmission and can trigger **MSO licensing** | Donations are **general revenue**. Never earmarked, never forwarded to a helper |
| **Keep records** | AML/CTF (Cap. 615) and ordinary fraud law still apply; odd or large flows get scrutiny | A record-only screen |

### The tax caveat

The same LegCo reply notes that if an organisation *does not carry on any trade or business*,
donations "would not constitute any trading or business profits" and there would be **no profits tax
liability**. CantoBuddy's planned employer paid tier may mean it *does* carry on a business — which
could have made donations assessable. Worth one question to an accountant **if** donations ever come
back. Not relevant while they are out.

### If donors ever need a tax deduction

That requires becoming a **s.88 charity**: a written governing instrument, purposes that are legally
charitable (advancing education is a plausible fit here), demonstrable public benefit, an application
to the IRD (roughly 4 months), and ongoing reviews. That is a real project, not a checkbox — worth
revisiting once the app has traction.

---

## What would have to change to bring it back

1. Re-add the `donations` screen to `prototype.html` (one entry in the `admin` screens map — the nav
   is generated from it, so nothing else needs touching).
2. Add a donations table to `db.js` and a record-only admin tab.
3. Re-add the four conditions above as UI copy.
4. **Re-read §4.1 of `PROPOSAL.md` first.** Donations are a *receipt*, not a *transmission*, so they
   do not by themselves reopen the MSO question — but the moment any donated money is routed toward
   a helper, it does. That is the line.
