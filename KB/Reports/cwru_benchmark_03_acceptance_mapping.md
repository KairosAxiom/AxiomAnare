[LynxEyes KB · CWRU Benchmark (Smith & Randall 2015) · 3/4 · house-authored acceptance mapping]

# LynxEyes acceptance mapping — the five CWRU drive-end test files

Derived from the benchmark findings (Smith & Randall 2015) and applied to LynxEyes'
labelled test files. This defines the correct acceptance bar for the diagnostic engine,
replacing an arbitrary "5/5 confident" target with one aligned to what the data actually
supports (DECISIONS A2/A3, A6).

Expected correct behaviour per file (drive end, 1797 rpm, 12 kHz):

- Normal: healthy. Correct output is ISO 10816-3 Zone A/B with no confident bearing
  fault. A confident fault call here is a false positive.
- Inner race 0.007" (IR_007): cleanly diagnosable. Correct output identifies INNER RACE
  (BPFI with shaft-speed sidebands) as the leading bearing fault.
- Outer race 0.007" (OR_007): outer-race centred in load zone is the clearest group in
  the benchmark. Correct output identifies OUTER RACE (BPFO) as the leading fault.
- Outer race 0.021" (OR_021): cleanly diagnosable, high severity. Correct output
  identifies OUTER RACE (BPFO) as the leading fault.
- Ball 0.007" (Ball_007): ball faults are among the hardest in the set; discrete
  envelope components often correspond to BPFO/BPFI rather than a clean BSF. An
  indicative / low-confidence rolling-element call — or an honest hedge — is ACCEPTABLE
  and correct here; a forced confident call would violate A2/A3.

Acceptance gate for any diagnostic/scoring change (with CWRU re-run per A6):
- Diagnosis: OR_007, OR_021, IR_007 identify the correct bearing fault as leading;
  Ball_007 hedges acceptably; Normal stays clean.
- Ringfences must still hold: A1 (no invented ISO clauses; citations unchanged),
  A2 (sub-threshold faults use indicative language), A3 (no over-diagnosis on clean
  data), A4 (electrical cap intact; vib-derived electrical never outranks a bearing/
  mechanical fault), A12 (assumed-input flags still fire).

Note: CWRU cannot validate the severity numbers (RMS / ISO zone / RUL) on these lab
accelerometer files — treat those as engine outputs without external ground truth.

Governance: A1, A2, A3, A6.
