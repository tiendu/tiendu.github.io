---
title: "Building a Windows VM Without Babysitting the Installer"
date: 2026-10-13
description: "Practical lessons from automating a Windows VM build with QEMU: unattended setup, early network drivers, bootstrap discovery, TCP logging, and moving large files."
topic: "Systems & Reliability"
keywords:
  - "Windows"
  - "QEMU"
  - "unattended installation"
  - "Autounattend.xml"
  - "NetKVM"
  - "PowerShell"
  - "VM provisioning"
  - "automation"
urlSlug: "unattended-windows-vm-build-lessons"
pinned: false
---

I wanted a Windows VM I could throw away and build again.

Start a script. Install Windows. Run the provisioning scripts. Keep the disk image.

That sounded fairly simple.

Then the installer waited for a keypress. Then it wanted a product key. Then Windows started, but the network driver was missing. Then the provisioning output was inside the guest while I was staring at the host terminal.

Each problem was small. Together, they made the build need far more attention than I wanted to give it.

These are the notes I would want beside me if I had to start again.

The examples below use a small, generic lab setup to explain the lessons. Each snippet covers one part of the process; they are not a complete VM builder.

## Start with one guest architecture

For the examples, assume a Windows ARM64 guest on an Apple Silicon host, using QEMU with HVF acceleration.

That choice affects more than the QEMU executable.

The Windows ISO, firmware, answer-file components, and network drivers all have to agree about the guest architecture.

For example, an ARM64 answer-file component uses:

```xml
processorArchitecture="arm64"
```

The network driver must also come from the ARM64 driver package.

Changing the launcher to `qemu-system-x86_64` does not convert those inputs into an x86 build.

I would get one combination working first, then make architecture an explicit input when adding another. Host OS detection alone is not enough.

## The answer file has to reach the installer

`Autounattend.xml` does a lot of the work, provided Windows Setup actually finds it.

The documented removable-media approach puts it at the root of the drive. Setup can also be launched with an explicit `/unattend:` path.[^answer-file]

One option is to expose a staging directory as a read-only virtual FAT drive attached as removable USB storage. It can carry the answer file and the small setup payload.

The useful thing to inspect is the staged output.

Does `Autounattend.xml` exist there? Were the template variables replaced? Is the file at the root? Is that drive actually attached to the VM?

I can have a perfectly good template in Git and still boot a VM with yesterday's rendered file.

I would make the preflight check a separate, cheap step. For example:

```python
from pathlib import Path
import xml.etree.ElementTree as ET

media = Path("lab-media")
answer = media / "Autounattend.xml"

if not answer.is_file():
    raise SystemExit(f"Missing answer file: {answer}")

ET.parse(answer)
print("Answer file exists and is well-formed XML")
```

This checks presence and XML syntax. It does not validate Windows settings or prove the guest can see the drive. Those are separate checks.

For the media attachment, this is a QEMU argument fragment:

```bash
-device qemu-xhci,id=setup_usb \
-drive "file=fat:ro:./lab-media,format=raw,if=none,id=setup_files" \
-device usb-storage,bus=setup_usb.0,drive=setup_files,removable=on
```

The rest of the VM configuration is omitted. The point is the relationship between the host directory, drive backend, and USB device.

## Put each setting in the right phase

I found it easier to understand the XML once I separated its responsibilities.

| Phase | Example responsibilities |
|---|---|
| `windowsPE` | Language, disk partitions, image selection, and product-key input |
| `specialize` | Computer name and timezone |
| `oobeSystem` | Local account, automatic login, and the first-logon bootstrap command |

That also gives me somewhere to start when setup stops.

Disk selection? Look at the installation settings.

Desktop appears but provisioning never starts? Look at the account, login, and bootstrap handoff.

One detail worth checking carefully is the image index. An index selects an image inside that particular ISO. I would inspect the media instead of assuming index `1` always means the edition I want.

The product-key setting also needs to agree with that edition. Supplying a setup key and activating Windows are separate things.

