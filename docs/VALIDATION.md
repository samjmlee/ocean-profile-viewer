# Validation for v0.1.0

Local checks completed on 2026-10-29. These are adapter and software checks, not a certification of the source observations.

## Automated fixtures

Seven Python tests cover motor-boundary membership, missing/reversed timing, timezone offsets, unit conversion from S/m to mS/cm with independent GSW expectations, Level 3 QC selection, supplied direction, native spacing, transposed arrays, explicit absolute-pressure conversion, ambiguous axes and CSV unclassified fallback.

Browser integration checks cover synthetic local import, malformed-file rejection, 2D native near-surface fitting, retained selected time across 2D/3D, a non-empty synthetic 3D mesh, phase selection, and mobile width. The optional real-file path was also exercised with ITP137 Level 3 native data. CI repeats the portable fixture and browser checks without downloading scientific observations.

## Real-file spot checks (not committed)

| File family | Check |
|---|---|
| TOP6 raw NetCDF | 20 profiles in April 2023; motor-timed up/pause/down/unclassified; 63,475 retained samples. |
| TOP14 raw NetCDF | Three profiles with explicit 10.1325 dbar absolute-pressure subtraction. |
| TOP5 legacy Level 2 | Uppercase variables and legacy array orientation. |
| ITP137 Level 2 | Profile-first orientation, supplied Practical Salinity. |
| ITP137 `final_ts` | 20 profiles passing recognized QC; corrected T, final adjusted SP, filtered P and provider direction; 56,186 retained samples. Median descriptive positive pressure spacing approximately 0.265 dbar for this subset. |
| ITP137 `final_g` | 20 profiles passing recognized QC; `data/P,T,S` layout and associated profile flags. |

No claim is made that every historical TOP/ITP format has been tested. Native MATLAB, ragged layouts, unseen flag conventions and different variable meanings need an explicit adapter or reviewed CSV export. The finite-range filter and flags must be evaluated for each scientific question.

2026-10-29: White 3D scene, XYZ physical-unit axes, clickable geographic sources and label visibility were browser-tested. Existing ITP137 Level 3 native subset (20 profiles, 56,186 samples) loaded locally; upward phase displayed 10 profiles to 760.93 m with 270 curtain triangles at 0.25 dbar display bins. Real observations remain excluded from the public repository.

2026-10-29 date controls: inclusive same-day UTC range, invalid range rejection, shared 2D/3D range and full-range reset passed browser tests. TOP6 Level 2 full coverage (12,728 profiles, 2022-09-27–2024-05-11) rendered 78,208 sampled 3D points at 1 dbar bins; a selected April 1–7, 2023 interval contained 168 profiles. TOP6 Level 1 April 1–7 contained 84 profiles and rendered 13,500 upward curtain triangles to 196.03 m. Full native L1 conversion was stopped after memory exhaustion; no full-native validation is claimed.
