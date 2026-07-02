from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    id: str
    modelName: str
    content: str


class AnalyzeRequest(BaseModel):
    topic: str = ""
    messages: list[Message] = Field(default_factory=list)


class Tag(BaseModel):
    id: str
    label: Literal["consensus", "divergence", "neutral"]
    score: float
    evidence: str


class AnalyzeResponse(BaseModel):
    tags: list[Tag]


class AnalyzerMessage(BaseModel):
    """流式分析中的单条消息。model 用于后端按 model 名匹配 PRISM_ANALYZER_API_KEYS 中的 endpoint + Key。
    不接受前端传入的 endpoint，避免 SSRF 与 Key 泄漏（C1 修复）。
    """
    id: str
    modelName: str
    model: str = ""        # 模型标识，后端据此从 PRISM_ANALYZER_API_KEYS 查 endpoint+Key
    content: str


class StreamAnalyzeRequest(BaseModel):
    topic: str = ""
    currentMessage: AnalyzerMessage
    priorMessages: list[AnalyzerMessage] = Field(default_factory=list)
