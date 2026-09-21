# INSUREIT insurer and vehicle-manufacturer logo catalog

**Prepared:** 2026-09-21

## Scope

This catalog is intended to provide canonical insurer and vehicle-manufacturer visual assets for:

- Web portal
- Customer mobile app
- Partner mobile app

The supplied source package contains **32 insurer logos** and **56 vehicle/manufacturer logos**. Source images are PNG, 512×512.

## Canonical repository locations

Web:
- `apps/web-portal/public/assets/insurers/`
- `apps/web-portal/public/assets/vehicle-brands/`

Customer app:
- `apps/mobile-app/assets/catalog/insurers/`
- `apps/mobile-app/assets/catalog/vehicle-brands/`

Partner app:
- `apps/partner-app/assets/catalog/insurers/`
- `apps/partner-app/assets/catalog/vehicle-brands/`

## Existing curated web assets

Do not blindly replace existing web assets when a curated file is already present.

Existing insurer assets to preserve:
- `bajaj-allianz.png`
- `hdfc-ergo.png`
- `icici-lombard.png`
- `iffco-tokio.png`
- `new-india-assurance.png`
- `oriental-insurance.png`
- `tata-aig.png`

Existing vehicle-brand SVG assets currently include:
- Ashok Leyland
- Honda
- Hyundai
- Kia
- Mahindra
- Maruti Suzuki
- Tata
- Toyota

Prefer the existing scalable SVG on web when it already represents the same manufacturer accurately.

## Naming convention

New asset filenames must use lowercase kebab-case only.

Examples:
- `aditya-birla-sun-life.png`
- `care-health.png`
- `icici-lombard.png`
- `john-deere.png`
- `bharatbenz.png`
- `mercedes-benz.png`

Do not commit source-download noise such as:
- spaces
- `(1)`
- `removebg-preview`
- stock-site suffixes
- inconsistent capitalization

## Import helper

Use:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/import-brand-assets.ps1 -PreparedCatalogZip "<path-to-INSUREIT_logo_catalog_repo_ready.zip>"
```

The importer:
- expands the prepared catalog,
- copies images into the three application asset locations,
- preserves the curated overlapping web insurer files,
- writes the catalog manifest to `docs/logo-catalog.json`,
- performs a basic asset-count validation,
- makes no database changes and performs no deployment.

## Integration boundary

Adding the catalog must not change:
- insurer master values,
- vehicle manufacturer/master values,
- OCR parser routing,
- policy or vehicle database records,
- business logic,
- permissions,
- schema or migrations.

UI wiring should map existing canonical business values to these visual assets. Missing mappings must fall back gracefully to the existing text/icon presentation.

## Evidence state

Branch preparation and import tooling are implementation-only. Asset presence, app wiring, CI, merge, deployment and installed-device verification must each be recorded separately.
