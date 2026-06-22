---
layout: post
title: "A Quiet Farewell to Bioinformatics"
date: 2026-06-17
categories: ["Bioinformatics & Scientific Tools", "Automation, Systems & Engineering", "Personal Notes & Reflections"]
pinned: false
---

I saw a Reddit post recently about a biostatistician comparing pharma and tech compensation.

It was not really a dramatic post. The person had an offer from tech, another from pharma, and sat down to compare the whole package instead of only looking at the biggest number.

Base salary, bonus, stock, pension, stability, work-life balance, interest in the work.

In the end, pharma made more sense for them.

The comments were more interesting than the post itself. Some people stayed in hospitals because they liked the work and could see the impact on patients. Some stayed in academia because the team was good, the hours were flexible, the commute was easy, and their life already worked. Some wanted the higher-paying tech role but could not even get past the first screening.

The exact numbers were not what stayed with me.

What stayed with me was the question underneath all of it:

What kind of life does this work actually give me?

I have been asking myself something similar about bioinformatics.

Not exactly pharma versus tech. Not academia versus industry.

More like: do I still want to be a bioinformatics person?

And the answer, if I am honest, is probably no.

Or at least not in the way I used to imagine.

I do not hate bioinformatics. That would be too easy.

The truth is more boring: I think I am tired of it.

Not tired of the people. Not tired of science. Not even tired of messy data, although messy data deserves some blame.

I am tired of pretending that the part I enjoy most is the biology.

Because it is not.

For years, bioinformatics seemed like the obvious place for me. It had biology, code, Linux, pipelines, statistics, and enough broken tools to keep things interesting.

And for a while, it really did fit.

It gave me a career. It gave me difficult problems. It taught me how ugly real-world data can be, how fragile research software becomes, and how much work sits between a scientific question and a usable result.

I am grateful for that.

But gratitude and long-term fit are not the same thing.

When I look back at the work I actually enjoyed, it was rarely the biological interpretation.

I liked figuring out why a job failed.

I liked reading logs and tracing a problem through a workflow, a container, a dataset, and a cloud instance.

I liked turning a fragile process into something people could run again.

I liked helping someone stop reinstalling the same R packages every time they launched an analysis.

I liked finding out that the “bioinformatics problem” was really a disk problem, a memory problem, a permission problem, a file-format assumption, or just a workflow that had never been tested at that scale.

A failed GWAS run can look like a scientific problem from the outside.

From the inside, it may be an instance that is too small, temporary storage filling up, a default timeout, a cost limit, a container version, an unexpected file layout, or software that quietly assumes the input is smaller than it really is.

A notebook that will not open looks like a user problem.

From the inside, it may be container startup, authentication, browser sessions, network routing, service health, or an environment that broke after a package update.

A workflow that ran last month and fails today is usually not bad luck.

The image changed.

A package changed.

The reference moved.

The script made assumptions nobody documented.

The original author left.

The logs are vague.

The system gives the user too many ways to do the wrong thing.

Those were the problems that pulled me in.

At some point, I noticed that I had stopped seeing only the analysis.

I started seeing the operating model underneath it.

Who owns this workflow?

Who maintains it?

Who can run it?

Who knows which version produced which result?

Who pays when it fails after three days?

Who can explain what happened?

Who has to answer the user when the output is missing?

Who fixes the same failure next month?

The biology still matters, obviously. But the machinery decides whether the biology can happen at all.

And I cared more and more about the machinery.

The workflows.

The platform.

The storage.

The permissions.

The reliability.

The boring path from a question to a result.

That realization was uncomfortable because my background says bioinformatics. My job titles say bioinformatics. Most of my experience lives around bioinformatics.

But my attention keeps moving somewhere else.

SysOps.

DevOps.

Platform engineering.

Cloud infrastructure.

Reliability.

Automation.

Observability.

Cost control.

Reproducibility.

All the boring things that keep the exciting work from collapsing.

And honestly, I like the boring things.

I like work where success means fewer people need to ask for help.

I like work where a process becomes uneventful because it finally works.

I like reducing the number of things people have to remember.

I like replacing tribal knowledge with tooling.

I like making the right path easier than the dangerous one.

I like systems that fail early, explain themselves, and recover cleanly.

Support work probably made this clearer to me than anything else.

Support is not glamorous, but it shows you the truth.

It shows you where the documentation is optimistic.

It shows you where a product is confusing.

It shows you which workflows only work because one person knows the magic command.

It shows you where the platform quietly pushes complexity onto the user.

A user says, “My job failed.”

Behind that sentence, there may be a disk that filled up, a tool that wrote files somewhere unexpected, a container missing a dependency, a retry policy repeating the same mistake, or a log that says almost nothing useful.

Sometimes it really is user error. Sometimes the platform cannot protect everyone from every bad choice. Sometimes there are trade-offs.

But the questions that interest me are still the same.

What should be automatic?

What should fail early?

What should be visible?

What should be logged?

What should be reproducible by default?

What should be impossible to misconfigure?

Those are systems questions.

The money side matters too, even if people are sometimes uncomfortable saying that out loud.

Bioinformatics asks for a strange combination of skills.

You may need biology, statistics, programming, Linux, cloud computing, workflow orchestration, data management, debugging, documentation, and the ability to explain all of that to someone who only wants their analysis to finish.

That is not a small skill set.

But the market does not always price it that way.

A lot of bioinformatics work is still treated as scientific support, even when the actual day-to-day work looks a lot like platform engineering, data engineering, or cloud operations.

You debug jobs.

You manage compute.

You deal with storage.

You think about cost.

You fix environments.

You trace failures.

You turn research code into something other people can actually use.

That is engineering.

But because it happens near biology, it is often framed differently.

Not always worse. Just differently.

And after a while, that difference matters.

Sometimes I want to say the field is horrible.

That is the tired version of me talking.

The more honest version is that the deal is weird.

The field wants people who understand biology and software.

It wants scientists who can debug Linux.

It wants engineers who can talk about statistics.

It wants reliable workflows, but often accepts fragile ones.

It wants scale, but sometimes underinvests in platform thinking.

It wants reproducibility, but leaves too much of it to individual discipline.

It wants people to care about the mission while also treating much of the engineering as secondary.

That mismatch wears people down.

I do not think I am leaving because I failed at bioinformatics.

I think I followed it far enough to discover which part I actually care about.

I came in because I liked science and code.

I stayed because the problems were messy and useful.

But the work that kept my attention was the work underneath the science.

The infrastructure.

The automation.

The reliability.

The workflows.

The operational details.

I do not want to spend the next ten years only explaining why another pipeline failed.

I would rather help build the platform where it fails less often.

I do not want to keep patching the same gaps with documentation and heroic debugging.

I would rather build better defaults, monitoring, guardrails, and automation.

That probably points me toward SysOps, DevOps, platform engineering, cloud reliability, or scientific infrastructure.

Maybe still close to bioinformatics.

Maybe outside it.

I am not interested in burning the bridge. There is useful work at the boundary between scientific computing and platform engineering, and that may be where I fit best.

But I no longer want to pretend that my future is pure bioinformatics.

It probably is not.

So this is not a dramatic farewell.

No rant.

No grand speech about how everyone else is wrong.

Just a quiet admission.

Bioinformatics gave me a career and taught me what real scientific computing looks like.

It taught me that data is never as clean as the tutorial.

It taught me that reproducibility is not a slogan.

It taught me that workflows are only easy when someone else has hidden the hard parts.

And, eventually, it taught me that I care more about those hard parts than the analysis sitting on top of them.

I came into bioinformatics because I liked science and code.

I am moving on because I found out I like systems more.
