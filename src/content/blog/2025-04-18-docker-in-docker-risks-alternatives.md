---
title: "Understanding Docker-in-Docker: Power, Risks, and Safer Alternatives"
date: 2025-04-18
last_modified_at: 2026-07-03
description: "How Docker-in-Docker and Docker socket binding work, how an ordinary CI job can become a host breach, and how to design safer container build pipelines."
topic: "Infrastructure & Automation"
keywords:
  - "Docker"
  - "Docker-in-Docker"
  - "containers"
  - "CI/CD"
  - "container security"
  - "BuildKit"
  - "Podman"
urlSlug: "dind"
---

Docker-in-Docker is common in CI because it solves an obvious problem: the job needs Docker, but the job is already running inside a container.

It works. The problem is that it often gives the build much more access than people realise.

A container with access to the host Docker socket is not truly isolated from the host. It may be able to start privileged containers, mount the host filesystem, read credentials, or interfere with other jobs.

So the real question is not whether Docker-in-Docker works.

It does.

The question is what happens when the code running inside that job is malicious, compromised, or simply wrong.

---

## Two Different Patterns Are Commonly Called DinD

The term **Docker-in-Docker**, or **DinD**, is often used for two related but technically different designs.

### Pattern 1: Run Docker Inside the Container

A container starts its own Docker daemon:

```bash
docker run --privileged docker:dind
```

The inner daemon manages its own images, containers, networks, and storage.

This is true Docker-in-Docker.

It usually requires privileged mode because the inner daemon needs access to kernel features that normal containers do not receive.

### Pattern 2: Mount the Host Docker Socket

Instead of starting another daemon, the job container connects to the Docker daemon already running on the host:

```bash
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  docker
```

The Docker CLI is inside the container, but the daemon is outside it.

This is often called Docker socket binding or Docker-outside-of-Docker. It is still commonly grouped under the DinD name because the job can run familiar commands such as `docker build` and `docker run`.

The difference matters.

With true DinD, the job controls a separate inner daemon.

With socket binding, the job controls the host daemon.

---

## Why Teams Use It

Many CI pipelines need to build, test, and publish container images.

A typical job may:

1. Check out the source code.
2. Build an image.
3. Start it for integration tests.
4. Push it to a registry.

DinD and socket binding make this easy:

```bash
docker build -t registry.example.com/myapp:$CI_COMMIT_SHA .
docker run --rm registry.example.com/myapp:$CI_COMMIT_SHA ./run-tests
docker push registry.example.com/myapp:$CI_COMMIT_SHA
```

Socket binding is especially attractive because it can reuse the host's image cache, registry login, networking, and already-running daemon.

That is also the problem.

The job is not receiving a small, private build service. It is sharing a powerful host service.

---

## The Core Security Problem

Docker is normally controlled through this Unix socket:

```text
/var/run/docker.sock
```

That socket is an administrative interface to the Docker daemon.

A process with access to a rootful Docker daemon can usually ask it to:

- Start containers as root
- Mount host directories
- Add Linux capabilities
- Use host networking
- Attach host devices
- Read or modify Docker volumes
- Stop other containers

The daemon performs the privileged action, but the caller decides what action to perform.

For that reason, access to a rootful Docker socket should be treated as root-equivalent access to the Docker host.

Running the CI job as a non-root user does not change much once that user can instruct a root daemon.

---

## How a Normal CI Job Becomes a Host Breach

The realistic threat begins with a normal CI feature: automatically executing repository-controlled code.

Consider a company with this setup:

- It uses a self-hosted CI runner.
- The runner is reused across jobs.
- Build containers receive `/var/run/docker.sock`.
- Pull requests automatically run tests.
- Release jobs later use the same runner pool.
- The runner can reach the internal registry and network.

Nothing here looks especially unusual.

### Step 1: Untrusted Code Reaches CI

An attacker opens a pull request that appears to update a dependency.