For disk layout, I would write down the intended result before writing the XML:

| Partition | Purpose | Filesystem |
|---|---|---|
| EFI system partition | Firmware boot files | FAT32 |
| Microsoft Reserved partition | Windows disk management | No filesystem assigned here |
| Windows partition | Operating system | NTFS |

Partition sizes and any recovery partition belong to the deployment design. Copying a layout without understanding it is an easy way to make the answer file look correct while targeting the wrong partition.

For example, if the Windows partition is the third partition on the blank virtual disk, the target fragment is:

```xml
<InstallTo>
  <DiskID>0</DiskID>
  <PartitionID>3</PartitionID>
</InstallTo>
```

That belongs under `ImageInstall/OSImage` in the Windows Setup component. It does not create the partition. The disk-configuration settings must create the layout first.

Disk `0` is an assumption to verify, especially when additional disks are attached. Destructive disk settings should apply only to the disposable disk created for the build.

A separate example for machine identity looks like this:

```xml
<settings pass="specialize">
  <component name="Microsoft-Windows-Shell-Setup"
             processorArchitecture="arm64"
             publicKeyToken="31bf3856ad364e35"
             language="neutral"
             versionScope="nonSxS">
    <ComputerName>LAB-WIN01</ComputerName>
    <TimeZone>UTC</TimeZone>
  </component>
</settings>
```

These are answer-file fragments, not standalone documents. They belong inside an `unattend` root with Microsoft's unattended-setup namespace.

If generating XML from variables, use XML escaping. A password containing `&` should not silently break the document.

## Unattended setup still has to get past the boot prompt

The answer file does nothing while the firmware is waiting here:

> Press any key to boot from CD or DVD.

One practical workaround is to send a key through the QEMU human monitor during the initial boot window.

For example, after connecting to the monitor, this command sends a space:

```text
sendkey spc
```

A Unix monitor socket can be configured with an argument such as:

```bash
-monitor unix:./lab-monitor.sock,server=on,wait=off
```

The surrounding helper needs two deadlines: one for waiting for the monitor and another for sending the boot key. The socket becoming available does not prove the prompt is already on screen.

I would stop the helper after that initial window. Sending keys indefinitely can interfere with later screens or boot the installer again after a restart.

The same discovery problem appears in the UEFI shell. I would inspect mappings and locate the installation media instead of assuming it is always `fs0:`.

For example, during an interactive check:

```text
map -r
ls fs2:\sources\boot.wim
ls fs2:\efi\boot\bootaa64.efi
```

Here, `fs2:` is only an example mapping. `bootaa64.efi` is the ARM64 fallback boot filename. A script can search candidate mappings using those files as evidence, but it should report failure if no suitable media is found.

Keep a GUI debug option while working on this. Seeing the actual screen once can save a lot of guessing from the terminal.

QEMU's `-display default` and `-display none` let the launcher switch between visible and headless operation without changing the setup payload.

## Get the network driver in before the bootstrap needs it

This was one of the more useful changes.

The VM had a VirtIO network device. Windows needed NetKVM to use it.

Installing the driver from a later provisioning script meant that the first part of provisioning could not depend on the network. That became awkward once I wanted logs and files moving between host and guest.

The useful change is to provide the driver on the setup media before the network-dependent scripts run.

Windows Setup recognizes a directory named `$WinPEDriver$`. Here is a generic staging example using an already-extracted driver package:

```python
from pathlib import Path
import shutil

package = Path("downloaded-drivers/network-arm64")
destination = Path("lab-media") / "$WinPEDriver$" / "Network"

if not any(package.rglob("*.inf")):
    raise SystemExit(f"No driver INF found under {package}")
if destination.exists():
    raise SystemExit(f"Use a fresh staging directory: {destination}")

shutil.copytree(package, destination)
```

The source path is illustrative. Select the actual package matching the Windows version and guest architecture.

Copy the complete driver package, including its catalog and binary files. An INF file alone is not the driver.

