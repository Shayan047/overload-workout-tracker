FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so code changes don't invalidate this layer.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

# Don't run as root.
RUN useradd --create-home --uid 10001 appuser
USER appuser

# Hosts say which port to listen on through $PORT (Render does); locally it's 8000.
# Every start applies pending migrations and refreshes the exercise library (both no-ops
# when nothing changed), since Render's free plan has no pre-deploy step. The server
# doesn't start if either fails. Behind Render's proxy, trust its forwarded headers.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && exec uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --proxy-headers --forwarded-allow-ips='*'"]
