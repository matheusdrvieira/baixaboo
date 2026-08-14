FROM node:24-trixie-slim AS node-runtime

FROM python:3.12-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends aria2 ca-certificates chromium ffmpeg tini xvfb \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 baixaboo \
    && useradd --system --uid 1000 --gid baixaboo --home-dir /app baixaboo \
    && install --directory --owner=baixaboo --group=baixaboo /app

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

COPY --chown=baixaboo:baixaboo core/requirements.txt ./requirements.txt
RUN pip install --requirement requirements.txt

COPY --chown=baixaboo:baixaboo core/src ./src

EXPOSE 8010

USER baixaboo

ENTRYPOINT ["tini", "--"]

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp -ac >/tmp/xvfb.log 2>&1 & exec env DISPLAY=:99 uvicorn src.main:app --host 0.0.0.0 --port 8010 --no-access-log --no-proxy-headers"]
