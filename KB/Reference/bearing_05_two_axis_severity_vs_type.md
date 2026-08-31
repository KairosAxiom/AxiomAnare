[LynxEyes KB · Bearing Signatures · 5/5 · house-authored reference · cites ISO 10816-3, ISO 13379-1, ISO 13373]

# Two-axis rule: severity and fault type are separate ISO questions

Two orthogonal questions, answered by two different standards. They must not be
conflated:

- "How severe?" — Overall velocity RMS graded against ISO 10816-3 vibration severity
  zones (A/B/C/D). This is a whole-machine loudness gauge. It does not identify the
  fault type. Note that ISO 10816-3 zones are defined for field measurements on machine
  bearing housings under normal running conditions; applying them to laboratory-rig or
  otherwise non-standard acquisitions is a validity boundary that should be surfaced in
  the report, not hidden.
- "What is it?" — Fault type identified from which frequency carries the energy
  (envelope demodulation for bearings; the raw velocity spectrum for shaft-synchronous
  faults), per the diagnostic methods of ISO 13379-1 and ISO 13373 — reported with an
  explicit confidence level.

ISO prescribes the diagnostic method and the severity scale; it does not provide a
single amplitude threshold that "confirms" a specific fault type. A machine can reach
ISO 10816-3 Zone D from unbalance, misalignment, or a bearing defect — the zone alone
cannot distinguish them. Fault-type confirmation is a diagnostic-confidence judgement,
not a severity-threshold crossing.

Quick reference — fault to primary evidence path:
- Unbalance: raw velocity spectrum; dominant 1×; ISO 13379-1.
- Misalignment: raw velocity spectrum; elevated 2× (and 3×); ISO 13379-1.
- Looseness: raw velocity spectrum; harmonics plus sub-harmonics, raised noise floor;
  ISO 13379-1.
- Bearing outer race: envelope plus time waveform; BPFO in envelope, load-zone
  modulation, crest factor / kurtosis elevated; ISO 13373-2 / 13379-1.
- Bearing inner race: envelope plus time waveform; BPFI with shaft-speed sidebands,
  crest factor / kurtosis elevated; ISO 13373-2 / 13379-1.
- Bearing rolling element: envelope plus time waveform; BSF, often via FTF/cage
  modulation, crest factor / kurtosis elevated; ISO 13373-2 / 13379-1.

Severity for all of the above is graded separately by velocity RMS against ISO 10816-3.

Governance: consistent with DECISIONS A1. Standards referenced at the level verifiable
without inventing clause-level notation (per the open A1 audit).
