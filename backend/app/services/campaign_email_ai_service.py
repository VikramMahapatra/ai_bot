import json
import logging
from typing import List

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

SPAM_TRIGGER_TERMS = [
    'free', 'guarantee', 'guaranteed', 'winner', 'win', 'limited time', 'act now',
    'urgent', 'click now', 'risk free', 'buy now', 'no credit check', 'cash bonus',
    'cheap', 'lowest price', 'exclusive deal', 'offer expires', 'congratulations',
    '100% free', 'instant', 'double your', 'earn money', 'selected', 'claim now',
]


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


def _score_spam_heuristic(subject: str, body: str) -> dict:
    text = f"{subject} {body}".strip().lower()
    score = 18
    reasons: List[str] = []
    suggestions: List[str] = []

    trigger_hits = [term for term in SPAM_TRIGGER_TERMS if term in text]
    if trigger_hits:
        score += min(40, len(trigger_hits) * 7)
        reasons.append(f"Trigger words detected: {', '.join(trigger_hits[:3])}")
        suggestions.append('Reduce promotional trigger language and sensational phrasing.')

    exclamations = (subject + body).count('!')
    if exclamations >= 3:
        score += min(12, exclamations * 2)
        reasons.append('Excessive exclamation usage.')
        suggestions.append('Use calmer punctuation and tone.')

    upper_words = [word for word in (subject + ' ' + body).split() if len(word) >= 4 and word.isupper()]
    if len(upper_words) >= 3:
        score += min(12, len(upper_words) * 2)
        reasons.append('Multiple all-caps words detected.')
        suggestions.append('Avoid all-caps words; keep case natural.')

    if 'unsubscribe' not in text:
        score += 8
        reasons.append('No opt-out/unsubscribe language found.')
        suggestions.append('Add a clear unsubscribe/opt-out line for compliance.')
    else:
        score -= 4

    if any(term in text for term in ['http://', 'bit.ly', 'tinyurl']):
        score += 8
        reasons.append('Potentially suspicious link patterns found.')
        suggestions.append('Use trusted HTTPS links with recognizable domains.')

    score = max(0, min(100, int(round(score))))
    risk_level = 'high' if score >= 70 else 'medium' if score >= 40 else 'low'

    if not reasons:
        reasons.append('Copy appears relatively balanced for deliverability.')
    if not suggestions:
        suggestions.append('Maintain clear value proposition and compliant footer details.')

    return {
        'spam_score': score,
        'risk_level': risk_level,
        'reasons': reasons[:3],
        'suggestions': suggestions[:3],
    }


def _build_heuristic_spam_result(subjects: List[str], bodies: List[str]) -> dict:
    combinations = []
    combo_index = 1
    score_sum = 0
    highest_score = 0
    high_risk_count = 0

    for subject_index, subject in enumerate(subjects, start=1):
        for body_index, body in enumerate(bodies, start=1):
            scored = _score_spam_heuristic(subject, body)
            if scored['risk_level'] == 'high':
                high_risk_count += 1
            score_sum += int(scored['spam_score'])
            highest_score = max(highest_score, int(scored['spam_score']))

            combinations.append(
                {
                    'combo_index': combo_index,
                    'subject_index': subject_index,
                    'body_index': body_index,
                    'spam_score': int(scored['spam_score']),
                    'risk_level': scored['risk_level'],
                    'reasons': scored['reasons'],
                    'suggestions': scored['suggestions'],
                }
            )
            combo_index += 1

    return {
        'overall': {
            'average_spam_score': round(score_sum / max(1, len(combinations)), 2),
            'highest_spam_score': highest_score,
            'high_risk_count': high_risk_count,
        },
        'combinations': combinations,
        'fallback_used': True,
    }


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


