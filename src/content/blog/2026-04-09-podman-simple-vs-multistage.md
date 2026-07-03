---
title: "Podman Container Builds: Simple vs Multi-Stage"
date: 2026-04-09
last_modified_at: 2026-07-03
description: "A practical comparison of simple and multi-stage Podman builds, backed by a small Python image benchmark."
topic: "Infrastructure & Automation"
keywords:
  - "Podman"
  - "containers"
  - "multi-stage builds"
  - "container images"
  - "Python"
  - "DevOps"
urlSlug: "podman-simple-vs-multistage-end"
---

Multi-stage builds are often presented as the correct way to build production container images.

That is too simplistic.

A one-stage build can be perfectly reasonable. It is shorter, easier to understand, and often enough for a small application.

A multi-stage build becomes useful when the build needs files or tools that the running container does not.

To make the difference concrete, I built the same small Python API both ways with Podman.

Both images used the same Python base and the same production dependencies: FastAPI, Uvicorn, NumPy, Pandas, SQLAlchemy, and psycopg.

> The complete test project is available here: [download the Podman Python benchmark](/assets/podman-python-benchmark.tar.gz).

## Simple one-stage build

```dockerfile
FROM docker.io/library/python:3.13.5-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements-prod.txt .
COPY vendor /tmp/vendor

RUN pip install \
        --no-cache-dir \
        --no-index \
        --find-links=/tmp/vendor \
        -r requirements-prod.txt \
    && rm -rf /tmp/vendor

COPY app.py .

USER 65532:65532
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app:app", \
     "--host", "0.0.0.0", "--port", "8000"]
```

This is already a reasonable production image.

It installs only production dependencies, keeps dependency installation cacheable when `app.py` changes, and runs as a non-root user.

It is also easy to read. Everything happens in one stage.

For many small services, this may be enough.

But there is one subtle problem:

```dockerfile
COPY vendor /tmp/vendor
```

That instruction creates an image layer containing the local wheelhouse.

The later `rm -rf /tmp/vendor` removes it from the visible container filesystem, but not from the earlier image layer. The final image still carries those bytes.

## Multi-stage build

```dockerfile
FROM docker.io/library/python:3.13.5-slim-bookworm AS builder

COPY requirements-prod.txt /build/requirements-prod.txt
COPY vendor /build/vendor

RUN pip install \
        --no-cache-dir \
        --no-index \
        --find-links=/build/vendor \
        --prefix=/install \
        -r /build/requirements-prod.txt


FROM docker.io/library/python:3.13.5-slim-bookworm AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=builder /install /usr/local
COPY app.py .

USER 65532:65532
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app:app", \
     "--host", "0.0.0.0", "--port", "8000"]
```

The builder stage receives the wheelhouse and installs the packages into `/install`.

The runtime stage receives only:

- The installed production packages
- The application code
- The Python runtime from the base image

The wheelhouse remains in the builder and never becomes part of the final runtime image.

That is the main value of a multi-stage build: it creates a clear boundary between **what is needed to build** and **what is needed to run**.

## Benchmark result

Each number below is the mean of three builds. The source-only rebuild changed `app.py` without changing the dependency files.

| Build | Cold build | Source-only rebuild | Local image | Compressed archive |
|---|---:|---:|---:|---:|
| One-stage | 91.7 s | 58.7 s | 363.6 MiB | 147.6 MiB |
| Multi-stage | 127.2 s | 72.6 s | 312.5 MiB | 97.2 MiB |

The one-stage image built faster in this test. The multi-stage build had more filesystem work to do because it created a builder stage and copied the installed Python environment into the runtime stage.

The multi-stage image was:

- **35.5 seconds slower on a cold build**
- **13.9 seconds slower on a source-only rebuild**
- **51.1 MiB smaller locally**
- **50.4 MiB smaller when compressed**
- **14.1% smaller as a local image**
- **34.2% smaller as a compressed archive**

Both images contained the same 22 Python distributions and returned the same API results.

These timings came from a constrained Podman runner using the VFS storage driver, so the absolute seconds should not be treated as universal. The useful result is the trade-off: the one-stage build was faster, while the multi-stage build produced a substantially smaller runtime image.

The size difference did not come from removing application dependencies. It came mainly from keeping the wheelhouse and other build-only material out of the runtime image history.

## Why deleting files is not enough

Container images are stacks of layers.

```dockerfile
COPY large-file.tar /tmp/large-file.tar
RUN process-it && rm /tmp/large-file.tar
```

The running container no longer sees `large-file.tar`, but the image still contains the layer that added it.

A multi-stage build avoids that:

```dockerfile
FROM base AS builder
COPY large-file.tar /tmp/large-file.tar
RUN process-it

FROM base AS runtime
COPY --from=builder /processed-output /app/output
```

Only the processed output enters the runtime image.

This matters for local wheelhouses, compilers, development headers, source archives, frontend build tools, and other files that are useful during a build but unnecessary at runtime.

## Which one should you use?

Use a simple one-stage build when:

- The application is small
- Build and runtime requirements are nearly identical
- There are no large build-only files
- Faster and simpler builds matter more than the smallest possible image
- The resulting image size is acceptable
- The shorter Containerfile is easier for the team to maintain

Use a multi-stage build when:

- Compilers or development headers are required
- Wheels, source archives, or frontend assets are build inputs only
- Tests and development tools must not reach production
- The build produces a small set of runtime artifacts
- A smaller runtime image is worth some additional build work
- Image transfer size matters

The more different the build environment is from the runtime environment, the more useful multi-stage construction becomes.

## A few practical rules

Whichever approach you choose:

- Copy dependency files before frequently changing source code
- Install only production dependencies in the runtime image
- Run as a non-root user
- Use `.containerignore` to exclude `.git`, virtual environments, caches, and generated archives
- Inspect the result instead of assuming it is small

Useful commands:

```bash
podman build -f Containerfile.optimized -t python-api-one-stage .
podman build -f Containerfile.multistage -t python-api-multistage .

podman images
podman history --human python-api-one-stage
podman history --human python-api-multistage
```

A multi-stage build does not automatically make the application faster or secure. It only gives you a cleaner way to control what reaches the runtime image.

## My take

The one-stage image was not wrong.

It was already cache-aware, used only production dependencies, and ran as a non-root user.

The multi-stage image created a cleaner runtime boundary for one specific reason: the wheelhouse was needed to build the environment, but it was not needed to run the application.

That boundary was not free. In this benchmark, the one-stage image built faster: **91.7 seconds versus 127.2 seconds** from cold, and **58.7 seconds versus 72.6 seconds** after a source-only change.

In exchange, the multi-stage build reduced the final image from **363.6 MiB to 312.5 MiB** and the compressed archive from **147.6 MiB to 97.2 MiB**.

So the rule is not:

> Always use multi-stage builds.

A better rule is:

> If the build needs material that the running container does not, keep it in a separate stage.

Simple is good.

A clean runtime boundary is better when you actually need one.
