---
title: "Building a Windows VM I Can Debug"
date: 2026-10-13
description: "Notes from automating Windows setup: boot prompts, early drivers, large uploads, and returning to the desktop for debugging."
topic: "Systems & Reliability"
keywords:
  - "Windows"
  - "QEMU"
  - "PowerShell"
  - "unattended installation"
urlSlug: "building-a-windows-vm-i-can-debug"
pinned: false
---

I wanted a Windows VM that I could rebuild without clicking through the installer each time. I also wanted to open the desktop when something went wrong.

## The base image and the workload

A base image holds Windows and common tools. A separate script runs the workload.

Changing the workload does not need another Windows installation. Changing a system dependency may need a new base image.

The ISO, firmware, drivers, and answer file need to fit the guest architecture. I kept that separate from the application work.

## The answer file needs to match the ISO

`Autounattend.xml` provides answers to Windows Setup. Its values need to fit the ISO being used.

Language is easy to overlook. The setup UI language and installed Windows UI language need to be supported by the media. The keyboard layout and regional formats are separate choices.

For example, this fragment selects a setup UI language for media that supports English (United States):

```xml
<SetupUILanguage>
  <UILanguage>en-US</UILanguage>
</SetupUILanguage>
```

This goes in `Microsoft-Windows-International-Core-WinPE`, under `windowsPE`.

These settings have different meanings:

| Setting | Purpose |
| --- | --- |
| `SetupUILanguage/UILanguage` | Language shown during Setup |
| `UILanguage` | Windows UI language |
| `SystemLocale` | Language setting for non-Unicode programs |
| `UserLocale` | Date, number, and currency formats |
| `InputLocale` | Input language and keyboard layout |

Check the UI language against the ISO. Choose the keyboard layout and regional formats separately.

Check the edition too. Image indexes vary between ISOs. The product-key setting must fit the chosen edition; completing Setup does not mean Windows is activated.

A quick syntax check for the generated XML:

```python
from pathlib import Path
from xml.etree import ElementTree

answer_file = Path("demo-media/Autounattend.xml")
ElementTree.parse(answer_file)
print("The answer file is valid XML.")
```

This checks XML syntax. Windows settings and media access still need checking in the guest.

For the removable-media method, the answer file goes at the root of the attached media.

## The boot key kept reaching Setup

An answer file only helps after Windows Setup starts. It cannot handle a firmware prompt asking for a keypress before booting the installer.

QEMU's human monitor can send a key:

```text
sendkey spc
```

The key presses must stop before they reach Windows Setup. They are sent to the VM, not just to the boot prompt.

I ran into this when sending Space for too long. After the boot prompt disappeared, the remaining presses reached Setup. They appeared to trigger a close/cancel action and leave it waiting at a confirmation dialog. The installation looked stuck, but it was waiting for input.

The helper needs a short burst that ends before Setup takes over. If it misses the boot prompt, check when the prompt appears before making the burst longer.

The monitor socket can be ready before the boot prompt appears. Those are separate waits. A fixed delay still depends on the host, so I cannot treat one duration as a general fix.

When Setup looks stuck, the display is worth checking for a confirmation dialog. The answer file may not be the problem.

The EFI shell adds another detail: a filesystem mapping such as `fs0:` is not a permanent name for the installation media. A boot helper should find the expected files instead of relying on one mapping.

After installation, the boot order needs to allow Windows to start from its installed disk. A visible VM window is useful while getting this part working. It shows whether the firmware, boot media, or installer is waiting.

## The network driver was needed earlier

The virtual devices chosen in QEMU affect which drivers Windows needs.

The guest needed NetKVM for its VirtIO network device. Installing it in a later script left the early setup steps without networking, including the connection used to send logs to the host. I moved the driver into the installation media.

Windows Setup supports a `$WinPEDriver$` folder on accessible installation media. Setup can find drivers there and add them to the installed system.

This small Python example copies a driver package into that folder:

