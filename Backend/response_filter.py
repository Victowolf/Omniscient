import re

_LEADING_ROLE_PREFIX = re.compile(r"^\s*(assistant|model|bot)\s*:\s*", re.IGNORECASE)
_MD_BOLD = re.compile(r"\*\*(\S(?:.*?\S)?)\*\*|__(\S(?:.*?\S)?)__")
_MD_HEADER = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_MD_BULLET = re.compile(r"^\s*[-*]\s+", re.MULTILINE)
_CODE_FENCE = re.compile(r"```[a-zA-Z0-9]*\n?|```")
_MULTI_BLANK_LINES = re.compile(r"\n{3,}")
_MULTI_SPACES = re.compile(r"[ \t]{2,}")


def clean_response(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text.strip()
    text = _LEADING_ROLE_PREFIX.sub("", text)
    text = _CODE_FENCE.sub("", text)
    text = _MD_BULLET.sub("", text)
    text = _MD_HEADER.sub("", text)
    text = _MD_BOLD.sub(lambda m: m.group(1) or m.group(2), text)
    text = _MULTI_BLANK_LINES.sub("\n\n", text)
    text = _MULTI_SPACES.sub(" ", text)

    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1]

    return text.strip()