The change also modifies code that CI runs automatically:

```bash
npm install
npm test
```

The same problem can come from:

- A compromised package
- A malicious CI action
- A modified base image
- A compromised developer account
- Code from an untrusted fork

The attacker does not need to break Docker.

The pipeline has already arranged for their code to run inside a job with access to the Docker socket.

### Step 2: The Job Mounts the Host

The malicious process asks the host daemon to start another container:

```bash
docker run --rm \
  -v /:/host \
  alpine
```

The new container is created by the host daemon, not by the restricted process inside the original job.

The original build container may be non-root, read-only, and stripped of capabilities. Those restrictions apply only to that container.

They do not stop the host daemon from starting a different container with the host filesystem mounted.

At that point, the job has crossed from controlling its own build environment to controlling the runner host.

### Step 3: Credentials and Build Material Are Exposed

The attacker can now search the runner for things such as:

- CI runner configuration
- Registry credentials
- Cached repositories
- Cloud configuration files
- Deployment scripts
- SSH keys
- API tokens
- Docker volumes
- Files left by previous jobs

The runner may also be able to reach internal services that are not exposed to the public internet.

The pull-request job itself may have received very few secrets. The compromised host can expose a much larger trust domain.

### Step 4: A Later Job Brings Better Secrets

The most valuable credentials may not be present during the first attack.

The attacker can modify the runner or a shared build component and wait.

Later, a trusted release job runs on the same machine and receives:

- A registry push token
- A signing key
- A production deployment credential
- A cloud role
- A repository token with write access

A compromised runner can capture those credentials when they appear.

Cleaning environment variables after each job is not enough. The machine itself can no longer be trusted.

### Step 5: The Breach Spreads

The attacker may now be able to:

- Read other private repositories
- Push a modified image
- Tamper with future builds
- Replace build artifacts
- Reach internal services
- Steal cloud credentials
- Change deployment inputs

A small convenience in the CI configuration has become a path from one pull request to the runner host and possibly to production.

No Docker zero-day was required.

Docker did exactly what it was designed to do.

The security failure was architectural:

> Untrusted code was given access to an administrative host interface.

---

## The Less Dramatic Failure: Breaking Other Jobs

Not every incident is malicious.

A cleanup command intended for a disposable build environment may run against the shared host daemon:

```bash
docker system prune -a --volumes
```

The engineer may think this cleans only the current job.

Instead, it can remove cached images, volumes, networks, or containers used by other pipelines.

Another example is:

```bash
docker rm -f $(docker ps -aq)
```

On a shared daemon, that can stop unrelated workloads.

A shared daemon creates a shared failure domain, even when nobody is attacking it.

---

## What About True Docker-in-Docker?

True DinD avoids sharing the host Docker daemon directly.

The inner daemon has its own images, containers, networks, and build cache.

That is better separation than socket binding.

The problem is that the usual setup looks like this:

```bash
docker run --privileged docker:dind
```

Privileged mode weakens many of the isolation controls that containers normally rely on.

If untrusted code compromises the inner daemon or abuses the privileged environment, the outer host may still be exposed.

So true DinD is not automatically safe. Its risk depends on the worker, the runtime, mounted paths, device access, and whether the whole environment is disposable.

A privileged DinD job on a long-lived shared runner is still a dangerous design.

---

## Operational Problems

DinD also creates problems that have nothing to do with attackers.

### Storage Gets Messy

The outer runtime stores the DinD container, while the inner daemon stores another set of image layers and container data.

Disk usage can grow quickly, and it may not be obvious which layer is consuming the space.

### Debugging Gets Harder

When a build fails, the problem may be in:

- The runner host
- The outer container runtime
- The DinD service
- The inner Docker daemon
- The build container
- The registry

Each extra layer makes failure analysis slower.

### Shared Cleanup Becomes Dangerous

Socket binding makes images, volumes, caches, and containers part of a shared host environment.

