---
layout: post
title: "Bringing Pixi to Nextflow: A Practical Alternative to Conda"
date: 2025-05-10
categories: ["Bioinformatics & Scientific Tools"]
---

Reproducible environments are one of the most important parts of any bioinformatics workflow. If two people cannot recreate the same software environment, they may not get the same results.

For years, Conda has been the default environment manager for many Nextflow pipelines. It works well, but it also has some common pain points:

- Slow dependency resolution
- Large environment specifications
- Long environment creation times
- Inconsistent behavior when environments are rebuilt

Pixi is a newer alternative developed by prefix.dev. It uses the same package ecosystem as Conda, including conda-forge and Bioconda, but uses a Rust-based dependency resolver that is significantly faster in many cases.

Pixi stores project configuration in a simple `pixi.toml` file and records exact dependency versions in `pixi.lock`, making environments easier to reproduce and review.

At the time of writing, Nextflow does not provide a native `pixi` directive like it does for Conda, Docker, Apptainer, or Wave. However, Pixi can still be integrated into Nextflow with only a few lines of configuration.

This guide shows one approach for using Pixi inside Nextflow processes.

---

## Why Consider Pixi?

Some advantages of Pixi include:

- Faster dependency resolution
- Lockfile-based reproducibility
- Simple TOML configuration
- Built-in task management
- Multi-platform support
- Uses existing conda-forge and Bioconda packages

For developers who already use Pixi outside of Nextflow, reusing the same environment definition across projects can simplify maintenance.

---

## A Minimal Example

### Step 1: Create `pixi.toml`

```toml
[project]
name = "test-pixi-env"

channels = ["conda-forge", "bioconda"]
platforms = ["linux-64"]

[dependencies]
samtools = "*"
```

### Step 2: Create `main.nf`

```nextflow
process check_pixi_tool {

    label 'pixi'

    output:
    path 'version.txt'

    script:
    """
    samtools --version > version.txt
    """
}

workflow {
    check_pixi_tool()
}
```

### Step 3: Configure Nextflow

```groovy
params.pixi_env = './pixi.toml'

process {

    withLabel: 'pixi' {

        beforeScript = '''
        [ -d .pixi ] && [ -f pixi.lock ] || pixi install
        eval "$(pixi shell-hook)"
        '''
    }
}
```

Before each process starts:

1. Check whether a Pixi environment already exists.
2. Create it if necessary.
3. Activate the environment.
4. Execute the process script.

---

## AWS Batch Considerations

### Pixi Must Already Exist

Nextflow will not install Pixi automatically.

Example:

```Dockerfile
FROM ubuntu:22.04

RUN curl -fsSL https://pixi.sh/install.sh | bash

ENV PATH="/root/.pixi/bin:${PATH}"

WORKDIR /workspace
```

### Make Sure `pixi.toml` Is Available

The environment definition must be accessible from the job container.

Common approaches include:

- Baking `pixi.toml` into the image
- Shipping it with the pipeline repository
- Downloading it during job startup

### Be Careful With Working Directories

Nextflow executes processes from temporary work directories rather than the project root.

Always verify where `pixi.toml` exists at runtime.

---

## Caveats

### Environment Creation Still Costs Time

Pixi solves dependencies faster than Conda, but packages still need to be downloaded and installed.

For workflows with many short-lived tasks, repeatedly creating environments can become expensive.

### Containers Are Still Better for Production

For large-scale production workflows, containers are usually the better choice because:

- Startup is faster
- Software versions are fixed
- Environment creation is eliminated
- Cloud execution is more predictable

Pixi is often best used during development, testing, and smaller shared projects.

---

## Recommended Usage

| Scenario | Recommendation |
|-----------|---------------|
| Local development | Pixi |
| Rapid prototyping | Pixi |
| Shared research projects | Pixi + lockfile |
| Production workflows | Containers |
| AWS Batch at scale | Containers with Pixi pre-installed if required |
