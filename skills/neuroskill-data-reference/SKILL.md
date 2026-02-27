---
name: neuroskill-data-reference
description: NeuroSkill EEG data reference — all metric fields including band powers, EEG ratios and indices, core scores, complexity measures, PPG/HRV fields, motion and artifact markers, sleep stage codes, EXG correlate indices, and consciousness metrics. Use when looking up what a specific metric means or its value range.
---

# NeuroSkill Data Reference

---

## EEG Band Powers

Relative power — values sum to approximately 1.0.
Found under `scores.bands` in `status`, or as `rel_*` top-level keys in metric responses.

| Field | Band | Range | What it means |
|---|---|---|---|
| `rel_delta` | δ 0.5–4 Hz | 0–1 | Deep sleep, unconscious processes. High during N3 sleep or drowsiness. |
| `rel_theta` | θ 4–8 Hz | 0–1 | Drowsiness, meditation, creativity, memory encoding. High in ADHD (TBR). |
| `rel_alpha` | α 8–13 Hz | 0–1 | Relaxed wakefulness, idle cortex, eyes-closed state. Drops on task engagement. |
| `rel_beta` | β 13–30 Hz | 0–1 | Active thinking, focus, anxiety. High beta = cognitive effort or stress. |
| `rel_gamma` | γ 30–100 Hz | 0–1 | Sensory binding, high-level cognition. Low in schizophrenia. |

---

## EEG Ratios & Indices

| Field | Formula | What it means |
|---|---|---|
| `faa` | ln(αR) − ln(αL) | **Frontal Alpha Asymmetry.** Positive = approach motivation / positive affect. Negative = withdrawal / depression. |
| `tar` | θ / α | **Theta/Alpha Ratio.** High = drowsy or meditative. |
| `bar` | β / α | **Beta/Alpha Ratio.** High = alert, possibly anxious. |
| `dtr` | δ / θ | **Delta/Theta Ratio.** High in deep sleep or pathological slowing. |
| `tbr` | θ / β | **Theta/Beta Ratio.** Main ADHD biomarker. Healthy ~1.0; elevated ADHD >1.5. |
| `pse` | (power law slope) | **Power Spectral Exponent.** Steeper = more 1/f, typical of rest. Flatter = active. |
| `bps` | (regression slope) | **Band-Power Slope.** Similar to PSE; measures spectral tilt. |
| `apf` | Hz | **Alpha Peak Frequency.** 8–12 Hz typical; shifts with age and cognitive state. |
| `sef95` | Hz | **Spectral Edge Frequency 95%.** Frequency below which 95% of power falls. |
| `spectral_centroid` | Hz | **Spectral Centroid.** Weighted average frequency — rises with cognitive load. |
| `coherence` | 0–1 | **Inter-channel coherence.** High = coordinated brain activity. |
| `mu_suppression` | 0–1 | **Mu rhythm suppression.** Increases with motor imagery or observed action. |
| `laterality_index` | −1 to 1 | **Hemispheric laterality.** Left vs. right hemispheric dominance. |
| `snr` | dB | **Signal-to-Noise Ratio.** > 10 dB = good signal; < 5 dB = noisy. |

---

## Core Scores

0–1 range unless noted. Computed per 5-second epoch by the on-device model.

| Field | What it means |
|---|---|
| `focus` | Sustained attention. Driven by frontal beta and suppressed alpha. |
| `relaxation` | Calm, low-arousal state. High alpha, low beta. |
| `engagement` | Active cognitive engagement. Composite of beta, theta, alpha suppression. |
| `meditation` | Meditative depth. High frontal alpha, stable theta, low beta. |
| `mood` | Valence estimate. Positive FAA and alpha balance → positive mood. |
| `cognitive_load` | Mental effort. High theta + beta, low alpha. |
| `drowsiness` | Sleepiness. High delta + theta, alpha intrusions. |

---

## Complexity Measures

Nonlinear EEG measures — higher complexity generally means a more flexible, awake brain state.

| Field | What it means |
|---|---|
| `hjorth_activity` | Signal variance (power). |
| `hjorth_mobility` | Mean frequency estimate. |
| `hjorth_complexity` | Signal shape complexity — how much the signal changes its frequency. |
| `permutation_entropy` | Ordinal pattern entropy. Near 1 = complex/random; near 0 = highly ordered. |
| `higuchi_fd` | Fractal dimension. ~1.5–1.8 during healthy wakefulness. |
| `dfa_exponent` | Detrended fluctuation. ~0.5 = white noise; ~1.0 = long-range correlations. |
| `sample_entropy` | Regularity — lower = more predictable/periodic signal. |
| `pac_theta_gamma` | Phase-Amplitude Coupling (θ–γ). Linked to working memory and attention. |

---

## PPG / Heart Rate Variability

Derived from the Muse PPG sensor (forehead).

| Field | Unit | What it means |
|---|---|---|
| `hr` | bpm | Heart rate. |
| `rmssd` | ms | Root mean square of successive differences — parasympathetic HRV. High = relaxed. |
| `sdnn` | ms | Standard deviation of NN intervals — overall HRV. |
| `pnn50` | % | % of successive differences > 50 ms — parasympathetic index. |
| `lf_hf_ratio` | ratio | Low/High frequency power ratio — sympathetic vs. parasympathetic balance. High = stress. |
| `respiratory_rate` | bpm | Estimated breathing rate from PPG. |
| `spo2_estimate` | % | Estimated blood oxygen saturation (research only). |
| `perfusion_index` | % | Ratio of pulsatile to static IR signal — peripheral perfusion quality. |
| `stress_index` | 0–100 | Composite stress index. High HR + low HRV + high LF/HF → high stress. |

