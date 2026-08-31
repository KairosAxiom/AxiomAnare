[LynxEyes KB · Bearing Signatures · 2/5 · house-authored reference · cites ISO 13373-1]

# Bearing fault signature in the time waveform (primary evidence)

Because the fault is impulsive, the acceleration time waveform is a primary — and often
the earliest — indicator of a bearing defect. Characteristic features:

- Periodic impulsive bursts: short, sharp spikes rising out of a lower background,
  spaced at the defect period (1/BPFO, 1/BPFI, 1/BSF).
- Once-per-revolution modulation: for an outer-race defect fixed relative to the load
  zone, burst amplitude is modulated once per shaft revolution as the contact passes
  through the loaded region — a strong, classic outer-race indicator. For an inner-race
  defect (which rotates with the shaft), modulation is at shaft speed and appears as
  shaft-speed sidebands around BPFI in the envelope spectrum.
- Elevated impulsiveness metrics, both computed from the time waveform:
  - Crest Factor (CF) = peak / RMS. Healthy rolling bearings sit roughly 1.4–2;
    localised impacting raises CF. CF is most sensitive in early-stage faults and can
    fall back toward normal in advanced, widespread damage where the signal becomes
    more random than impulsive.
  - Kurtosis (normalised 4th moment). A Gaussian/healthy signal is approximately 3;
    discrete impacting drives kurtosis above 3. Like CF, kurtosis is an early-stage
    indicator and can decline in late-stage distributed damage.
- Rising broadband noise floor / friction signature in later stages, as discrete
  impacts give way to continuous rubbing and smearing.

If crest factor and kurtosis read normal on a signal that is otherwise flagged as a
bearing fault, either the fault is late-stage/smeared, the record is genuinely atypical,
or the metrics were computed on a signal from which the impulsive content had already
been removed (see the processing note on acceleration vs. velocity).

Governance: consistent with DECISIONS A1. No third-party figures or verbatim text
reproduced.
