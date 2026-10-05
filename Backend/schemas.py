from pydantic import BaseModel, Field


class HistoryTurn(BaseModel):
    user: str
    assistant: str


class ChatResponse(BaseModel):
    model: str
    response: str
    input_tokens: int
    output_tokens: int
    images_used: int