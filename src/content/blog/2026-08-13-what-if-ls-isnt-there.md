---
title: "What If ls Isn't There?"
date: 2026-08-13
description: "A small Linux question about what happens when the obvious tool disappears."
topic: "Systems & Reliability"
keywords:
  - "Linux"
  - "problem solving"
  - "systems engineering"
  - "troubleshooting"
  - "command line"
  - "Unix"
urlSlug: "what-if-ls-isnt-there"
pinned: false
---

One of my favourite little Linux questions is stupidly simple:

> You're logged into a Linux machine. `ls` isn't installed.
>
> How do you find the contents of the current directory and everything below it?

I like questions like this because they're a quick way to get a feel for how someone thinks when the usual tools aren't available.

I'm not particularly interested in whether they know five replacements for `ls`. The interesting part is what happens after the obvious answer disappears.

Most people start with:

```bash
find .
```

Good.

You might also notice that the shell itself can already tell you something:

```bash
printf '%s\n' *
```

or, less carefully:

```bash
echo *
```

Those aren't recursive, so they don't completely solve the original problem. But that's part of the exercise too: figure out what you already have, what it gives you, and what you're still missing.

Now pretend `find` isn't there either.

That's where it gets interesting.

Maybe there's `tree`:

```bash
tree
```

Maybe you abuse `tar` a little:

```bash
tar cvf /dev/null .
```

`tar` has to walk the directory tree before it can archive anything, and verbose mode happens to print what it finds.

Maybe there's `rsync`:

```bash
rsync -rvn . /tmp/nonexistent/
```

Or maybe there's a Python interpreter lying around:

```bash
python -c 'from pathlib import Path; print(*Path(".").rglob("*"), sep="\n")'
```

There are plenty of answers, and honestly I don't care much which one someone reaches for.

The useful part is realizing that **you don't actually need `ls`**.

What you need is some way to inspect the filesystem.

Once you phrase the problem that way, the solution space gets much bigger.

`find` does it because that's its job. `tree` does it because it needs to draw the directory tree. `tar` does it because it needs to discover files before building an archive. `rsync` does it because it needs to know what can be synchronized. A programming language can ask the filesystem directly. Even shell globbing can get you part of the way there without invoking another program at all.

Different tools, same underlying capability.

This is the kind of thinking I care about in troubleshooting.

Real systems are full of stupid constraints.

Production machines are weird. Containers are minimal. A package you expect to be there isn't. Permissions are different. The network is half broken. There's no package manager. There's no internet access. The documentation tells you to run some command that simply doesn't exist on the machine in front of you.

And sometimes the tools are there, just not **your** tools.

Maybe your favourite shell isn't installed. Maybe there's no `zsh`, no nice prompt, no aliases, no shell functions you've accumulated over the years. Maybe the editor on the machine is plain old `vi` when you're used to Neovim, VS Code, or an IDE with a pile of plugins doing things for you.

Sure, you could start copying dotfiles around and rebuilding your comfortable environment.

But sometimes you're on a production machine because something is already broken. Spending twenty minutes making the shell feel like home isn't the job.

You work with what you have.

That's another reason I think versatility matters. I love my tools, and I've spent years making them comfortable, but I don't want to become dependent on that comfort. I should still be able to sit down in front of a boring shell, a stock editor, and a small set of Unix utilities and get something done.

You rarely get the nice clean environment from the tutorial, and you definitely don't always get your own workstation.

After dealing with enough of these situations, you slowly stop asking:

*Which command am I supposed to run?*

And start asking:

*What am I actually trying to find out, and what do I still have available?*

No `curl`?

Fine. I don't really need `curl`. I need some way to make an HTTP request.

No `ping`?

What was I trying to learn from `ping` anyway? Whether DNS resolves? Whether the host is reachable? Whether a specific TCP port accepts connections?

No `grep`?

I don't need an executable called `grep`. I need something capable of searching text.

That sounds like a small distinction, but I think it's a big part of becoming good at systems work.

If your mental model is tied to commands, losing a command can stop you.

If your mental model is tied to capabilities, you start looking for another path.

LLMs make this more interesting.

Today I can ask Claude what to do when `ls` is missing and probably get ten alternatives in a few seconds. That's useful. I use these tools too.

But there's a difference between **using the shortcut because it's convenient** and **needing the shortcut because you can't reason past the missing tool anymore**.

Most of the time, that distinction doesn't matter.

Then something breaks in production. The obvious command tells you nothing useful. The environment doesn't look like the documentation. Maybe you don't even have internet access from the machine you're debugging.

That's when it matters.

So yeah, I still like this silly `ls` question.

Not because knowing weird Unix tricks makes someone a better engineer.

And definitely not because I expect anyone to memorize all of them.

What I want to see is whether someone can still make progress when the environment isn't the one they're comfortable with.

Can you reframe the problem?

Can you figure out what capability you actually need?

Can you use what you still have?

Can you work with an unfamiliar shell, a stock editor, and whatever happens to be installed?

Can you keep moving with limited resources?

To me, that's a big part of being versatile as an engineer.

Having favourite tools is great. I certainly have mine.

Just don't become useless without them.
