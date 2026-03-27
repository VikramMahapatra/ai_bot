import json
import logging
from typing import List

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)


def _normalize_lines(values: List[str], limit: int = 5) -> List[str]:
    cleaned: List[str] = []
    for raw in values or []:
        item = str(raw or '').strip()
        if not item:
            continue
        if item not in cleaned:
            cleaned.append(item)
        if len(cleaned) >= limit:
            break
    return cleaned


def generate_email_variants_from_prompt(campaign_name: str, prompt_context: str) -> dict:
    """Generate 5 subject lines and 5 body variants for an email campaign."""
    context = (prompt_context or '').strip()
    if not context:
        raise ValueError('prompt_context is required')

    client = OpenAI(api_key=settings.OPENAPI_KEY2)

    system_message = (
        'You are an expert email campaign copywriter. '
        'Generate concise, conversion-focused marketing email variants. '
        'Return strict JSON only with keys: subjects, bodies. '
        'subjects must contain exactly 5 unique subject lines. '
        'bodies must contain exactly 5 unique email bodies. '
        'Do not include markdown fences or extra keys.'
    )

    user_message = (
        f'Campaign name: {campaign_name or "Campaign"}\n'
        f'Context:\n{context}\n\n'
        'Constraints:\n'
        '- Keep subjects under 70 characters.\n'
        '- Keep each body between 90 and 220 words.\n'
        '- Use plain text, friendly professional tone.\n'
        '- Include a clear call to action in each body.\n'
        '- You may include merge tags: {{name}}, {{first_name}}, {{campaign_name}}.'
    )

    response = client.chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        temperature=0.8,
        response_format={'type': 'json_object'},
        messages=[
            {'role': 'system', 'content': system_message},
            {'role': 'user', 'content': user_message},
        ],
        timeout=settings.OPENAI_CHAT_TIMEOUT_SECONDS,
    )

    content = (response.choices[0].message.content or '').strip()
    if not content:
        raise RuntimeError('OpenAI returned an empty response')

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        logger.error('Failed to parse OpenAI JSON for email variants: %s', content)
        raise RuntimeError(f'OpenAI returned invalid JSON: {str(exc)}')

    subjects = _normalize_lines(parsed.get('subjects') or [])
    bodies = _normalize_lines(parsed.get('bodies') or [])

    if len(subjects) < 5 or len(bodies) < 5:
        raise RuntimeError('OpenAI did not return enough unique variants (need 5 subjects and 5 bodies)')

    return {
        'subjects': subjects[:5],
        'bodies': bodies[:5],
    }