The destination name is literal, including both dollar signs. In a shell command, quote or escape those signs so they are not interpreted as variable expansion.

Windows Setup processes the driver directory and schedules the drivers for inclusion in the installed OS.[^drivers]

There is an important timing detail: this happens through `Setup.exe`. It does not make the driver available before Setup starts. If an earlier WinPE operation needs a driver, that requires separate handling.

Once the build depends on networking, a missing driver should fail staging immediately. Printing a warning and continuing only moves the failure somewhere harder to understand.

I would also pin the driver download and record its checksum. A cached ISO can hide the fact that a moving download URL now serves something different.

## Keep the QEMU devices consistent with the setup

I find it more useful to understand a few device choices than to copy a long launch command.

For example, this argument selects a VirtIO network device with user-mode networking:

```bash
-nic user,model=virtio-net-pci
```

That choice creates the NetKVM dependency discussed above.

Likewise, a disk backend and its device are connected through an identifier:

```bash
-drive file=./lab-system.qcow2,format=qcow2,if=none,id=os_disk \
-device nvme,drive=os_disk,serial=lab-os,bootindex=1
```

These are fragments to include in an appropriate launch command. They do not specify the machine, firmware, installer, or display.

The decisions I would keep explicit are:

| Choice | What to check |
|---|---|
| Guest architecture | ISO, firmware, drivers, and answer file agree. |
| Acceleration | The chosen accelerator works with that host and guest. |
| Disk device | Windows can access it during setup. |
| Network device | Its driver is available before provisioning needs it. |
| Boot order | Restarts prefer the installed disk once it becomes bootable. |
| Firmware state | Each VM has its own writable variable store, where applicable. |

I would keep that firmware variable file with its corresponding disk image. Reusing one variable store across unrelated builds introduces state that is easy to forget.

## Find the payload instead of guessing its drive letter

Hardcoding `D:` works until the attached media changes.

I would give the setup media a small marker file and discover it by that marker. For example, put `lab-media.id` beside a script called `configure-guest.ps1`:

```powershell
$volumes = @(Get-PSDrive -PSProvider FileSystem | Where-Object {
    Test-Path -LiteralPath (Join-Path $_.Root 'lab-media.id')
})

if ($volumes.Count -ne 1) {
    throw "Expected one setup volume; found $($volumes.Count)"
}

$entry = Join-Path $volumes[0].Root 'configure-guest.ps1'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    throw "Setup script missing: $entry"
}

& $entry
```

That code illustrates discovery inside the guest. The answer file still needs a way to launch the initial discovery logic, for example through a first-logon command.

Keep that handoff small. Put installation logic, retries, and error handling in script files where they can be read and tested normally.

Quoting deserves attention here. In PowerShell, calling a script can look like:

```powershell
& 'C:\Lab\configure-guest.ps1'
```

Inside XML text, the call operator needs escaping:

```xml
<CommandLine>powershell.exe -NoProfile -Command "&amp; 'C:\Lab\configure-guest.ps1'"</CommandLine>
```

The fixed path in this second example assumes the script has already been copied there. It only demonstrates XML escaping; it does not perform media discovery.

There are two parsers involved. Both need valid input.

If using a temporary local account and automatic login for provisioning, remove the automatic-login settings and temporary credentials during finalization. I would make that cleanup an explicit step.

## Bring the logs back to the host

At one point, provisioning was running in Windows, but the useful output was only visible inside the guest.

That is a frustrating place to be with a headless build.

A host-side TCP listener gives the guest somewhere to send progress while keeping the terminal visible.

Start it before provisioning needs it. Keep the guest log too, because the forwarding connection can fail.

For a small connectivity check against a line-oriented listener, the guest can send a single message like this:

