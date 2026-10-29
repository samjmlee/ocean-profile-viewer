# Ocean Profile Viewer

**A local-first 2D + 3D workspace for TOP and ITP CTD observations.** Open native profiles, inspect near-ice pauses, follow the drift track, and switch views at the selected observation time.

**[Open the browser viewer](https://samjmlee.github.io/ocean-profile-viewer/)** · [Scientific methods](docs/METHODS.md) · [Input formats](docs/FORMATS.md) · [Sources and citations](docs/SOURCES.md)

Research preview, v0.1.0. Independent community software, not an official WHOI product. The bundled demo is explicitly **synthetic**; scientific observations are not bundled or uploaded to our servers.

## Start in one minute

1. Open the browser viewer above and choose **Load synthetic demo**.
2. Switch between **2D · Profiles** and **3D · Drift & section**. Both use the same imported dataset and retain the selected time (or the nearest available profile in the 3D phase).
3. In 2D, choose **Pause only → Auto-fit observed dbar** to inspect a near-ice interval. Choose points or lines, fit x axes, or enter manual limits.
4. Load your prepared `.json` or `.json.gz` with **Open local dataset**. Multiple deployments appear in the dataset menu.

Or run entirely locally with Python 3.10+:

```sh
git clone https://github.com/samjmlee/ocean-profile-viewer.git
cd ocean-profile-viewer
python serve.py --open
```

No scientific packages or Node installation are needed just to serve the viewer. Open `http://127.0.0.1:8767/` if your browser does not open automatically. Keep the terminal running; Ctrl+C stops the server. Use `--port 8770` if the default port is occupied. Serve `web/` over HTTP(S); do not double-click its HTML files.

## Which data should I use?

**Prefer Level 3 native time-series files when available and suitable for the analysis.** For example, WHOI distributes `itp137_final_ts.nc` alongside `itp137_final_g.nc`. Native samples can be approximately 0.25 dbar apart, but are not necessarily a uniform 0.25 dbar grid. The viewer reports measured positive pressure spacing separately from processing level and product type; spacing is **not** effective resolving power.

| Product | Use in this viewer |
|---|---|
| Level 3 native (`*_final_ts.nc`) | Preferred for detailed vertical structure; retain native samples and inspect QC. |
| Level 3 gridded (`*_final_g.nc`) | Useful for consistent supplied pressure grids; no claim of native resolution. |
| Level 2 | Exploratory real-time product; do not label it final calibrated data. |
| Level 1 | Raw CTD and motor phase information; additional scientific scrutiny needed. |

Download selected deployments from the [WHOI data products page](https://www2.whoi.edu/site/itp/data/data-products/) and its [archive](https://scienceweb.whoi.edu/itp/data/). **Do not clone the whole observation archive into Git.** Keeping data outside Git avoids large repositories, changing upstream versions, and accidental redistribution of unpublished files. A local archive may be useful for a defined research campaign; record download URLs and checksums.

## Convert your observations

Create a dedicated Python environment and install converter dependencies:

```sh
python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows PowerShell, instead:
# .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Example for the [official ITP137 Level 3 native file](https://scienceweb.whoi.edu/itp/data/itpsys137/itp137_final_ts.nc), downloaded to `data/`:

```sh
python -m ocean_viewer convert data/itp137_final_ts.nc --name "ITP137 L3 native" --level L3 --product native --whoi --source-url https://scienceweb.whoi.edu/itp/data/itpsys137/itp137_final_ts.nc --qc good --start 2023-04-01 --end 2023-05-01 --output imports/itp137-april.json.gz
```

Then choose `imports/itp137-april.json.gz` in the viewer. The converter runs on your computer. Browser file selection reads the converted file in memory; it does not POST observations anywhere. Page hosting still receives ordinary requests for static assets.

Use `--start` (inclusive) and `--end` (exclusive) to split long deployments into manageable windows. Omit both for a complete file, subject to browser memory limits. `--max-profiles 20` is useful for testing and is recorded in provenance. Conversions do not overwrite the source.

For Level 1 or Level 2, use `--level L1` or `--level L2`. TOP motor timestamps separate upward, pause, and downward samples. Without reliable phase metadata, observations remain unclassified. Absolute pressure requires an explicit, scientifically justified offset, e.g. `--absolute-pressure-offset 10.1325` for the corresponding TOP14 product; **do not apply this indiscriminately**.

For unfamiliar files:

```sh
python -m ocean_viewer inspect data/your-file.nc
python -m ocean_viewer convert data/your-file.nc --name "My deployment" --level L3 --product native --mapping docs/mapping-example.json --output imports/my-data.json.gz
```

The mapping example is a template: edit variable paths and units for your file. [Standard CSV](docs/FORMATS.md) is the escape hatch for other providers and older MATLAB products. Direct `.mat`, ZIP archive, and arbitrary NetCDF schemas are **not** supported automatically. There is no hard-coded deployment ID list, but supporting an instrument ID is not the same as validating every historical file format.

## Explore and compare

- **2D:** T, Practical Salinity, T−Tf and σ₀ native profiles; separate phase overlays; previous/pinned reference; date search; temperature, salinity and T−Tf time series; custom pressure targets; automatic/manual axes; near-surface dbar fitting.
- **3D:** globe, track focus and local section; selected-phase drift curtain; pressure-bin width of 0.25 / 1 / 2 dbar; heatmap; linked profiles and time series; depth limits and vertical exaggeration.
- **Shared:** deployment, selected time, source provenance, processing level, product type, measured sampling interval and local export.

2D can overlay several phases. The top **Phase for 3D** menu selects one phase for the 3D curtain; phases are never averaged together. Pressure (dbar) in 2D differs from TEOS-10 depth (m) in 3D. A 0.25 dbar display grid does not invent 0.25 dbar information from coarser data: empty bins remain empty. For 1–2 dbar source grids, choose an appropriate display bin width.

## Reproducibility and limitations

- Each converted file records source filename, SHA-256, supplied URL, conversion version, selected variables, pressure offset, GPS association, QC policy, sample counts and GSW version.
- Recognized WHOI Level 3 profile flags default to `--qc good` (flag 1). `--qc not-bad` retains other flags except 4; `--qc all` retains every flag. Missing QC is explicitly **unverified**, not a pass. See [methods](docs/METHODS.md).
- No added conductivity offset is fitted. Level 3 provider-adjusted salinity is used where available. Derivatives are recalculated with GSW, not shifted to make negative T−Tf disappear.
- Keep deployment metadata and review the selected temperature field before interpreting small T−Tf differences. The default L3 temperature is `temp_cor`; `temp_adj` is a different, conductivity-cell-aligned field and can be explicitly mapped.
- Browser import limits: 256 MiB compressed/input, 512 MiB expanded JSON, 100,000 profiles. 3D projection is capped at five million pressure cells. Split windows or use larger display bins. Rendering may decimate the mesh; native 2D arrays remain intact.
- This is a CTD viewer, not a complete engineering/oxygen/current processor, bathymetry model, hydrodynamic simulation, or replacement for provider QC.
- Conversion of stored NaNs leaves gaps, but filtering invalid native samples can remove information about internal sample-time gaps. Native line segments are visual connections; use points for strict sample inspection. 3D color limits are per dataset and variable, not a common cross-deployment normalization.

## Development and checks

```sh
python -m unittest discover -s tests -v
python tests/generate_demo.py
python serve.py
# another terminal, Node 20+:
npm install
npx playwright install chromium
npm test
```

`BROWSER_PATH` optionally selects an installed browser; `VIEWER_URL` overrides the test URL. `TEST_IMPORT` adds a local real-data import to the browser test. The repository includes only generated fixtures and synthetic observations; private/raw datasets are ignored. GitHub Actions runs converter and browser tests and publishes only `web/` to Pages after tests pass.

## Attribution and license

Code and synthetic demo: [MIT](LICENSE). Three.js retains its own MIT notice. Natural Earth geography is public domain. **The software license does not relicense observational data.** Cite the original dataset and specific product in research, retain its metadata, and follow the provider's acknowledgment instructions. See [SOURCES.md](docs/SOURCES.md) and [CITATION.cff](CITATION.cff).

For a format request, include variable names, dimensions, units, processing level, a public source URL, and a small redistributable fixture. Do not post unpublished field data or credentials in issues.

### White 3D workspace and XYZ coordinates

In **3D · Drift & section**, choose **Globe**, **Track focus**, or **XYZ coordinates**. The white-background XYZ view shows X east / Y north in km relative to the mean track location, and Z depth in meters positive downward. This is a local equirectangular approximation (increasing distortion near the pole / across wide tracks), with the vertical exaggeration explicitly shown. It is not bathymetry.

**Place names** toggles selected major ocean, sea, basin, continent and island labels. Use **Geographic labels** to isolate basins or other categories. Click a label for its category and source. These are approximate cartographic anchors, not geographic boundaries or reverse-geocoded observation locations. No Google Earth API, imagery, key or account is required. Names reference [Natural Earth](https://www.naturalearthdata.com/downloads/10m-physical-vectors/) and [USGS undersea feature documentation](https://pubs.usgs.gov/of/2014/1040/data/undersea_features.html); anchors are manually placed for readability.

### Select dates from the loaded data

The **Observation date range · UTC** controls show the full file coverage and the number of selected profiles. Set **From** / **Through**, then **Apply dates**; both days are inclusive UTC calendar days. The same selection drives 2D profiles, time series and 3D. **Full available range** restores every profile in the loaded file. A date range cannot recover observations omitted when a file was converted. Invalid or empty selections keep the previous view and show an explanation. Export still exports the full imported dataset.

Initial 3D display bins follow reported pressure spacing (0.25, 1 or 2 dbar); you can change them. Larger datasets may need wider display bins or a shorter date selection. The 3D view also draws sampled observation points, so gaps that prevent curtain triangles do not hide the entire dataset. Up to 1,200 profile positions and 180 valid depth bins per displayed profile are sampled for this point layer; all imported observations remain available in 2D.

TOP6 validation used the complete locally available Level 2 file, **2022-09-27 to 2024-05-11**, with 12,728 profiles and 1,040,385 retained samples (~1 dbar spacing). This Level 2 layout does not identify phases: it is correctly shown as unclassified. A separate native Level 1 file for **2023-04-01 through 2023-04-07** retains 84 yo-yo profiles and 266,845 samples with motor-time phase segmentation. Full native Level 1 conversion exceeded this workstation's memory; use explicit date chunks for large native files, rather than silently truncating profiles. These local observation files are not committed.
