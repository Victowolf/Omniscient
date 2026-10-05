from typing import List, Optional
import httpx

from config import settings


class VLLMClientError(Exception):
    pass


async def query_vllm(
    prompt: str,
    system_prompt: str,
    images: List[tuple[str, bytes, str]],
    audio: Optional[tuple[str, bytes, str]],
    max_output_tokens: int,
    temperature: float,
    top_p: float,
    top_k: int,
    do_sample: bool,
) -> dict:
    data = {
        "prompt": prompt,
        "system_prompt": system_prompt,
        "max_output_tokens": str(max_output_tokens),
        "temperature": str(temperature),
        "top_p": str(top_p),
        "top_k": str(top_k),
        "do_sample": str(do_sample).lower(),
    }

    files = [("images", (filename, content, content_type)) for filename, content, content_type in images]

    if audio is not None:
        filename, content, content_type = audio
        files.append(("audio", (filename, content, content_type)))

    try:
        async with httpx.AsyncClient(timeout=settings.VLLM_TIMEOUT_SECONDS) as client:
            resp = await client.post(settings.VLLM_API_URL, data=data, files=files or None)
    except httpx.ConnectError as exc:
        raise VLLMClientError(f"Could not reach the model server at {settings.VLLM_API_URL}.") from exc
    except httpx.TimeoutException as exc:
        raise VLLMClientError("The model server took too long to respond.") from exc

    if resp.status_code >= 400:
        raise VLLMClientError(f"Model server error ({resp.status_code}): {resp.text}")

    try:
        return resp.json()
    except ValueError as exc:
        raise VLLMClientError("Model server returned a non-JSON response.") from exc