```powershell
$connection = [System.Net.Sockets.TcpClient]::new()
$connection.SendTimeout = 3000
try {
    $pending = $connection.ConnectAsync('10.0.2.2', 8765)
    if (-not $pending.Wait(3000)) {
        throw 'Log listener connection timed out'
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes("guest reached setup`n")
    $stream = $connection.GetStream()
    $stream.Write($bytes, 0, $bytes.Length)
} finally {
    $connection.Dispose()
}
```

The address assumes default QEMU user-mode networking, and port `8765` is an arbitrary example. This is a one-message probe against an existing listener, not a complete logging client.

A real client needs reconnect behavior and local fallback. A successful socket write also does not prove the host persisted the message.

On the host, track the processes the launcher starts and clean those up. An occupied port should produce an error; it should not be treated as permission to kill an unrelated process.



I want messages that tell me where the build stopped:

```text
[bootstrap] payload found
[network] host service reachable
[install] starting application installer
[install] installer exited with code 0
[verify] application check passed
```

Those are example messages, but that is the level of detail I want.

Keep the guest log as well. A connection can disappear during a restart, and logging should leave evidence even when forwarding fails.

The host listener should accept a new connection after a guest reboot.

## Move large files over the network

The initial setup media can stay small: answer file, drivers, and provisioning scripts.

Once the guest has networking, files can move over TCP without rebuilding that media. That includes sending build outputs or diagnostic bundles back to the host.

The transfer approach here uses HTTP over TCP. HTTP supplies the request method, headers, and response status; TCP carries the byte stream.

A small host-side upload service can receive a file from the Windows guest using an HTTP `PUT`. That is a different direction from downloading an installer into the guest. Both are useful, but the receiver has to implement the operation being requested.

With QEMU's default user-mode networking, the guest normally reaches the host through `10.0.2.2`. A connection to `localhost` inside Windows goes to Windows itself. The host service must listen on a reachable address, and its port must be allowed.[^network]

For example, Windows PowerShell 5.1 can send a file directly as the request body:[^powershell-upload]

```powershell
$artifact = Get-Item -LiteralPath 'C:\Lab\results.zip' -ErrorAction Stop
$remoteName = [Uri]::EscapeDataString($artifact.Name)

$request = @{
    Uri             = "http://10.0.2.2:8766/artifacts/$remoteName"
    Method          = 'Put'
    InFile          = $artifact.FullName
    ContentType     = 'application/octet-stream'
    TimeoutSec      = 900
    UseBasicParsing = $true
    ErrorAction     = 'Stop'
}

Invoke-RestMethod @request
```

The filename, endpoint, port, and timeout are examples. The host must implement binary PUT uploads at that endpoint; Python's default static-file server does not.

`-InFile` supplies the file as the request body. There is no multipart form to construct or parse. That keeps the sender and receiver's agreement simple.

The parameters above target Windows PowerShell 5.1. Timeout parameters have changed in newer PowerShell releases, so check their meaning when moving the script to another version.

### Retry with a limit, then fail the step

A temporary connection failure should not immediately waste the whole build. It also should not leave the guest retrying forever.

For a small lab example, this wrapper allows one retry after a delay. Use it instead of the single call above:

```powershell
$delays = @(0, 4)
for ($attempt = 0; $attempt -lt $delays.Count; $attempt++) {
    if ($delays[$attempt] -gt 0) {
        Start-Sleep -Seconds $delays[$attempt]
    }

    try {
        Invoke-RestMethod @request
        break
    } catch {
        if ($attempt -eq $delays.Count - 1) {
            throw
        }
        Write-Warning "Upload failed; retrying once: $($_.Exception.Message)"
    }
}
```

This deliberately small example retries any request failure once. A more selective version should stop immediately on permanent errors such as rejected credentials or an invalid destination, while retrying connection failures and appropriate server errors.

The final failure propagates to provisioning. Printing a warning and proceeding would leave the build looking successful while its outputs are missing.

Likewise, decide whether an empty artifact directory is allowed. If producing an artifact is required, finding no files should fail the step rather than quietly return success.

I would test a small file first, then a realistically large one. A successful connection says very little about whether the receiver handles a multi-gigabyte body correctly.

### Stream the body instead of loading the whole file

For a direct binary upload, the receiver can read bounded blocks and write them to disk. Memory use should not grow with the total file size.

A generic example of just that copy operation looks like this:

```python
def copy_body(source, destination, expected_bytes):
    if expected_bytes < 0:
        raise ValueError("Negative body length")

    remaining = expected_bytes
    while remaining:
        block = source.read(min(remaining, 256 * 1024))
        if not block:
            raise EOFError(f"Upload ended with {remaining} bytes missing")
        destination.write(block)
        remaining -= len(block)
