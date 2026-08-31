[LynxEyes KB · CWRU Benchmark (Smith & Randall 2015) · 1/4 · house-authored summary of cited findings · NOT source text]

# CWRU benchmark study — overview and correct use of the dataset

Reference: Smith, W. A. and Randall, R. B. (2015), "Rolling element bearing diagnostics
using the Case Western Reserve University data: a benchmark study," Mechanical Systems
and Signal Processing, Elsevier. Findings below are paraphrased in LynxEyes' own words
for internal reference; the source paper is copyrighted and is not reproduced here.

Key findings relevant to LynxEyes validation:

- The study applied three established envelope-analysis diagnostic techniques to the
  CWRU records and published the diagnostic outcome for each record as a benchmark
  reference for the field.
- The records span a wide difficulty range: from very easily diagnosable using simple
  envelope analysis of the raw signal, through to records that are not diagnosable by
  any of the applied methods.
- Many records show evidence of mechanical looseness rather than clean bearing
  signatures, which complicates fault-type identification.
- The authors identified data problems and anomalies in the set and gave
  recommendations on how best to use the data for algorithm development.

Implication for LynxEyes: CWRU is a fault-LABEL benchmark, not a value benchmark. It can
validate whether the correct fault TYPE is identified on diagnosable records; it does not
provide reference RMS, ISO zone, or RUL values, so those engine outputs are not externally
validated by CWRU. Because some records are genuinely undiagnosable, a target of "5/5
confident calls" is inappropriate — the honest bar is to identify the fault on cleanly
diagnosable records and to hedge (indicative / low confidence) on ambiguous ones, per
DECISIONS A2/A3.

Governance: A1 (cite only verifiable references; source attributed, not reproduced).