def evaluate_email_spam_score(
    campaign_name: str,
    prompt_context: str,
    subjects: List[str],
    bodies: List[str],
) -> dict:
    """Score 5x5 email subject/body combinations for spam risk."""
    cleaned_subjects = _normalize_lines(subjects, limit=5)
    cleaned_bodies = _normalize_lines(bodies, limit=5)

    if len(cleaned_subjects) < 5 or len(cleaned_bodies) < 5:
        raise ValueError('Exactly 5 subjects and 5 bodies are required for spam scoring')

    context = (prompt_context or '').strip()
    if not context:
        raise ValueError('prompt_context is required for spam scoring')

    client = OpenAI(api_key=settings.OPENAPI_KEY2)

    system_message = (
        'You are an email deliverability expert. '
        'Score spam risk for each Cartesian product combination of provided subjects and bodies. '
        'Return strict JSON only with keys: overall, combinations. '
        'overall: {average_spam_score, highest_spam_score, high_risk_count}. '
        'combinations: array of 25 objects with fields '
        'combo_index, subject_index, body_index, spam_score, risk_level, reasons, suggestions. '
        'spam_score must be integer 0-100 where higher means higher chance of landing in spam. '
        'risk_level must be one of low, medium, high. '
        'reasons and suggestions must be short arrays with 1-3 items each.'
    )

    user_message = (
        f'Campaign name: {campaign_name or "Campaign"}\n'
        f'Campaign context:\n{context}\n\n'
        f'Subject variants (1..5):\n{json.dumps(cleaned_subjects, ensure_ascii=True)}\n\n'
        f'Body variants (1..5):\n{json.dumps(cleaned_bodies, ensure_ascii=True)}\n\n'
        'Important:\n'
        '- Evaluate the 25 combinations as subject_i + body_j for all i and j in 1..5.\n'
        '- Consider subject wording, urgency language, deceptive phrasing, and body structure.\n'
        '- Keep reasons and suggestions practical and concise.'
    )

    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_CHAT_MODEL,
            temperature=0.2,
            response_format={'type': 'json_object'},
            messages=[
                {'role': 'system', 'content': system_message},
                {'role': 'user', 'content': user_message},
            ],
            timeout=max(settings.OPENAI_CHAT_TIMEOUT_SECONDS, 90),
        )

        content = (response.choices[0].message.content or '').strip()
        if not content:
            raise RuntimeError('OpenAI returned an empty spam scoring response')

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            logger.error('Failed to parse OpenAI JSON for spam scoring: %s', content)
            raise RuntimeError(f'OpenAI returned invalid spam scoring JSON: {str(exc)}')
    except Exception as exc:
        logger.warning('Spam scoring fallback used due to model error: %s', str(exc))
        return _build_heuristic_spam_result(cleaned_subjects, cleaned_bodies)

    parsed_combinations = parsed.get('combinations') or []
    if not isinstance(parsed_combinations, list) or len(parsed_combinations) != 25:
        raise RuntimeError('Spam scoring must return 25 combination results')

    normalized_results = []
    high_risk_count = 0
    score_sum = 0
    highest_score = 0

    for item in parsed_combinations:
        combo_idx = int(item.get('combo_index') or 0)
        subject_idx = int(item.get('subject_index') or 0)
        body_idx = int(item.get('body_index') or 0)

        spam_score_raw = int(item.get('spam_score') or 0)
        spam_score = max(0, min(100, spam_score_raw))

        risk_level = str(item.get('risk_level') or '').strip().lower()
        if risk_level not in {'low', 'medium', 'high'}:
            risk_level = 'high' if spam_score >= 70 else 'medium' if spam_score >= 40 else 'low'

        reasons = item.get('reasons') if isinstance(item.get('reasons'), list) else []
        suggestions = item.get('suggestions') if isinstance(item.get('suggestions'), list) else []

        if risk_level == 'high':
            high_risk_count += 1

        score_sum += spam_score
        highest_score = max(highest_score, spam_score)

        normalized_results.append(
            {
                'combo_index': combo_idx,
                'subject_index': subject_idx,
                'body_index': body_idx,
                'spam_score': spam_score,
                'risk_level': risk_level,
                'reasons': [str(entry).strip() for entry in reasons[:3] if str(entry).strip()],
                'suggestions': [str(entry).strip() for entry in suggestions[:3] if str(entry).strip()],
            }
        )

    normalized_results.sort(key=lambda item: item['combo_index'])

    average_score = round(score_sum / max(1, len(normalized_results)), 2)
    return {
        'overall': {
            'average_spam_score': average_score,
            'highest_spam_score': highest_score,
            'high_risk_count': high_risk_count,
        },
        'combinations': normalized_results,
        'fallback_used': False,
    }