---

## Motion & Artifacts

| Field | What it means |
|---|---|
| `stillness` | 0–1. Head movement score; 1 = no motion. |
| `head_pitch` | Degrees forward/backward tilt. |
| `head_roll` | Degrees left/right tilt. |
| `nod_count` | Number of detected vertical head nods. |
| `shake_count` | Number of detected horizontal head shakes. |
| `blink_count` | Number of detected eye blinks (from frontal electrodes). |
| `blink_rate` | Blinks per minute. |
| `jaw_clench_count` | Number of detected jaw clenches (EMG artifact). |
| `jaw_clench_rate` | Jaw clenches per minute. |

---

## Sleep Stages

Used in `sleep` and `status.sleep`.

| Stage | Code | EEG signature |
|---|---|---|
| Wake | `0` | High beta, present alpha when eyes closed |
| N1 | `1` | Slow eye movements, alpha fades, theta begins |
| N2 | `2` | Sleep spindles (12–15 Hz bursts), K-complexes, dominant theta |
| N3 | `3` | High-amplitude delta > 50% of epoch — deep/slow-wave sleep |
| REM | `4` | Low-amplitude mixed frequency, sawtooth waves, suppressed delta |

---


## Consciousness Metrics

From `consciousness`. All 0–100 (higher = better).

| Metric | What it measures | Reference (verified DOI) |
|---|---|---|
| `lzc` | Lempel-Ziv Complexity proxy — signal diversity; drops under anesthesia | Casali et al. (2013) · doi:[10.1126/scitranslmed.3006294](https://doi.org/10.1126/scitranslmed.3006294) |
| `wakefulness` | Inverse drowsiness — high alpha relative to theta | Klimesch (1999) · doi:[10.1016/s0165-0173(98)00056-3](https://doi.org/10.1016/s0165-0173(98)00056-3) |
| `integration` | Composite of coherence × PAC × spectral entropy — cortical integration | Tononi (2004) · doi:[10.1186/1471-2202-5-42](https://doi.org/10.1186/1471-2202-5-42) |

> **Consciousness:** ≥ 50 = green, 25–50 = yellow, < 25 = red.

---

## References

All DOIs below are verified against the Skill application reference list (`HelpReferences.svelte`).
Only papers present in that list are cited here.

| # | Citation | DOI |
|---|---|---|
| [64] | Monastra, V. J., Lubar, J. F., Linden, M. (2001). The development of a quantitative electroencephalographic scanning process for ADHD. *Neuropsychology*, 15(1), 136–144. | doi:10.1037/0894-4105.15.1.136 |
| [66] | Demerdzieva, A., Pop-Jordanova, N. (2015). Relation Between Frontal Alpha Asymmetry and Anxiety in Young Patients with Generalized Anxiety Disorder. *PRILOZI*, 36(2), 157–177. | doi:10.1515/prilozi-2015-0064 |
| [67] | Stewart, J. L., Coan, J. A., Towers, D. A., Allen, J. J. B. (2014). Resting and task-elicited prefrontal EEG alpha asymmetry in depression. *Psychophysiology*, 51(5), 446–455. | doi:10.1111/psyp.12191 |
| [68] | Perlis, M. L., Merica, H., Smith, M. T., Giles, D. E. (2001). Beta EEG activity and insomnia. *Sleep Medicine Reviews*, 5(5), 365–376. | doi:10.1053/smrv.2001.0151 |
| [69] | Bjørk, M. H., Stovner, L. J., Engstrøm, M. et al. (2009). Interictal quantitative EEG in migraine: a blinded controlled study. *The Journal of Headache and Pain*, 10(5), 331–339. | doi:10.1007/s10194-009-0140-4 |
| [70] | Gloss, D. S., Nolan, S. J., Staba, R. (2014). The role of high-frequency oscillations in epilepsy surgery planning. *Cochrane Database of Systematic Reviews*. | doi:10.1002/14651858.cd010235.pub2 |
| [71] | Dauvilliers, Y. (2007). Narcolepsy with Cataplexy: Hypocretin and Immunological Aspects. In: *Neuroimmunology of Sleep* (Springer), pp. 337–352. | doi:10.1007/978-0-387-69146-6_20 |
| [72] | Jeong, J. (2004). EEG dynamics in patients with Alzheimer's disease. *Clinical Neurophysiology*, 115(7), 1490–1505. | doi:10.1016/j.clinph.2004.01.001 |
| [73] | Spironelli, C., Fusina, F., Bortolomasi, M., Angrilli, A. (2021). EEG Frontal Asymmetry in Dysthymia, Major Depressive Disorder and Euthymic Bipolar Disorder. *Symmetry*, 13(12), 2414. | doi:10.3390/sym13122414 |
| [74] | Uhlhaas, P. J., Singer, W. (2010). Abnormal neural oscillations and synchrony in schizophrenia. *Nature Reviews Neuroscience*, 11(2), 100–113. | doi:10.1038/nrn2774 |
| [75] | Casali, A. G., Gosseries, O., Rosanova, M. et al. (2013). A Theoretically Based Index of Consciousness Independent of Sensory Processing and Behavior. *Science Translational Medicine*, 5(198), 198ra105. | doi:10.1126/scitranslmed.3006294 |
| [6]  | Klimesch, W. (1999). EEG alpha and theta oscillations reflect cognitive and memory performance. *Brain Research Reviews*, 29(2–3), 169–195. | doi:10.1016/s0165-0173(98)00056-3 |
| [76] | Tononi, G. (2004). An information integration theory of consciousness. *BMC Neuroscience*, 5, 42. | doi:10.1186/1471-2202-5-42 |