A cleanup command from one job can damage another.

That may be acceptable on a disposable single-job runner. It is much harder to justify on a long-lived shared machine.

---

## Podman Helps, but It Does Not Fix the Architecture

Podman is daemonless for normal local use and has strong rootless support.

That can reduce the impact of a compromise because container operations run under an unprivileged host user rather than a central root daemon.

But Podman can also expose an API socket.

A job with access to that socket may control the user's containers, images, volumes, mounted files, and build credentials.

Rootless operation narrows the blast radius. It does not make the socket harmless.

It also does not protect files and secrets that belong to the same CI account.

Podman is useful, but the real security boundary still comes from isolated workers, restricted credentials, and not reusing a compromised host.

---

## What to Do Instead

There is no single command that makes every container build pipeline safe.

The design matters more than the tool.

### Use Disposable Workers

Create the worker for one job and destroy it afterward.

Do not try to clean and reuse a machine that may have executed untrusted code.

Destroying the whole worker is simpler and more reliable than proving that every trace of a compromise has been removed.

### Separate Pull Requests From Releases

Untrusted pull-request jobs should not share a host with trusted jobs that receive registry, signing, cloud, or deployment credentials.

Use separate runner pools and separate trust boundaries.

A useful rule is:

> The machine that tests an untrusted pull request should never later receive production secrets.

### Avoid General-Purpose Runtime Sockets

Do not mount a rootful Docker or Podman socket into arbitrary build jobs.

Use a builder that exposes only the functions required to build an image, and isolate it from the runner host.

### Prefer Rootless or Isolated Builders

Rootless BuildKit, Podman, and Buildah can reduce host privilege.

A dedicated remote builder can also separate image construction from the CI runner.

These are not magic solutions, but they are easier to secure than handing every job control of a rootful host daemon.

### Use Short-Lived Credentials

CI jobs should receive temporary, narrowly scoped credentials.

Avoid long-lived keys stored on runner disks.

A build job should get only what it needs, for only as long as it needs it.

---

## Better Options

### Rootless BuildKit

BuildKit is purpose-built for image construction and supports:

- Efficient caching
- Secret mounts
- Remote cache
- OCI image output
- Rootless operation
- Dedicated remote builders

A strong setup runs BuildKit on an isolated, disposable worker, avoids the host Docker socket, and uses short-lived registry credentials.

### Dedicated Remote Builders

A remote builder separates image construction from the CI host.

The CI job submits a build instead of receiving general control over the runner runtime.

The builder is still sensitive infrastructure, but the boundary is narrower and easier to reason about.

### Podman and Buildah

Podman and Buildah work well when rootless operation is practical and the workflow does not require full Docker daemon compatibility.

They are safest when each job receives its own isolated user or disposable worker and no shared API socket is mounted.

### Managed Build Services

Managed builders can remove much of the operational burden.

They may cost more and introduce platform coupling, but they also avoid running privileged builder infrastructure on long-lived CI hosts.

### Kaniko

Kaniko was widely used for daemonless image builds in Kubernetes.

However, the original `GoogleContainerTools/kaniko` repository was archived on June 3, 2025.

Existing deployments may continue to use pinned versions, but Kaniko should not be presented as the default actively maintained choice without evaluating a maintained successor or fork.

---

## When DinD May Still Be Acceptable

DinD is not automatically forbidden.

It can be reasonable when:

- The worker exists for one job only.
- The worker is destroyed immediately afterward.
- The job runs trusted code.
- No other project shares the machine.
- Credentials are short-lived and narrowly scoped.
- Network access is restricted.
- Privileged mode is an explicit, reviewed trade-off.

The dangerous combination is not simply “Docker inside a container.”

It is:

- Untrusted code
- Administrative runtime access
- Long-lived hosts
- Shared workers
- Valuable credentials
- Broad internal network access

Remove enough of those conditions, and the risk becomes much easier to manage.
