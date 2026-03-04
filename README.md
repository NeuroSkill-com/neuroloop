# NeuroLoop

**NeuroLoop** is an EXG-aware AI coding and life companion powered by a real-time consumer EXG device (Muse 2 / Muse S). It reads brainwaves and physiology continuously and uses that live biometric data to inform every response — adapting its tone, offering guided protocols, and labelling meaningful mental states as they happen.

NeuroLoop runs on top of the [pi coding agent](https://github.com/mariozechner/pi-coding-agent) framework and communicates with the [NeuroSkill](https://neuroskill.com) EXG analysis server, which exposes a local WebSocket API for real-time neural data.

[Paper](https://arxiv.org/abs/2603.03212)

---

## Features

- 🧠 **Live EXG context** — injects a real-time snapshot of brain state (focus, relaxation, engagement, drowsiness, HRV, sleep stage, consciousness indices, etc.) into every LLM turn
- 🎯 **Contextual skill loading** — automatically selects and injects relevant skill files based on the user's message domain
- 🏃 **Guided protocols** — 70+ mind-body practices (breathing, meditation, somatic work, sleep, music, exercise) triggered and timed from within the agent
- 🏷️ **Auto-labelling** — silently annotates notable mental, emotional, and philosophical moments as EXG timestamps
- 💾 **Persistent memory** — reads and writes a long-term memory file across sessions
- 🌐 **Web tools** — `web_fetch` and `web_search` available to the agent
- 📡 **Prewarm cache** — kicks off expensive `neuroskill compare` runs proactively in the background

---

## Quick Start

```bash
npx neuroloop
```

Requires Node.js ≥ 20. The NeuroSkill EXG server must be running and a Muse device connected for live biometric features.

---

## How It Works

On every user message the harness:

1. Runs `neuroskill status` and injects the live EXG snapshot into the system prompt and a visible chat bubble
2. Detects domain signals in the user's prompt (stress, sleep, focus, protocols, etc.)
3. Runs the relevant NeuroSkill commands in parallel (indices, session trends, label search, etc.)
4. If protocol intent is detected, injects the full protocol repertoire (`skills/neuroskill-protocols/SKILL.md`)
5. Injects the capability index (`NEUROLOOP.md`) so the LLM always knows what tools are available

---

## EXG Metrics

NeuroLoop exposes 40+ neuroscientific metrics derived from the Muse headset, including:

- EXG band powers (δ, θ, α, β, γ) at TP9, AF7, AF8, TP10
- Ratios and indices: TAR, BAR, TBR, DTR, PSE, APF, BPS, SNR, Coherence, PAC, FAA
- Complexity measures: Permutation Entropy, Higuchi FD, DFA Exponent, Sample Entropy
- Composite scores: Focus, Relaxation, Engagement, Meditation, Cognitive Load, Drowsiness
- Consciousness metrics: LZC, Wakefulness, Information Integration
- PPG / HRV: Heart Rate, RMSSD, SDNN, pNN50, LF/HF Ratio, SpO₂, Baevsky Stress Index
- Sleep staging: Wake / N1 / N2 / N3 / REM

> ⚠️ **Research Use Only.** All metrics are experimental outputs from consumer-grade EXG hardware. They are not validated clinical measurements, not FDA/CE-cleared, and must not be used for diagnosis or treatment.

See [`METRICS.md`](METRICS.md) for the full scientific reference for every metric.

---

## Repository Structure

```
neuroloop/
├── src/
│   ├── main.ts          # Entry point
│   ├── neuroloop.ts     # Extension factory (tools, hooks, renderers)
│   └── memory.ts        # Persistent memory helpers
├── skills/              # Domain skill files injected into the system prompt
├── NEUROLOOP.md         # Capability index (skill routing table)
├── METRICS.md           # Full neuroscientific reference for all EXG metrics
├── pi-pkg/              # pi package manifest
└── dist/                # Compiled output (neuroloop.js)
```

---

## How to Cite

If you use NeuroLoop in academic work, please cite it as:

```bibtex
@software{neuroloop2026,
  author       = {Nataliya Kosmyna and Eugene Hauptmann},
  title        = {{NeuroLoop: An EXG-Aware AI Companion Powered by Real-Time Brainwave Analysis}},
  year         = {2026},
  version      = {0.0.1},
  url          = {https://github.com/NeuroSkill-com/neuroloop}
}
```

### Related Work

NeuroLoop builds on the following neuroscientific foundations. If you use specific metrics, please also cite the primary literature listed in [`METRICS.md`](METRICS.md). Key upstream works include:

```bibtex
@article{krigolson2017choosing,
  author  = {Krigolson, Olav E. and Williams, Chad C. and Norton, Angela and Hassall, Cameron D. and Colino, Francisco L.},
  title   = {Choosing {MUSE}: Validation of a Low-Cost, Portable {EXG} System for {ERP} Research},
  journal = {Frontiers in Neuroscience},
  volume  = {11},
  pages   = {109},
  year    = {2017},
  doi     = {10.3389/fnins.2017.00109}
}

@inproceedings{cannard2021validating,
  author    = {Cannard, Christian and Wahbeh, Helané and Delorme, Arnaud},
  title     = {Validating the Wearable {MUSE} Headset for {EXG} Spectral Analysis and Frontal Alpha Asymmetry},
  booktitle = {2021 IEEE International Conference on Bioinformatics and Biomedicine (BIBM)},
  year      = {2021},
  doi       = {10.1109/bibm52615.2021.9669778}
}

@article{coan2004frontal,
  author  = {Coan, James A. and Allen, John J. B.},
  title   = {Frontal {EXG} Asymmetry as a Moderator and Mediator of Emotion},
  journal = {Biological Psychology},
  volume  = {67},
  number  = {1--2},
  pages   = {7--50},
  year    = {2004},
  doi     = {10.1016/j.biopsycho.2004.03.002}
}

@article{casali2013theoretically,
  author  = {Casali, Adenauer G. and Gosseries, Olivia and Rosanova, Mario and Boly, Melanie and Sarasso, Simone and Casali, Karina R. and Casarotto, Silvia and Bruno, Marie-Aurélie and Laureys, Steven and Tononi, Giulio and Massimini, Marcello},
  title   = {A Theoretically Based Index of Consciousness Independent of Sensory Processing and Behavior},
  journal = {Science Translational Medicine},
  volume  = {5},
  number  = {198},
  pages   = {198ra105},
  year    = {2013},
  doi     = {10.1126/scitranslmed.3006294}
}

@article{klimesch1999EXG,
  author  = {Klimesch, Wolfgang},
  title   = {{EXG} Alpha and Theta Oscillations Reflect Cognitive and Memory Performance: A Review and Analysis},
  journal = {Brain Research Reviews},
  volume  = {29},
  number  = {2--3},
  pages   = {169--195},
  year    = {1999},
  doi     = {10.1016/s0165-0173(98)00056-3}
}

@article{donoghue2020parameterizing,
  author  = {Donoghue, Thomas and Haller, Matar and Peterson, Erik J. and Varma, Paroma and Sebastian, Priyadarshini and Gao, Richard and Noto, Torben and Lara, Antonio H. and Wallis, Jonathan D. and Knight, Robert T. and Bhatt, Parveen and Voytek, Bradley},
  title   = {Parameterizing Neural Power Spectra into Periodic and Aperiodic Components},
  journal = {Nature Neuroscience},
  volume  = {23},
  pages   = {1655--1665},
  year    = {2020},
  doi     = {10.1038/s41593-020-00744-x}
}

@article{pope1995biocybernetic,
  author  = {Pope, Alan T. and Bogart, Edward H. and Bartolome, Debbie S.},
  title   = {Biocybernetic System Evaluates Indices of Operator Engagement in Automated Task},
  journal = {Biological Psychology},
  volume  = {40},
  number  = {1--2},
  pages   = {187--195},
  year    = {1995},
  doi     = {10.1016/0301-0511(95)05116-3}
}

@article{bandt2002permutation,
  author  = {Bandt, Christoph and Pompe, Bernd},
  title   = {Permutation Entropy: A Natural Complexity Measure for Time Series},
  journal = {Physical Review Letters},
  volume  = {88},
  number  = {17},
  pages   = {174102},
  year    = {2002},
  doi     = {10.1103/PhysRevLett.88.174102}
}

@article{tononi2004information,
  author  = {Tononi, Giulio},
  title   = {An Information Integration Theory of Consciousness},
  journal = {BMC Neuroscience},
  volume  = {5},
  pages   = {42},
  year    = {2004},
  doi     = {10.1186/1471-2202-5-42}
}
```

---

## License

GPLv3
