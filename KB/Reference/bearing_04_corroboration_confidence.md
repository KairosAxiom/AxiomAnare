[LynxEyes KB · Bearing Signatures · 4/5 · house-authored reference · cites Smith & Randall 2015; ISO 13379-1]

# Corroboration, not single-source confirmation — and when to hedge

A bearing fault is most reliably identified when the independent views agree:

- Time waveform shows impulsive bursts (crest factor / kurtosis elevated versus
  baseline), and
- Envelope spectrum shows a peak at the correct defect frequency (BPFO for outer race,
  BPFI for inner race, BSF for rolling element), ideally with the expected modulation
  (shaft-speed sidebands for inner race; load-zone modulation for outer race).

Where the views disagree, or where the record is smeared or atypical, the correct
output is indicative / low-confidence language, not a confident fault call
(DECISIONS A2 — confidence drives language; A3 — no over-diagnosis).

Published benchmark analysis of the CWRU dataset (Smith & Randall, 2015, "Rolling
element bearing diagnostics using the Case Western Reserve University data: a benchmark
study") found that the records range from very easily diagnosable using simple envelope
analysis of the raw signal to not diagnosable by any established method. Many records
exhibit looseness-like content rather than clean bearing signatures, and ball faults in
particular are frequently among the hardest to diagnose. The implication for LynxEyes:
a tool that hedges honestly on a genuinely ambiguous record is behaving correctly, not
failing — a confident bearing call should require the corroborating evidence above.

Governance: consistent with DECISIONS A1/A2/A3. Findings paraphrased from the cited
benchmark; no verbatim text reproduced.
