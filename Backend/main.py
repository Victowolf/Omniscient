import json
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from config import settings
from prompts import EO_VQA_SYSTEM_PROMPT, EO_TIME_SERIES_SYSTEM_PROMPT
from schemas import ChatResponse, HistoryTurn
from vllm_client import VLLMClientError, query_vllm
from prompt_builder import build_prompt
from response_filter import clean_response
from raster_processor import RasterProcessingError, describe_raster, is_tiff, render_raster_to_png

app = FastAPI(title="EO-VQA Chatbot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


def _parse_history(history: Optional[str]) -> list[HistoryTurn]:
    if not history or not history.strip():
        return []
    try:
        raw = json.loads(history)
        return [HistoryTurn(**turn) for turn in raw]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"`history` is not valid JSON: {exc}") from exc


async def _load_image_payloads(
    real_images: List[UploadFile],
) -> tuple[list[tuple[str, bytes, str]], list[str]]:
    """Reads every uploaded image, enforces the size limit, and runs any
    TIFF/GeoTIFF through the raster pipeline so it comes out the other end as
    a normal PNG the vision model can consume. Plain photos (JPEG/PNG/etc.)
    pass through untouched.

    Returns (image_payloads, raster_notes) where raster_notes are short
    human-readable descriptions of any rasters that were rendered, to be
    surfaced to the model as extra context.
    """
    image_payloads: list[tuple[str, bytes, str]] = []
    raster_notes: list[str] = []
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024

    for img in real_images:
        content = await img.read()
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=422,
                detail=f"Image '{img.filename}' exceeds {settings.MAX_IMAGE_SIZE_MB}MB.",
            )

        if is_tiff(img.filename, img.content_type):
            try:
                png_bytes, metadata = render_raster_to_png(content, img.filename or "upload.tif")
            except RasterProcessingError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            image_payloads.append((img.filename or "raster.png", png_bytes, "image/png"))
            raster_notes.append(describe_raster(metadata))
        else:
            image_payloads.append((img.filename, content, img.content_type or "image/jpeg"))

    return image_payloads, raster_notes


async def _run_chat(
    prompt: str,
    history: Optional[str],
    images: List[UploadFile],
    system_prompt: str,
    min_images: int = 0,
) -> ChatResponse:
    if not prompt or not prompt.strip():
        raise HTTPException(status_code=422, detail="`prompt` cannot be empty.")

    real_images = [img for img in images if img is not None and img.filename]
    if min_images and len(real_images) < min_images:
        raise HTTPException(
            status_code=422,
            detail=f"This endpoint requires at least {min_images} dated images.",
        )
    if len(real_images) > settings.MAX_IMAGES_PER_REQUEST:
        raise HTTPException(
            status_code=422,
            detail=f"Too many images: got {len(real_images)}, max is {settings.MAX_IMAGES_PER_REQUEST}.",
        )

    parsed_history = _parse_history(history)
    image_payloads, raster_notes = await _load_image_payloads(real_images)

    final_prompt = build_prompt(prompt, parsed_history, len(image_payloads), raster_notes)

    try:
        raw_result = await query_vllm(
            prompt=final_prompt,
            system_prompt=system_prompt,
            images=image_payloads,
            audio=None,
            max_output_tokens=settings.GENERATION_MAX_OUTPUT_TOKENS,
            temperature=settings.GENERATION_TEMPERATURE,
            top_p=settings.GENERATION_TOP_P,
            top_k=settings.GENERATION_TOP_K,
            do_sample=settings.GENERATION_DO_SAMPLE,
        )
    except VLLMClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    cleaned_text = clean_response(raw_result.get("response", ""))
    if not cleaned_text:
        raise HTTPException(status_code=502, detail="Model returned an empty response.")

    return ChatResponse(
        model=raw_result.get("model", "vllm"),
        response=cleaned_text,
        input_tokens=int(raw_result.get("input_tokens", 0)),
        output_tokens=int(raw_result.get("output_tokens", 0)),
        images_used=len(image_payloads),
    )


@app.post("/api/chat/vqa", response_model=ChatResponse)
async def chat_vqa(
    prompt: str = Form(...),
    history: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
):
    return await _run_chat(
        prompt=prompt,
        history=history,
        images=images,
        system_prompt=EO_VQA_SYSTEM_PROMPT,
        min_images=0,
    )


@app.post("/api/chat/timeseries", response_model=ChatResponse)
async def chat_timeseries(
    prompt: str = Form(...),
    history: Optional[str] = Form(None),
    images: List[UploadFile] = File(default=[]),
):
    return await _run_chat(
        prompt=prompt,
        history=history,
        images=images,
        system_prompt=EO_TIME_SERIES_SYSTEM_PROMPT,
        min_images=2,
    )
