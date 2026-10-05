"""Raster (TIFF / GeoTIFF) ingestion.

Satellite and aerial imagery is frequently delivered as multi-band TIFF or
GeoTIFF files rather than ordinary RGB photos (e.g. Sentinel-2 stacks, Landsat
scenes, drone orthomosaics). The vLLM vision endpoint only understands
standard 8-bit images (PNG/JPEG), so this module renders each TIFF/GeoTIFF
into a proper viewable PNG based on however many bands are actually present
in the file, before it enters the normal image pipeline.

- 1 band            -> rendered as grayscale
- 2 bands           -> approximate 2-band composite
- 3 bands           -> treated as an RGB image directly
- 4+ bands          -> a true-color-ish composite is picked from the first
                        three bands, unless RASTER_RGB_BANDS is configured
- georeferenced?    -> CRS is detected and reported, but pixels are rendered
                        the same way either way (this is a viewer, not a
                        reprojection tool)

Every raw band is percentile-stretched to 8-bit independently so that sensors
with very different dynamic ranges (8-bit drone photos vs. 16-bit
multispectral satellite data) all produce a sane-looking image.
"""

from __future__ import annotations

import io
from typing import Optional

import numpy as np
import rasterio
from PIL import Image

from config import settings

TIFF_EXTENSIONS = (".tif", ".tiff")
TIFF_CONTENT_TYPES = (
    "image/tiff",
    "image/tif",
    "image/geotiff",
    "application/geotiff",
    "application/octet-stream",  # some clients send raw tiffs untyped
)


class RasterProcessingError(Exception):
    """Raised when a TIFF/GeoTIFF file cannot be read or rendered."""


def is_tiff(filename: Optional[str], content_type: Optional[str]) -> bool:
    """Best-effort detection of a TIFF/GeoTIFF upload by extension first,
    then content-type as a fallback (some browsers mislabel .tif uploads)."""
    name = (filename or "").lower()
    if name.endswith(TIFF_EXTENSIONS):
        return True
    ctype = (content_type or "").lower()
    return name.endswith(TIFF_EXTENSIONS) is False and ctype in (
        "image/tiff",
        "image/tif",
        "image/geotiff",
        "application/geotiff",
    )


def _percentile_stretch(band: np.ndarray, low: float, high: float) -> np.ndarray:
    """Normalize one band's raw values (any dtype/range) to 8-bit using a
    percentile stretch so both 8-bit and 16-bit sensor data render sensibly."""
    band = band.astype("float32")
    valid = np.isfinite(band)
    if not valid.any():
        return np.zeros(band.shape, dtype="uint8")

    lo, hi = np.percentile(band[valid], [low, high])
    if hi <= lo:
        hi = lo + 1.0

    stretched = np.clip((band - lo) / (hi - lo), 0.0, 1.0) * 255.0
    stretched[~valid] = 0
    return stretched.astype("uint8")


def select_band_indices(band_count: int) -> tuple[int, int, int]:
    """Pick which 1-indexed bands to render as (R, G, B) based on how many
    bands are actually present in the raster, honoring RASTER_RGB_BANDS when
    it's configured and valid for this file."""
    configured = settings.RASTER_RGB_BANDS
    if configured and len(configured) == 3 and max(configured) <= band_count:
        return (configured[0], configured[1], configured[2])

    if band_count <= 0:
        raise RasterProcessingError("Raster has no readable bands.")
    if band_count == 1:
        return (1, 1, 1)  # single band -> grayscale shown as R=G=B
    if band_count == 2:
        return (1, 2, 1)  # two bands -> approximate composite
    if band_count == 3:
        return (1, 2, 3)  # already RGB-like, use as-is
    # 4+ bands (multispectral): without knowing the sensor's exact band
    # order, the safest default is a composite from the first three bands.
    return (1, 2, 3)


def render_raster_to_png(raw_bytes: bytes, filename: str) -> tuple[bytes, dict]:
    """Reads a TIFF/GeoTIFF from raw bytes and renders a viewable 8-bit PNG.

    Returns (png_bytes, metadata). metadata describes the source raster
    (band count, which bands were used, size, and CRS if georeferenced) so
    callers can surface that context (e.g. to the model prompt).
    """
    try:
        with rasterio.MemoryFile(raw_bytes) as memfile:
            with memfile.open() as dataset:
                band_count = dataset.count
                r_idx, g_idx, b_idx = select_band_indices(band_count)

                low = settings.RASTER_STRETCH_LOW_PERCENTILE
                high = settings.RASTER_STRETCH_HIGH_PERCENTILE

                red = _percentile_stretch(dataset.read(r_idx), low, high)
                green = _percentile_stretch(dataset.read(g_idx), low, high)
                blue = _percentile_stretch(dataset.read(b_idx), low, high)

                rgb = np.dstack([red, green, blue])
                image = Image.fromarray(rgb, mode="RGB")

                buffer = io.BytesIO()
                image.save(buffer, format="PNG")

                metadata = {
                    "source_filename": filename,
                    "band_count": band_count,
                    "bands_used": [r_idx, g_idx, b_idx],
                    "width": dataset.width,
                    "height": dataset.height,
                    "crs": str(dataset.crs) if dataset.crs else None,
                    "is_georeferenced": dataset.crs is not None,
                }
                return buffer.getvalue(), metadata
    except rasterio.errors.RasterioIOError as exc:
        raise RasterProcessingError(f"Could not read '{filename}' as a TIFF/GeoTIFF: {exc}") from exc
    except RasterProcessingError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface any unexpected raster failure cleanly
        raise RasterProcessingError(f"Failed to process raster '{filename}': {exc}") from exc


def describe_raster(metadata: dict) -> str:
    """Turns the metadata from render_raster_to_png into a short human-
    readable note that can be injected into the model prompt for context."""
    band_count = metadata["band_count"]
    bands_used = metadata["bands_used"]
    geo = "a GeoTIFF (georeferenced" + (f", CRS {metadata['crs']}" if metadata["crs"] else "") + ")" \
        if metadata["is_georeferenced"] else "a TIFF (no georeferencing)"

    if band_count == 1:
        band_note = "single band, rendered as grayscale"
    elif band_count == 3:
        band_note = "3 bands, rendered directly as RGB"
    else:
        band_note = f"{band_count} bands, rendered as a composite using bands {bands_used[0]}, {bands_used[1]}, {bands_used[2]} as R, G, B"

    return (
        f"'{metadata['source_filename']}' is {geo} with {band_note} "
        f"({metadata['width']}x{metadata['height']} px)."
    )
