from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    VLLM_API_URL: str
    VLLM_TIMEOUT_SECONDS: int = 120

    MAX_IMAGES_PER_REQUEST: int = 4
    MAX_IMAGE_SIZE_MB: int = 15
    MAX_HISTORY_TURNS_IN_PROMPT: int = 12

    GENERATION_MAX_OUTPUT_TOKENS: int = 512
    GENERATION_TEMPERATURE: float = 0.4
    GENERATION_TOP_P: float = 0.95
    GENERATION_TOP_K: int = 64
    GENERATION_DO_SAMPLE: bool = True

    # --- Raster (TIFF / GeoTIFF) ingestion ---
    # 1-indexed band numbers to render as (R, G, B). Leave empty to let the
    # pipeline auto-select bands based on how many bands are actually present
    # in each file (see raster_processor.select_band_indices).
    RASTER_RGB_BANDS: list[int] = []
    # Percentile stretch applied per band when converting raw DN/reflectance
    # values into an 8-bit viewable image.
    RASTER_STRETCH_LOW_PERCENTILE: float = 2.0
    RASTER_STRETCH_HIGH_PERCENTILE: float = 98.0

    ALLOWED_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
