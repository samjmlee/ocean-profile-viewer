# Import contract

Open prepared `ocean-profile-viewer/1` JSON or gzip JSON in the browser. Raw NetCDF and CSV are converted locally with `python -m ocean_viewer convert`. There is no server upload endpoint.

## CSV

Required columns, one sample per row:

```csv
profile_id,time_utc,latitude,longitude,pressure_dbar,temperature_c,salinity_pss78,phase
1,2024-01-01T00:00:00Z,80,-140,1.00,-1.60,30.00,up
1,2024-01-01T00:00:00Z,80,-140,1.25,-1.59,30.01,up
2,2024-01-01T06:00:00Z,80.01,-140.01,1.00,-1.58,30.02,unknown
```

Each profile ID must have one profile timestamp and position. `phase` is optional and defaults to `unknown`; accepted values are `up`, `pause`, `down`, `unknown`. Dates should include `Z` or an explicit offset; timezone-free ISO values are treated as UTC. Blank scientific values become missing. CSV expects **sea pressure dbar, in-situ ITS-90 °C and Practical Salinity**, not depth, Absolute Salinity or potential temperature.

## NetCDF mapping

Run `inspect` first. Map canonical keys to absolute or group-relative variable paths, for example `temperature: ctd/temp_adj`. Supported keys: pressure, temperature, salinity, conductivity, time (profile-level), latitude, longitude, sample_time, start, pause_start, pause_stop, stop. Optional `profile_axis` is 0 or 1; optional unit overrides are pressure_units, temperature_units, salinity_units, conductivity_units. Overrides are user assertions, not automatic unit inference.

The example mapping is not universal. A 1D pressure vector is treated as a shared vertical coordinate; temperature/salinity normally have one sample and one profile dimension. Ragged-array and MATLAB layouts need a provider adapter or CSV export. `_FillValue`/missing values and NetCDF scaling are handled by netCDF4-python. DO, engineering channels and raw counts are not converted into CTD quantities.

## Viewer JSON

The synthetic demo is a complete reference instance. Root fields are `schema`, `name`, `level`, `product`, `sampling`, `synthetic`, `gapMs`, `provenance` and ordered `records`. Each record has `id`, UTC milliseconds `t`, `lat`, `lon`, four nullable motor `bounds`, `phaseValid`, and four `segments` keyed by up/pause/down/unknown. Every segment has aligned pressure `p`, depth `z`, and `raw = [temperature, SP, TminusTf, sigma0]` arrays. Pressure must be sorted nondecreasing. Empty segments use empty arrays, not fabricated samples. Null derived values remain missing.

The browser validates structure, ordering, positions, finite/null values and import size before rendering. Keep provenance with every file you share. The JSON exporter retains the data contract; it does not export a corrected or interpolated dataset.
