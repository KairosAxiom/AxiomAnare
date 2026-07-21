# ISO Reference Corrections — Verified Table

**Ringfence integrity pass (A1).** The AI-report ringfence mechanism is sound —
the Worker is a pure pass-through, CONFIG-as-data holds, the anti-hallucination
prompt block is enforced, and RAG context is fenced separately from ISO
citations. The residual risk is therefore **wrong constants**, not runtime
hallucination: the engine faithfully cites whatever is stored in CONFIG, so a
wrong stored clause becomes a wrong citation on every report.

**Method — option (a): cite only to the level that can be verified.** Where a
per-zone or per-row sub-clause decimal cannot be confirmed against the published
standard, the correction cites to the highest verified level (table / annex /
clause) rather than inventing precision. No fabricated `Sx.x` suffixes are
retained or replaced with equally-unverifiable new ones.

**Confidence key:**
`CONFIRMED` = verified against the ISO 10816-3:2009(E) published document this
session. `VERIFY` = flagged for standard-by-standard checking in the full pass
(not yet done — see "Scope" at end).

---

## Section 1 — ISO 10816-3:2009 (severity zones)  — CONFIRMED

### What the standard actually says (verified against ISO 10816-3:2009(E))
- Evaluation-zone boundary values live in **Table A.1 (rigid support)** and
  **Table A.2 (flexible support)** — two tables split by support type, not a
  single "Table 1."
- The four evaluation zones (A/B/C/D) are the row structure *within* those
  tables. There is **no `S5.1 / S5.2 / S5.3 / S5.4` per-zone sub-clause** — that
  notation does not exist in the standard.
- The evaluation-zone concept is defined in **Clause 5**; support-type
  classification (rigid vs flexible) in **Clause 4**.
- Machine categories are formally **Groups (1–4)**, not "Classes." ("Class I–IV"
  is older ISO 2372 language.)

### The three defects in current CONFIG
1. `Table 1` → should be `Table A.1` (rigid) or `Table A.2` (flexible).
2. `S5.1 / S5.2 / S5.3 / S5.4` → fabricated; no such sub-clauses. Zones are table
   rows, not clauses.
3. `Class I–IV` labels → standard uses `Group 1–4`.

### Correction — `iso_severity_zones[].iso_clause_ref`

Current CONFIG uses ONE string per zone letter, reused across all classes:

| Current (all classes)              | Corrected — RIGID mount rows        | Corrected — FLEXIBLE mount rows      |
|------------------------------------|-------------------------------------|--------------------------------------|
| `ISO 10816-3:2009 Table 1 S5.1`    | `ISO 10816-3:2009 Table A.1, Zone A`| `ISO 10816-3:2009 Table A.2, Zone A` |
| `ISO 10816-3:2009 Table 1 S5.2`    | `ISO 10816-3:2009 Table A.1, Zone B`| `ISO 10816-3:2009 Table A.2, Zone B` |
| `ISO 10816-3:2009 Table 1 S5.3`    | `ISO 10816-3:2009 Table A.1, Zone C`| `ISO 10816-3:2009 Table A.2, Zone C` |
| `ISO 10816-3:2009 Table 1 S5.4`    | `ISO 10816-3:2009 Table A.1, Zone D`| `ISO 10816-3:2009 Table A.2, Zone D` |

**Why "Table A.1/A.2, Zone X" and not a decimal clause:** the zone *is* the row;
naming the table + zone letter is the full verifiable address of that value.
Adding a `.1/.2` would re-introduce invented precision — the exact failure being
corrected. This is option (a) applied.

**Rigid vs flexible routing:** CONFIG already carries `mounting_type` per class
(`"Rigid Mount"` / `"Flexible Mount"`), so each zone row can be pointed at A.1 or
A.2 by reading its class's mounting type. The mapping in current CONFIG:
- `cls_i`, `cls_ii`, `cls_iii` → Rigid Mount → **Table A.1**
- `cls_ii_f`, `cls_iv` → Flexible Mount → **Table A.2**

### Correction — machine class labels (optional but recommended)
`iso_machine_classes[].display_label`: `Class I–IV` → `Group 1–4`, to match the
standard's own terminology. Note the *number* mapping if you do this: verify
which of your power bands corresponds to the standard's Group 1 (large, >300 kW)
vs Group 2 (medium, 15–300 kW) before relabelling — the standard's Group numbers
are not in the same order as "Class I = smallest." This one is a **VERIFY** on the
number mapping even though the "Group not Class" wording is CONFIRMED.

### Separately — verify the boundary VALUES, not just the labels
This table corrects *citations*. The numeric `rms_upper_mm_s` values should also
be spot-checked against Table A.1/A.2 for the matched Group, since a correct
citation on a wrong number is still wrong. Published Group 2 / rigid boundaries
commonly cited: A/B ≈ 1.4, B/C ≈ 2.8, C/D ≈ 4.5 mm/s (verify against your exact
Group mapping). The current CONFIG Class II rigid values (2.3 / 7.1 / 11.2) look
like they may be tracking a different Group than the label implies — **VERIFY**.

---

## Section 2 — Other standards  — VERIFY (not yet checked)

The same `Sx.x` notation pattern appears on the references below. Each needs the
same treatment: confirm the real clause/annex structure, then correct to the
verifiable level (option (a)). NOT yet verified — listed so nothing is missed.

| Standard (as stored in CONFIG)          | Where used                    | Status |
|-----------------------------------------|-------------------------------|--------|
| `ISO 13379-1:2012 S5.2 / S5.3 / S5.4`   | fault rules                   | VERIFY |
| `ISO 13379-1:2012 Annex A SA.3`         | fault confidence tiers        | VERIFY |
| `ISO 13379-1:2012 S6.4`                 | early-warning rule            | VERIFY |
| `IEC 60034-14:2003 S5.1 / S5.2 / S5.4`  | electrical fault rules        | VERIFY |
| `ISO 55001:2014 S8.1`                   | asset-mgmt references         | VERIFY |
| `ISO 13373-2:2016 S7.3 / S7.4 / S8.1 / S8.2` | kurtosis/CF/deviation/trend | VERIFY |
| `ISO 13373-1:2002 S7.3`                 | monitoring intervals          | VERIFY |
| `ISO 13373-1:2002 §6.3.x`               | cross-axis rules (uses § not S) | VERIFY |
| `ISO 13381-1:2015 S5.2`                 | RUL base days                 | VERIFY |

Note: the cross-axis rules already use `§6.3.2` style (standard-looking) rather
than `S6.3`, so those may already be closer to correct — worth confirming whether
§6.3.x actually exists in ISO 13373-1:2002 or is also approximate.

---

## Recommended companion change — tighten the RAG/ISO boundary

Independent of the constants: the AI prompt fences KB (RAG) context separately
from ISO citations, and Rule 4 says "cite ONLY ISO clauses from the NVR record."
That implicitly stops a KB excerpt being cited as an ISO clause, but it is
implicit. One explicit sentence closes it, e.g. add to the KNOWLEDGE BASE CONTEXT
block: *"These excerpts are background only. Never cite them as ISO/IEC clauses —
ISO/IEC citations may come ONLY from the NVR record above."* This keeps Layer 1
(RAG enrichment) from bleeding into Layer 2 (standard citations).

---

## Scope note
Section 1 (ISO 10816-3) is verified and ready to apply. Section 2 is the
remaining five/​six-standard pass — deferred pending your go-ahead, since full
sub-clause verification against paywalled standards will, per option (a), likely
resolve several references to "Annex X / Clause N" level rather than an exact
decimal. That is the correct, defensible outcome, not a shortfall.