```

Here, `source` is the request-body stream and `destination` is an open binary file. The surrounding HTTP handler still owns header validation, timeouts, size limits, destination selection, and the response.

For a simple endpoint, require a valid `Content-Length` and reject transfer encodings it does not support. Reading in blocks is an application buffering choice; it is not HTTP chunked transfer encoding.

I would also keep a direct binary upload separate from `multipart/form-data`. A multipart request contains boundaries and part headers as well as the file. Saving that entire body as if it were the file produces the wrong output. A larger request does not change that format.

### Give incomplete uploads an incomplete name

The receiver should write to a unique temporary file in the destination directory.

After receiving the declared number of bytes, it can check the result and publish the final filename. If replacement is intended, `os.replace()` avoids a separate delete-then-rename gap on the same filesystem:

```python
import os

# Run only after receiving and closing the temporary file,
# checking its length, and completing any checksum validation.
os.replace(temporary_path, final_path)
```

Those paths should be selected under the receiver's controlled output directory. A client-supplied filename should not become an unrestricted filesystem path.

The client should receive success only after finalization succeeds. A socket accepting bytes is not the same as a completed upload.

Size verification catches a truncated transfer. A checksum adds verification that the received content matches the expected file; it is a separate check to add, not something TCP or a length comparison automatically provides.

If the final response is lost, the client may not know whether the server completed the upload. Before adding automatic retries, decide whether repeating the same upload safely replaces the same artifact or creates a duplicate.

That is the useful part of this design for me: bounded memory, visible progress, and a clear distinction between a partial file and a finished artifact.

## QEMU exiting is not proof that the build worked

This is a detail I would check before relying on any generated image.

A final message from the host script saying “build complete” only proves execution reached that line.

Windows might have shut down after a failure. A PowerShell script might have continued after an installer returned an error.

I want the guest to report success only after the required provisioning and verification steps finish. Native installer exit codes need explicit handling, including any reboot-required result the installer documents.

The host should require that success evidence before promoting the disk image as usable.

Before preserving it, remove temporary automatic-login credentials and sensitive setup files, retain the diagnostics, and shut the guest down cleanly.

## Build it again from nothing

The test I care about most is another build with a fresh disk and fresh UEFI variable store, where applicable.

No manual driver installation left over. No account I created while debugging. No application that happened to be installed already.

Then boot the resulting image and run a small check of the thing the VM exists to do.

That is where I find out whether I automated the build or just automated the parts I remembered touching.

I started with an installer I wanted to stop watching.

The useful improvements were mostly small: put the answer file where Setup can find it, provide the driver before networking is needed, discover the payload, bring the logs out, and require evidence before calling the build successful.

I would rather spend the time making those steps obvious once than keep remembering how to rescue the same VM.

## References

[^answer-file]: Microsoft Learn, [Automate Windows Setup](https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/automate-windows-setup?view=windows-11).
[^drivers]: Microsoft Learn, [Limitations of $WinPeDriver$](https://learn.microsoft.com/en-us/troubleshoot/windows-client/setup-upgrade-and-drivers/limitations-dollar-sign-winpedriver-dollar-sign).
[^fat]: QEMU documentation, [Virtual FAT disk images](https://www.qemu.org/docs/master/system/images.html#virtual-fat-disk-images).
[^network]: QEMU documentation, [Network emulation](https://www.qemu.org/docs/master/system/devices/net.html).

[^powershell-upload]: Microsoft Learn, [Invoke-RestMethod — Windows PowerShell 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-restmethod?view=powershell-5.1).
