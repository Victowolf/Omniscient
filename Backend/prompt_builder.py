from typing import List, Optional
from schemas import HistoryTurn
from config import settings


def build_prompt(
    current_prompt: str,
    history: List[HistoryTurn],
    num_images_this_turn: int,
    raster_notes: Optional[List[str]] = None,
) -> str:
    trimmed = history[-settings.MAX_HISTORY_TURNS_IN_PROMPT:]

    lines: list[str] = []
    if trimmed:
        lines.append("Conversation so far (for context only, do not repeat it back):")
        for turn in trimmed:
            lines.append(f"User: {turn.user.strip()}")
            lines.append(f"Assistant: {turn.assistant.strip()}")
        lines.append("")

    if num_images_this_turn > 0:
        lines.append(f"[{num_images_this_turn} image(s) are attached to this message for analysis.]")
    elif trimmed:
        lines.append("[No new image attached to this message — use the earlier conversation context above.]")

    if raster_notes:
        lines.append("[Some attached images were rendered from source TIFF/GeoTIFF rasters:]")
        for note in raster_notes:
            lines.append(f"- {note}")

    lines.append(f"User: {current_prompt.strip()}")
    lines.append("Assistant:")
    return "\n".join(lines)
