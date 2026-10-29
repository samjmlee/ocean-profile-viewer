# Contributing

Use a small public or synthetic fixture to reproduce issues. Include the file format, variable dimensions/units, processing level, browser version and failing step. Avoid uploading unpublished observations or identifying field notes.

Keep scientific transformations explicit: preserve provenance, units, nulls, flags and the distinction between native samples and display bins. Do not silently transpose ambiguous arrays, infer near-ice pause from pressure alone, treat sample spacing as resolving power, or apply an instrument calibration to unrelated deployments.

Run Python unit tests and the browser test in the README. New source adapters need a dimension/unit/QC test and documented limitations. The browser must continue to work from static hosting without a data-upload API. Large datasets, virtual environments and local imports do not belong in commits.
