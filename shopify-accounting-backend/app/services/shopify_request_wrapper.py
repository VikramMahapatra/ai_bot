import asyncio

async def shopify_request(func, *args, **kwargs):
    response, headers = await func(*args, **kwargs)

    call_limit = headers.get("X-Shopify-Shop-Api-Call-Limit")
    if call_limit:
        used, total = map(int, call_limit.split("/"))
        if used / total > 0.8:
            await asyncio.sleep(1)

    return response, headers
