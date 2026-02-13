import asyncio
import sys

# Psycopg async on Windows requires Selector event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.main import app  # noqa: E402

