# Data sources, acknowledgment and citation

## Observations

TOP and ITP observations are collected and distributed by the **Woods Hole Oceanographic Institution Ice-Tethered Profiler Program** and collaborators. Credit the original investigators and field programs, not this viewer, as the source of observations.

- [Official data products, access and acknowledgment instructions](https://www2.whoi.edu/site/itp/data/data-products/).
- [Official data archive](https://scienceweb.whoi.edu/itp/data/).
- Toole, J. M., Krishfield, R. A., O'Brien, J. K., Houk, A., Cole, S. T., and WHOI ITP Program (2016). *Ice-Tethered Profiler observations: Vertical profiles of temperature, salinity, oxygen, and ocean velocity from an Ice-Tethered buoy system.* NOAA National Centers for Environmental Information. [Dataset DOI: 10.7289/v5mw2f7x](https://doi.org/10.7289/v5mw2f7x). Include the date you accessed the actual data.
- Krishfield et al. (2008), *Automated Ice-Tethered Profilers for seawater observations under pack ice in all seasons*, Journal of Atmospheric and Oceanic Technology, 25, 2091–2105.
- Toole et al. (2011), *The Ice-Tethered Profiler: Argo of the Arctic*, Oceanography, 24(3), 126–135. [DOI: 10.5670/oceanog.2011.64](https://doi.org/10.5670/oceanog.2011.64).
- [WHOI Level III QC definitions, April 2026](https://www2.whoi.edu/site/itp/wp-content/uploads/sites/92/2026/04/ITPprogram_level3_QualityControl.pdf).

Follow the official acknowledgment wording linked above in publications. Save the deployment's metadata and processing report with your analysis. A shared archive DOI does not distinguish L1/L2/L3, native/gridded, or later revisions: report the actual filename, product, download date and checksum too.

An ITP137 native Level 3 NetCDF and its gridded counterpart were retrieved from the official archive on 2026-10-29 for local adapter checks. Those files are **not committed** to this repository. All committed demonstration observations are synthetic.

## Calculations and visual assets

- [TEOS-10 / Gibbs SeaWater toolbox](https://www.teos-10.org/): seawater conversions, freezing temperature, potential density anomaly and pressure-to-depth. [GSW Python](https://github.com/TEOS-10/GSW-Python) is installed separately; retain its license when redistributing binaries.
- [Three.js](https://threejs.org/), version 0.160.1, MIT. Vendored code and original notice: `web/views/3d/vendor/THREE-LICENSE.txt`.
- [Natural Earth](https://www.naturalearthdata.com/), 1:110m land outlines. [Public-domain terms](https://www.naturalearthdata.com/about/terms-of-use/). Derived land geometry is in `web/views/3d/land.js`.

The prior workstation explorer included pre-fetched ERA5 air temperature. That observation-specific weather cache is **not redistributed** here, and this public viewer makes no weather API requests or automatic coordinate transmissions. The weather panel is omitted.

## Software

The original 2D/3D viewers and this integration are maintained by `samjmlee`. Cite this repository, the software version/commit and the original observation source separately. `CITATION.cff` describes software only. The MIT license applies to our software and synthetic demo, not to upstream observational data.