```python
from pathlib import Path
from shutil import copytree

source = Path("demo-inputs/network-driver")
target = Path("demo-media") / "$WinPEDriver$" / "network"

if not any(source.rglob("*.inf")):
    raise RuntimeError("No driver INF found in the demo package")

# Use a fresh destination for this example.
copytree(source, target)
```

Use the full driver package for the guest, including its catalog and binary files.

This mechanism runs through Windows Setup. It does not make a driver available to an earlier operation that happens before Setup starts.

## The media did not have a fixed drive letter

I stopped assuming the setup media would always be on the same drive letter. A marker file is one way to find the intended volume:

Here, the media contains `demo-volume.tag` and `prepare-demo.ps1`:

```powershell
$matches = @(
    Get-PSDrive -PSProvider FileSystem | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.Root 'demo-volume.tag')
    }
)

if ($matches.Count -ne 1) {
    throw "Expected one demo volume; found $($matches.Count)"
}

$script = Join-Path $matches[0].Root 'prepare-demo.ps1'
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) {
    throw 'The demo setup script is missing'
}

& $script
```

The first-login command starts the discovery code. Keeping the setup work in a script file avoids a long PowerShell command inside XML, with two sets of quoting rules to deal with.

## The useful output was inside Windows

Provisioning could be running while the host terminal showed little useful output. Sending progress over TCP made it easier to follow the run. I kept the guest log too, so a broken connection would not remove the record of the failure.

A short message can test a TCP log connection. This example assumes a line-based listener is already running on the host:

```powershell
$client = [System.Net.Sockets.TcpClient]::new()
try {
    $pending = $client.ConnectAsync('10.0.2.2', 9081)
    if (-not $pending.Wait(3000)) {
        throw 'The demo log listener did not respond'
    }

    $client.SendTimeout = 3000
    $bytes = [Text.Encoding]::UTF8.GetBytes("demo step started`n")
    $client.GetStream().Write($bytes, 0, $bytes.Length)
} finally {
    $client.Dispose()
}
```

The address assumes QEMU's default user-mode network. The port is arbitrary. Inside the guest, `localhost` means the guest itself, not the host.

This sends one message. The log client also needs reconnect handling. Useful messages name the current step, the failed program, and the saved log.

## Large uploads need a streaming receiver

Small setup files can travel with the installation media. Larger inputs and outputs can use a separate network service.

For example, Windows PowerShell 5.1 can send a file to an HTTP endpoint that accepts PUT:

```powershell
$request = @{
    Uri             = 'http://10.0.2.2:9082/demo-output/sample.zip'
    Method          = 'Put'
    InFile          = 'C:\Demo\sample.zip'
    ContentType     = 'application/octet-stream'
    TimeoutSec      = 600
    UseBasicParsing = $true
    ErrorAction     = 'Stop'
}

Invoke-RestMethod @request
```

The host needs an endpoint that accepts PUT uploads.

The upload server needs to handle files larger than its available memory. Reading the entire request body at once can work for a small file and fail on a large archive.

For a raw PUT upload, read a fixed-size block, write it, and repeat until the declared length is reached:

```python
import os
import tempfile
from pathlib import Path


