# syntax=docker/dockerfile:1
# Artisan Murals print service (Cloudflare Container): libvips makes exact-size print files from huge originals.
FROM python:3.12-slim
# An optional build secret "ca" lets this build run behind a proxy with its own certificate; it is not kept in the image.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export PIP_CERT=/run/secrets/ca; fi; \
    pip install --no-cache-dir pyvips-binary==8.18.7 pyvips==3.2.0
WORKDIR /app
COPY server.py .
ENV PORT=8080 VIPS_CONCURRENCY=2 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "server.py"]
