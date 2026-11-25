"""Actual OpenAI Responses API integration; there are no prediction fallbacks."""
import json

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.config import settings


def rate_limit_detail(response: httpx.Response) -> str:
    """Classify stable error codes without exposing the upstream message or body."""
    fallback = "The AI provider is at its rate or quota limit. Please retry later."
    try:
        body = response.json()
    except ValueError:
        return fallback
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return fallback
    code = error.get("code")
    messages = {
        "credit_balance_exhausted": "OpenAI API credits are exhausted. Add credits in API billing, then retry.",
        "insufficient_quota": "OpenAI API credits are exhausted. Add credits in API billing, then retry.",
        "project_spend_limit_exceeded": "The OpenAI project spend limit has been reached. Ask your project administrator to increase it, or wait for the monthly limit to reset.",
        "organization_spend_limit_exceeded": "The OpenAI organization spend limit has been reached. Ask your organization administrator to increase it, or wait for the monthly limit to reset.",
        "organization_usage_limit_exceeded": "The OpenAI organization API usage limit has been reached. Request a higher approved usage limit or contact your organization administrator.",
        "rate_limit_exceeded": "OpenAI is temporarily rate limited. Wait briefly, then retry.",
        "slow_down": "OpenAI request traffic increased too quickly. Wait briefly, then retry.",
    }
    if isinstance(code, str) and code in messages:
        return messages[code]
    # Older quota responses may supply only a type. A specific, unrecognized
    # code remains generic rather than being misidentified as depleted credits.
    if code is None and error.get("type") == "insufficient_quota":
        return messages["insufficient_quota"]
    return fallback


async def structured_response(schema: type[BaseModel], instructions: str, content: list[dict]) -> BaseModel:
    config = settings()
    if not config.openai_api_key:
        raise HTTPException(503, "Food AI is not configured. Set OPENAI_API_KEY on the FastAPI service.")
    payload = {
        "model": config.openai_model,
        "store": False,
        "instructions": instructions,
        "input": [{"role": "user", "content": content}],
        "text": {"format": {"type": "json_schema", "name": schema.__name__, "strict": True, "schema": schema.model_json_schema()}},
        "max_output_tokens": 6500,
    }
    try:
        async with httpx.AsyncClient(timeout=config.provider_timeout_seconds) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {config.openai_api_key}"},
                json=payload,
            )
        if response.status_code == 429:
            raise HTTPException(503, rate_limit_detail(response))
        if response.status_code in (401, 403):
            raise HTTPException(503, "The configured AI credentials or model access were rejected. Contact your administrator.")
        if response.status_code >= 400:
            raise HTTPException(502, "The AI provider could not process this request. Check model configuration or try another photograph.")
        result = response.json()
        if result.get("status") != "completed":
            raise HTTPException(502, "The AI response was incomplete. Please try a clearer image or a shorter request.")
        chunks = [part for output in result.get("output", []) if output.get("type") == "message" for part in output.get("content", [])]
        if any(chunk.get("type") == "refusal" for chunk in chunks):
            raise HTTPException(422, "The AI could not analyze this content. Upload a clear food photograph.")
        output_text = "".join(chunk.get("text", "") for chunk in chunks if chunk.get("type") == "output_text")
        return schema.model_validate_json(output_text)
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(504, "The AI analysis timed out. Try again in a moment.") from None
    except httpx.HTTPError:
        raise HTTPException(502, "The AI provider is temporarily unreachable.") from None
    except (ValidationError, json.JSONDecodeError, TypeError, KeyError, AttributeError):
        raise HTTPException(502, "The AI returned invalid food data. No meal was saved. Please retry or enter your meal manually.") from None