def save_upload(body, size, destination):
    # destination is chosen by the server, not taken directly from a URL.
    destination = Path(destination)
    if size < 0:
        raise ValueError("Invalid upload length")

    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=destination.parent, prefix=".incoming-", delete=False
        ) as output:
            temporary = Path(output.name)
            remaining = size
            while remaining:
                block = body.read(min(remaining, 256 * 1024))
                if not block:
                    raise EOFError(f"Upload ended {remaining} bytes early")
                output.write(block)
                remaining -= len(block)

        if temporary.stat().st_size != size:
            raise IOError("Saved file size does not match")
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
```

The HTTP handler supplies the body stream, a checked `Content-Length`, and a destination in an existing directory. It must reject transfer encodings it cannot read.

Memory use stays small. Each upload gets a temporary file in the destination directory. After the file is closed and checked, `os.replace` publishes it under the final name, replacing any existing file there.

The handler should return success only after saving succeeds. A timeout, full disk, or early disconnect must produce a failed upload. A size check catches missing bytes; comparing a checksum also checks the content.

### Multipart is not a raw file

A raw PUT body contains the file bytes. A `multipart/form-data` body also contains boundaries and part headers.

A large multipart request cannot be handled by switching to a raw-body writer. That would save the wrapper along with the file. Use a streaming multipart parser, or require raw PUT for this endpoint.

Reading a file in blocks is also different from HTTP chunked transfer encoding. The example above uses `Content-Length`; it does not decode a chunked HTTP body.

### Timeouts and retries

Both ends need enough time for a large upload. A socket I/O timeout and a total request deadline are different limits. Progress logs every few seconds help show whether bytes are still arriving.

Retries should have a limit. If the server saves the file but the response is lost, the client may send it again. Decide whether that retry replaces the same output or creates another one. After the last failed attempt, fail the upload step.

The useful checks are a normal upload, an interrupted upload, and a file close to the expected maximum size. A connection test alone is not enough.

## A second disk for working files

A second virtual disk can hold archives, extracted files, and build output. That keeps the working data separate from the Windows disk.

Create a working disk:

```bash
qemu-img create -f qcow2 demo-work.qcow2 32G
```

One possible attachment uses VirtIO block storage:

```bash
-drive file=demo-work.qcow2,format=qcow2,if=none,id=demo_work \
-device virtio-blk-pci,drive=demo_work,serial=DEMO-WORK
```

These are arguments to add to a suitable QEMU command. This device choice requires the appropriate VirtIO storage driver in Windows; it is separate from the network driver.

Check what Windows sees before initializing a disk:

```powershell
Get-Disk | Select-Object Number, SerialNumber, PartitionStyle, `
    Size, IsBoot, IsSystem
```

The setup script needs to identify the working disk rather than assume it is disk `1`.

A separate disk gives me the option to retain data while rebuilding the OS disk. It only helps if the next run attaches that disk again and does not format it. Sometimes a fresh working disk is what I want; sometimes keeping the failed run's files is more useful.

## Keeping a way back to the desktop

I kept autologon after provisioning and included the display driver. Both support the same thing: opening the VM later to inspect a failed run.

Autologon lets later boots reach the desktop without another sign-in. The display driver makes that session usable. This is about desktop access; it does not establish GPU acceleration for the application.

A dedicated account keeps the login separate from personal credentials. Registry-based autologon stores a password in the image. Sysinternals Autologon stores it as an LSA secret instead, but either approach still needs care when sharing the image.

A graphical launch can include:

```bash
-display default
```

The guest also needs a compatible virtual display device and driver. The display option alone does not provide those.

The important part is reopening the same OS and working disks used by the failed run. That keeps the logs, extracted files, and build output available for inspection.

This starts a new VM process with saved disks. It does not attach a window to an already-running headless VM. Stop the first process and wait for it to exit before opening the disks again. The files remain; the old running processes and memory do not.

## A shutdown request is not a stopped VM

QMP provides a way to ask the guest to power down. A launcher can expose a local QMP socket:

```bash
-qmp unix:./demo-control.sock,server=on,wait=off
```

After connecting and reading QEMU's greeting, a client sends these as separate messages and checks each reply:

```json
{"execute": "qmp_capabilities"}
{"execute": "system_powerdown"}
```

QMP can also send events between replies, so a client needs to handle those rather than assume the next line is always the command result.

The powerdown command is a request. A successful reply does not prove that Windows has accepted it or finished shutting down.

Wait for QEMU to exit before reporting that the VM has stopped. Report a timeout if it takes too long.

## A stopped VM does not mean the work passed

The VM shutting down and the workload passing are separate events.

Have the guest write a result after its checks pass. The host can use that result to decide whether the image or output is ready.

An installer returning also needs a check. For example, a command-line tool's exit code can be handled explicitly:

```powershell
& 'C:\Demo\check-result.exe'
if ($LASTEXITCODE -ne 0) {
    throw "Demo check failed with exit code $LASTEXITCODE"
}
```

A fresh run also needs a fresh result. An old success marker left on a reused disk must not count as evidence that the new run passed.

