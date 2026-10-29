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
