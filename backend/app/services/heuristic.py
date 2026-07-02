from typing import Literal

from app.config import JACCARD_HIGH, JACCARD_LOW
from app.schemas import Message, Tag

# 中英常见停用词最小集
_STOPWORDS: set[str] = {
    # 中文
    "的", "是", "了", "和", "与", "并", "就", "也", "在", "对", "从", "把", "被",
    "我", "你", "他", "她", "它", "我们", "你们", "他们", "这", "那", "这个", "那个",
    "但", "而", "或", "如果", "因为", "所以", "一个", "一种", "可以", "需要", "进行",
    # 英文
    "a", "an", "the", "and", "or", "but", "of", "to", "for", "in", "on", "at",
    "is", "are", "was", "were", "be", "been", "being", "this", "that", "these",
    "those", "it", "as", "by", "with", "from", "we", "you", "they", "i", "he", "she",
}


def _is_cjk(ch: str) -> bool:
    if not ch:
        return False
    cp = ord(ch)
    # 常见中日韩统一表意文字范围
    return (
        0x4E00 <= cp <= 0x9FFF
        or 0x3400 <= cp <= 0x4DBF
        or 0xF900 <= cp <= 0xFAFF
    )


def _tokenize(text: str) -> set[str]:
    """简单分词：英文按空格切分；中文用 1-2 字滑窗。保留长度 >= 2 且不在停用词表中的 token。"""
    tokens: set[str] = set()
    if not text:
        return tokens

    # 1) 英文/数字 token：按非字母数字切分
    buf: list[str] = []
    cjk_chars: list[str] = []

    def flush_ascii() -> None:
        if buf:
            word = "".join(buf).lower()
            if len(word) >= 2 and word not in _STOPWORDS:
                tokens.add(word)
            buf.clear()

    def flush_cjk() -> None:
        # 中文：1-gram（长度>=2 才保留实际不会触发，因为 1-gram 长度=1）+ 2-gram
        # 这里仅生成 2-gram，保证 token 长度>=2
        if len(cjk_chars) >= 2:
            for i in range(len(cjk_chars) - 1):
                bigram = cjk_chars[i] + cjk_chars[i + 1]
                if bigram not in _STOPWORDS:
                    tokens.add(bigram)
        cjk_chars.clear()

    for ch in text:
        if _is_cjk(ch):
            flush_ascii()
            cjk_chars.append(ch)
        elif ch.isalnum():
            flush_cjk()
            buf.append(ch)
        else:
            flush_ascii()
            flush_cjk()

    flush_ascii()
    flush_cjk()

    return tokens


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def analyze(messages: list[Message], topic: str) -> list[Tag]:
    if not messages:
        return []

    n = len(messages)
    keywords: list[set[str]] = [_tokenize(m.content) for m in messages]

    # 单条消息：直接 neutral
    if n == 1:
        return [
            Tag(
                id=messages[0].id,
                label="neutral",
                score=0.0,
                evidence="仅一条发言，默认为中立",
            )
        ]

    # 两两 Jaccard
    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            s = _jaccard(keywords[i], keywords[j])
            sim[i][j] = s
            sim[j][i] = s

    tags: list[Tag] = []
    for i in range(n):
        avg = sum(sim[i][j] for j in range(n) if j != i) / (n - 1)
        score = round(avg, 3)
        if avg >= JACCARD_HIGH:
            label: Literal["consensus", "divergence", "neutral"] = "consensus"
            evidence = f"与其他 {n - 1} 条发言关键词重合度 {score}"
        elif avg <= JACCARD_LOW:
            label = "divergence"
            evidence = "与其他发言显著分歧"
        else:
            label = "neutral"
            evidence = f"与其他 {n - 1} 条发言关键词重合度 {score}，处于中立区间"

        tags.append(
            Tag(
                id=messages[i].id,
                label=label,
                score=score,
                evidence=evidence,
            )
        )

    return tags
