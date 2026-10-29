# Scientific methods

## Native observations

The converter accepts NetCDF3/4 through netCDF4-python and explicit tabular CSV. Recognized variable paths and dimension names are used first. An axis is inferred by size only when exactly one candidate matches the profile count; ambiguous square arrays fail rather than being silently transposed.

CF Gregorian time coordinates become UTC epoch milliseconds. Non-Gregorian calendars are rejected. Profiles without valid time and position are counted and excluded. For raw files without profile coordinates, nearest surface GPS within `--gps-max-hours` (default 6 h) is used, without interpolation. This is surface/platform location, not a measured underwater trajectory. Longitude 0–360 is normalized to −180–180. Review the GPS tolerance for the deployment.

Only finite P/T/SP samples passing broad physical limits are retained: pressure 0–12000 dbar, temperature −5–45°C, SP 0–50. These are sanity checks, not sensor validation. Provider fill values are masked. No temporal or vertical decimation is applied during native export. Numeric arrays are rounded to six decimals.

## Level 3 and QC

For the WHOI final native layout, default fields are filtered pressure `press_filt`, corrected thermistor temperature `temp_cor`, and final calibrated salinity `salinity_adj`. `temp_adj` is conductivity-cell temperature; it is not silently substituted. Field mappings are recorded. When using `temp_adj`, the salinity QC flag also reflects its processing parameters. The converter's conservative joint P/T/SP/GPS profile policy still checks all available recognized flags.

The [WHOI 2026 QC document](https://www2.whoi.edu/site/itp/wp-content/uploads/sites/92/2026/04/ITPprogram_level3_QualityControl.pdf) defines profile-level flags. The default includes only flag 1 for all available recognized fields. `not-bad` excludes flag 4 and can retain questionable, unchecked or estimated positions. `all` does not filter by flag. Individual flags survive in exported records. If a source provides no recognized flags, the converter states that QC is unavailable; it cannot certify the file as good merely because `--qc good` was selected.

## Phases

Motor boundaries define upward `[start,pause_start)`, pause `[pause_start,pause_stop)`, and downward `[pause_stop,stop]`. They must be finite and ordered. Samples outside these intervals remain unclassified. If reliable WHOI `profile_dir` metadata defines 1=up and −1=down, the supplied direction classifies the record instead. A stationary direction code is **not** assumed to mean a near-ice pause. With neither source of phase information, use unclassified. CSV phase labels are explicit user assertions and must be reviewed separately.

The parent workspace selects a single 3D phase. 2D can overlay phases separately. Missing observations at a requested pressure remain absent. A pause near the surface often does not contain any data at default targets such as 5 or 10 dbar.

## Thermodynamics

Where Practical Salinity is not supplied, conductivity is converted to mS/cm and passed to `gsw.SP_from_C(C,t,p)`. Absolute Salinity is `SA_from_SP(SP,p,lon,lat)`; Conservative Temperature is `CT_from_t(SA,t,p)`; displayed T−Tf is `t - t_freezing(SA,p,0)` (air saturation fraction zero); potential density anomaly is `sigma0(SA,CT)`; depth is `-z_from_p(p,latitude)`. T is in-situ temperature, SP follows PSS-78, σ₀ is not in-situ density. No extra calibration is inferred. Negative T−Tf is retained.

## Sampling versus display

Reported native Δp is the median of per-profile/phase median positive sorted-pressure differences, excluding zero/near-zero increments. It is a descriptive spacing statistic, not vertical resolving power. Native Level 3 time series are not forced to a regular 0.25 dbar grid.

2D uses native samples and separate per-phase medians within ±0.125 dbar for pressure-target time series; the target must lie inside that phase's observed range. 3D forms medians in common pressure bins of the chosen width and uses median TEOS-10 depths in each bin. No empty bins are filled. Sparse source grids can therefore yield a sparse curtain at a finer requested display spacing. Each phase's positive time-step median sets a 1.75× connection threshold. Binning and the bounded mesh/overview are for viewing, not a newly calibrated product.

The historical curtain connects neighboring observations in time; it is not a snapshot of a full 3D ocean volume. Surface track, selected profile, local planar approximation and vertical exaggeration are display constructs. No seabed, ice draft or current vectors are inferred. Independent datasets retain independent color ranges; compare numeric legends.
