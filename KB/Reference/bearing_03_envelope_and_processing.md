[LynxEyes KB · Bearing Signatures · 3/5 · house-authored reference · cites ISO 13373-2]

# Envelope demodulation: which race, at what rate — and the acceleration-first rule

The impacts from a bearing defect excite the structural resonances of the
bearing/housing, typically in the ~2,000–10,000 Hz range (lower for small, light
bearings; e.g. the CWRU 6205 test rig concentrates roughly 2,000–6,000 Hz). Envelope
analysis recovers the impact repetition rate:

1. Band-pass filter the acceleration signal around the excited resonance band.
2. Demodulate (Hilbert transform to obtain the amplitude envelope).
3. FFT the envelope. The defect frequency (BPFO/BPFI/BSF) now stands up clearly, even
   though it was invisible in the raw spectrum.

The demodulation band must be placed on the actual resonance and must respect the
signal's usable bandwidth (Nyquist). A band placed above the resonance, or above the
available Nyquist for the sample rate, will demodulate a region with little bearing
energy and return a near-flat envelope — producing a false "no fault" result even on a
severe defect. The band should scale with sample rate rather than being fixed.

Critical processing note. Both the impulsiveness metrics (crest factor, kurtosis) and
the envelope demodulation must be computed on the acceleration signal, before
integration to velocity. Integration acts as a low-pass filter and attenuates exactly
the high-frequency impulsive content that defines a bearing fault. Computing crest
factor, kurtosis, or the envelope on an integrated velocity signal will suppress the
bearing signature in both the time and frequency domains simultaneously.

Reference: ISO 13373-2 (envelope / demodulation analysis for rolling-element bearings).
Governance: consistent with DECISIONS A1.
