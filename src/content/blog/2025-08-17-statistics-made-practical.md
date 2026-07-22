---
title: "Statistics Made Practical: How Numbers Mislead Us"
date: 2025-08-17
description: "A practical guide to percentages, averages, Simpson's paradox, uncertainty, p-values, correlation, model metrics, and the questions to ask before trusting a number."
topic: "Statistics & Machine Learning"
keywords:
  - "statistics"
  - "data literacy"
  - "Simpson's paradox"
  - "percentages"
  - "p-values"
  - "SRE metrics"
  - "data visualization"
urlSlug: "statistics-made-simple"
pinned: false
---

Numbers feel objective.

A dashboard says the failure rate increased by **100%**. A report says one system has a higher success rate than another. A study finds a “statistically significant” improvement. A model advertises **99.9% accuracy**.

The calculations may all be correct.

The conclusions may still be wrong.

A failure rate can double because failures increased from one to two. A system can have the better overall success rate while performing worse in every comparable workload group. A statistically detectable improvement can be too small to matter. A model can achieve 99.9% accuracy by predicting that a rare event never happens.

Statistics is therefore not just about calculating numbers. It is about preventing correct numbers from telling the wrong story.

This guide uses examples from a platform that tracks jobs, failures, runtime, cost, customers, regions, and alerts. The same statistical traps also appear in engineering, operations, research, medicine, business, and everyday news.

The goal is not to turn you into a statistician. It is to build a habit:

> Before trusting a number, ask what it measures, what it hides, and what conclusion it actually supports.

---

## Every Metric Is Constructed

Suppose A platform reports:

```text
Job failure rate: 2.4%
```

That number looks precise, but it depends on several decisions.

What counts as a **job**?

- A complete workflow?
- Every stage inside the workflow?
- Automatic retries?
- Test jobs?
- Jobs cancelled by users?

What counts as a **failure**?

- Only terminal platform failures?
- Invalid user input?
- Timeouts?
- Out-of-memory errors?
- Jobs later recovered by retry?
- A workflow with one failed stage but a successful final output?

What period is being measured?

- The last hour?
- The current calendar day?
- A rolling seven-day window?
- The previous complete month?

Who is included?

- Every customer?
- Only production projects?
- Only one region?
- Only jobs that emitted telemetry successfully?

The formula may be simple:

```text
failure rate = failed jobs / submitted jobs
```

The meaning is not.

Two teams can calculate different failure rates from the same platform because they use different definitions. Neither calculation must be arithmetically wrong. They are measuring different things.

### Definitions can change silently

Imagine The platform changes its retry behavior. Previously, every failed attempt was counted as a failed job. Now, only the final result is counted.

The dashboard improves overnight:

```text
Before: 3.1% failure rate
After: 1.8% failure rate
```

Did the platform become more reliable?

Maybe. Or the accounting changed.

This happens whenever:

- an event schema changes;
- a data source stops reporting;
- a filter is added;
- a new customer group enters the system;
- retries are counted differently;
- a dashboard changes from UTC to local time;
- cancelled or incomplete records are excluded.

> A metric is not discovered in nature. It is designed.

Before comparing a metric across teams, systems, or time, confirm that its definition stayed stable.

---

## Percentages Need Counts

Consider this statement:

> The platform's failure rate increased by 100%.

It sounds serious.

Now reveal the counts:

```text
Last week: 1 failure out of 1,000 jobs
This week: 2 failures out of 1,000 jobs
```

The increase really is 100%. The rate doubled from 0.1% to 0.2%.

But the percentage alone hid the scale: one additional failure.

Now consider another 100% increase:

```text
Last week: 5,000 failures out of 100,000 jobs
This week: 10,000 failures out of 100,000 jobs
```

The same relative increase now represents 5,000 additional failures.

The percentage is identical. The operational meaning is not.

### Never show a naked percentage

Instead of:

```text
Success rate: 95%
```

report:

```text
Success rate: 95% — 19 of 20 jobs
```

or:

```text
Success rate: 95% — 95,000 of 100,000 jobs
```

Both estimates are 95%, but the second is based on much more evidence.

The count also reveals practical impact. A 1% failure rate means:

- 1 failure per 100 jobs;
- 100 failures per 10,000 jobs;
- 10,000 failures per million jobs.

At scale, a small percentage can represent a large problem.

> **Memory rule:** Whenever you see a percentage, ask, “How many out of how many?”

---

## Percentage Points Are Not Percentage Change

Suppose The platform's failure rate rises from 2% to 3%.

There are several correct ways to describe the change:

- It increased by **1 percentage point**.
- It increased by **50% relative to the old rate**.
- It produced **10 additional failures per 1,000 jobs**, assuming the job count stayed comparable.

These descriptions are not interchangeable.

The phrase “increased by 1%” is ambiguous. It might mean:

```text
2% → 3%
```

which is a one-percentage-point increase and a 50% relative increase.

Or it might mean:

```text
2% → 2.02%
```

which is a 1% relative increase.

A clear report includes both the original and new values:

```text
Failure rate increased from 2.0% to 3.0%:
+1.0 percentage point, or +50% relative.
```

### Relative changes can exaggerate tiny baselines

A risk that rises from 0.01% to 0.02% has doubled.

That is a 100% relative increase.

It is also an absolute increase of:

```text
0.01 percentage point
1 additional event per 10,000 cases
```

Relative change tells you how large the change is compared with the baseline. Absolute change tells you how much the real-world outcome changed.

Both can matter. Reporting only one invites misunderstanding.

> **Memory rule:** Report the old value, the new value, the absolute difference, and the relative change.

---

## The Denominator Can Change the Story

A rate has two moving parts:

```text
rate = numerator / denominator
```

When a rate changes, people often stare only at the numerator.

Suppose The platform's failure rate falls:

```text
June: 500 failures / 10,000 jobs = 5%
July: 500 failures / 50,000 jobs = 1%
```

The failure rate improved dramatically, but the number of failed jobs did not change at all. July simply contained many more successful jobs.

That may still be good news. But it is different from reducing failures.

Now consider:

```text
June: 500 failures / 10,000 jobs = 5%
July: 400 failures / 4,000 jobs = 10%
```

The number of failures decreased, but the failure rate doubled because total activity fell even faster.

Which month was better?

That depends on the question:

- Did fewer jobs fail? July.
- Was an individual submitted job less likely to fail? June.
- Was customer impact lower? We need to know the size and importance of the failed jobs.
- Did the platform process more useful work? We need more information.

A rate compresses two quantities into one number. Always inspect both.

### Beware of denominator engineering

A metric can improve when difficult cases disappear from the denominator.

Examples:

- A support team excludes reopened tickets.
- A service measures availability only for accepted requests.
- A hospital reports outcomes only for patients who completed treatment.
- A model is evaluated only on cases with complete data.
- Failed jobs that produced no telemetry vanish from the dashboard.

> A falling rate may mean the numerator improved, the denominator changed, or the measurement lost difficult cases.

---

## Do Not Blindly Average Percentages

A platform reports daily success rates:

```text
Monday:  1 successful job out of 2   = 50%
Tuesday: 90 successful jobs out of 100 = 90%
```

The simple average of the two daily percentages is:

```text
(50% + 90%) / 2 = 70%
```

But the combined success rate is:

```text
(1 + 90) / (2 + 100) = 91 / 102 = 89.2%
```

Why are the answers different?

The 70% calculation gives Monday and Tuesday equal weight, even though Tuesday processed 50 times as many jobs.

The 89.2% calculation gives every job equal weight.

Neither answer is automatically wrong. They answer different questions.

- **70%** answers: What was the average of the two daily success rates?
- **89.2%** answers: What fraction of all jobs succeeded?

The same issue appears when averaging:

- regional error rates;
- customer conversion rates;
- monthly percentages;
- test pass rates;
- hospital outcomes;
- school performance;
- model metrics across groups.

Before averaging rates, decide what should receive equal weight:

- every observation;
- every day;
- every customer;
- every region;
- every experiment;
- every group.

> **Memory rule:** A weighted average is a decision about whose experience counts how much.

---

## Averages Hide Distributions

Suppose five platform jobs take:

```text
2, 3, 3, 4, 48 minutes
```

The mean runtime is:

```text
(2 + 3 + 3 + 4 + 48) / 5 = 12 minutes
```

The median runtime is:

```text
3 minutes
```

Both are correct.

The mean tells us that total runtime divided equally across the five jobs is 12 minutes. The median tells us that the middle observed job took 3 minutes.

Which is more useful?

- For the experience of a typical job, the median is more representative.
- For total compute consumed per job, the mean may matter.
- For capacity planning, the long 48-minute job cannot be ignored.
- For user experience, upper percentiles may matter more than either center.

The lesson is not “median good, mean bad.”

> Different summaries answer different questions.

### The same mean can hide completely different systems

Consider two sets of runtimes:

```text
System A:  98, 99, 100, 101, 102
System B:   1,  1,   1,   1, 496
```

Both have a mean of 100.

System A is predictable.

System B is usually fast but occasionally catastrophic.

A single average cannot show:

- variation;
- skew;
- multiple clusters;
- extreme values;
- long tails;
- rare but severe failures.

Whenever possible, accompany a measure of center with a measure of spread and a view of the distribution.

Useful summaries include:

- count;
- median;
- interquartile range;
- standard deviation;
- p90, p95, or p99;
- minimum and maximum;
- histogram or density plot.

### Percentiles reveal the tail

If p99 latency is 8 seconds, roughly 1% of measured requests took longer than 8 seconds.

A platform can report:

```text
Mean latency: 250 ms
Median latency: 120 ms
p99 latency: 8,000 ms
```

The mean looks acceptable while a small group of users experiences terrible performance.

For operational systems:

- median describes a typical observation;
- p95 or p99 exposes slower experiences;
- mean helps account for total consumption;
- maximum can reveal the worst observed event but is highly sensitive to one anomaly.

Do not choose a statistic because it looks best. Choose it because it matches the decision.

---

## Aggregation Can Reverse a Conclusion

Now consider two versions of a platform's job scheduler.

They process easy and difficult workloads:

| Workload | Scheduler A | Scheduler B |
|---|---:|---:|
| Easy jobs | 81/87 = **93.1%** | 234/270 = **86.7%** |
| Difficult jobs | 192/263 = **73.0%** | 55/80 = **68.8%** |
| Overall | 273/350 = **78.0%** | 289/350 = **82.6%** |

Scheduler A has the higher success rate for both easy jobs and difficult jobs.

Yet Scheduler B has the higher overall success rate.

The arithmetic is correct.

The reversal happens because the schedulers processed different mixes of work:

- Scheduler A handled many more difficult jobs.
- Scheduler B handled many more easy jobs.

This is **Simpson's paradox**: a pattern appears within separate groups but reverses when the groups are combined.

### Which answer is correct?

Both tables answer legitimate but different questions.

The overall result answers:

> Under the workloads each scheduler actually received, which one produced the higher total success rate?

The grouped results answer:

> When jobs of comparable difficulty are compared, which scheduler performed better?

If you are choosing a scheduler for the same workload mix tomorrow, the grouped comparison may be more useful.

If you are describing what happened operationally last month, the overall result also matters.

Simpson's paradox does not mean aggregated data is false. It means aggregation can mix together a performance effect and a composition effect.

Common grouping variables include:

- workload size;
- customer tier;
- region;
- age;
- disease severity;
- ticket complexity;
- device type;
- traffic source;
- time of day;
- model class;
- product category.

> **Memory rule:** Always inspect the total, then split the data by groups that could affect the outcome.

Do not split endlessly until you find a pleasing result. Choose groups that are relevant to the mechanism or decision.

---

## Population Mix Can Change Without Performance Changing

Suppose The platform's average runtime falls by 30% in July.

The engineering team celebrates an optimization.

But the system processed a different workload:

```text
June:
20% small test jobs
80% large production jobs

July:
70% small test jobs
30% large production jobs
```

Runtime may have stayed exactly the same within both job types. The overall average fell because July contained more easy work.

This is a **composition effect**.

The same trap appears when:

- average support resolution time falls because fewer complex tickets arrive;
- hospital mortality changes because patient severity changes;
- school results change because the student population changes;
- cloud cost per job falls because jobs become smaller;
- model accuracy changes because the class balance changes;
- customer satisfaction rises because unhappy customers leave.

When comparing groups or periods, ask:

> Are we measuring better performance, or a different population?

Useful approaches include:

- reporting results separately for important groups;
- standardizing to a common population mix;
- comparing like with like;
- using regression or other adjustment carefully;
- explicitly reporting the composition change.

Adjustment is not magic. It depends on which variables were measured and how the model was designed. But ignoring composition is often worse.

---

## Time Windows Can Manufacture a Trend

Suppose Platform incidents increased 40% compared with yesterday.

That sounds alarming.

But yesterday was a public holiday with unusually low traffic.

Now compare with last Wednesday: incidents are down 5%.

Compare with the previous 30-day average: unchanged.

All three statements may be numerically correct.

A time comparison depends on:

- start and end dates;
- day-of-week patterns;
- holidays;
- seasonality;
- traffic volume;
- product releases;
- outages;
- migrations;
- reporting delays.

### Cumulative metrics can hide current damage

Imagine Suppose a platform achieved 99.99% availability for most of the month, then suffered a major outage today.

A month-to-date availability number may still look healthy because earlier successful traffic dominates the calculation.

A rolling one-hour view would show the outage immediately.

Neither time window is universally correct:

- short windows detect changes quickly but are noisy;
- long windows are stable but can hide recent problems;
- cumulative windows become increasingly insensitive late in the period.

Operational dashboards often need several views:

```text
Current: last 5–15 minutes
Recent: last 1–24 hours
Trend: last 7–30 days
Objective: the official SLO window
```

### Smoothing can conceal turning points

A seven-day moving average reduces daily noise. It also responds slowly to sudden changes.

A graph should make clear whether it shows:

- raw observations;
- a rolling average;
- a cumulative total;
- a modelled trend;
- seasonally adjusted values.

> **Memory rule:** Every trend begins with a choice of window. Ask why that window was chosen.

---

## More Data Does Not Fix Biased Data

A platform sends a satisfaction survey only after successful jobs.

Ten thousand users respond, and 95% say they are satisfied.

The sample is large.

It is also missing users whose jobs failed before they reached the survey.

The estimate may precisely describe successful users while badly misrepresenting all users.

### Random error and systematic bias are different

A larger sample usually reduces random fluctuation.

It does not automatically fix:

- selection bias;
- measurement error;
- leading questions;
- missing data;
- survivorship bias;
- confounding;
- inconsistent definitions.

Suppose you want to estimate how often adults exercise and survey 100,000 people at gyms.

The sample is huge, but it oversamples active people.

A smaller, well-designed sample from the wider population can be more informative.

> A bigger spoon does not help if you keep tasting the wrong part of the soup.

### Missing data can carry information

Data is often missing for a reason:

- failed jobs produce no completion metric;
- dissatisfied customers stop responding;
- employees who resigned disappear from workplace surveys;
- participants leave a treatment because it did not work;
- unsuccessful companies disappear from studies of surviving businesses;
- users unable to log in cannot submit feedback.

Treating missing observations as harmless can bias the result.

Before trusting a sample, ask:

- Who had a chance to be included?
- Who chose to respond?
- Who dropped out?
- Who could not be measured?
- Is missingness related to the outcome?

> **Memory rule:** More data reduces noise. It does not automatically reduce bias.

---

## Estimates Need Uncertainty

Suppose a sample of platform jobs has an average runtime of 20 minutes.

That number looks exact. It is not.

A different sample of jobs might produce 18, 21, or 23 minutes.

A point estimate should therefore be accompanied by uncertainty.

For example:

```text
Estimated mean runtime: 20 minutes
95% confidence interval: 18–22 minutes
```

The interval communicates the precision of the estimated mean.

In frequentist terms, the 95% refers to the long-run performance of the procedure: if we repeatedly sampled data and constructed intervals in the same way, about 95% of those intervals would contain the fixed population value, assuming the model and sampling assumptions hold.

For everyday interpretation, the practical message is:

> The data supports a range of plausible values, not only the point estimate.

### Confidence interval versus prediction interval

Suppose the mean runtime is estimated precisely:

```text
Mean runtime: 20 minutes
95% confidence interval for the mean: 19–21 minutes
```

That does not mean the next job will probably run between 19 and 21 minutes.

Individual jobs may vary enormously:

```text
95% prediction interval for a future job: 2–90 minutes
```

These intervals answer different questions:

- **Confidence interval:** How uncertain are we about a population parameter such as the mean?
- **Prediction interval:** How uncertain are we about a future individual observation?

For capacity planning and user expectations, the prediction interval may be more relevant.

### Narrow uncertainty does not guarantee truth

A very large biased sample can produce a narrow confidence interval around the wrong value.

Confidence intervals usually reflect sampling uncertainty under a model. They do not automatically account for:

- biased sampling;
- incorrect measurement;
- unmeasured confounding;
- model misspecification;
- data-processing errors.

Precision is not the same as accuracy.

---

## Statistical Significance Is Not Importance

Suppose A platform tests a new scheduler on one million jobs.

Average runtime changes from:

```text
20.00 minutes → 19.96 minutes
```

The p-value is below 0.001.

The effect may be statistically detectable because the sample is enormous.

But the improvement is only 2.4 seconds.

Is it worth the migration cost, engineering effort, and operational risk?

That is not answered by the p-value.

### What a p-value asks

A statistical test usually starts with a null model, such as:

> The new scheduler has no effect on mean runtime.

The p-value asks, roughly:

> Assuming the null model and the test assumptions are correct, how often would we observe a result at least this extreme?

A small p-value can indicate tension between the observed data and the null model.

It does **not** directly tell us:

- the probability that the null hypothesis is true;
- the probability that the research claim is true;
- the probability that the result will replicate;
- the size of the effect;
- whether the effect matters;
- whether the study design was sound.

### The 0.05 threshold is not a truth machine

The conventional boundary:

```text
p < 0.05
```

is not a law of nature.

A result with `p = 0.049` is not transformed into truth while `p = 0.051` becomes worthless. They represent nearly the same evidence.

Bright-line thinking encourages:

- celebrating results just below the threshold;
- dismissing results just above it;
- testing many variations until one passes;
- hiding uncertainty;
- ignoring effect size;
- confusing “not significant” with “no effect.”

A useful report includes:

- the estimated effect;
- an uncertainty interval;
- the sample size;
- the study design;
- the assumptions;
- the practical consequences;
- the p-value when appropriate.

### Detectable, important, and certain are different

Consider two results:

```text
A. Runtime improved by 0.2%, p < 0.001.
B. Outage duration may have fallen by 30%, but only four incidents were observed.
```

Result A is precise but possibly unimportant.

Result B may be operationally important but highly uncertain.

Statistical thinking requires separating:

1. **Effect size:** How large is the observed difference?
2. **Uncertainty:** How precisely was it estimated?
3. **Practical importance:** Would the difference change a decision?

> **Memory rule:** Statistical significance asks about evidence against a model. It does not tell you whether the effect is large, useful, or true.

---

## Looking for More Patterns Creates More False Alarms

Suppose A platform tracks 100 metrics across:

- 12 regions;
- 20 customer groups;
- 10 instance types;
- 24 hours of the day;
- several software versions.

If analysts search every combination, some unusual-looking patterns will appear by chance.

At a 5% false-positive threshold, even when every null hypothesis is true, repeated independent tests will eventually produce apparently significant results.

The everyday problem is not only formal hypothesis testing. It also appears in:

- trying many dashboard filters;
- testing many model features;
- changing start and end dates;
- inspecting many customer cohorts;
- reporting only the largest difference;
- stopping an experiment when the result looks favorable.

### Exploration and confirmation are different

Exploration is useful. It helps generate hypotheses.

But a pattern discovered after searching broadly should be treated as a clue, not a confirmed finding.

A stronger workflow is:

1. Explore the existing data.
2. State a specific hypothesis.
3. Define the metric and analysis.
4. Test it on new or held-out data.
5. Report all planned outcomes, not only favorable ones.

Ask:

- Was this question chosen before looking at the result?
- How many alternatives were tried?
- Were unsuccessful analyses omitted?
- Was the pattern reproduced independently?

> The more opportunities you had to find an interesting result, the less surprising one interesting result becomes.

---

## Correlation Is Not an Explanation

Suppose A platform finds that days with more deployments also have more incidents.

The correlation is real.

What caused what?

Possible explanations include:

```text
Deployments cause incidents.
Incidents cause emergency deployments.
High-traffic days cause both.
Large releases cause both more deployment activity and more incidents.
The monitoring system records both more completely on busy days.
The relationship appeared by chance.
```

Correlation tells us that two variables move together.

It does not tell us why.

### Confounding

A confounder is another factor related to both variables.

Ice cream sales and sunburns rise together because sunny weather increases both.

In engineering:

- larger customers generate more support tickets and more revenue;
- heavily used services receive more deployments and more incidents;
- complex jobs use more memory and fail more often;
- senior engineers handle more severe incidents and may appear to have longer resolution times.

The observed association may reflect workload or assignment rather than performance.

### Reverse causation

Sometimes the direction runs backward.

A dashboard may show that services with more monitoring have more detected incidents.

Monitoring may not cause incidents. Incidents may cause teams to add monitoring, and better monitoring may discover problems that were previously invisible.

### Stronger causal evidence

Causal conclusions may be strengthened by:

- randomized experiments;
- credible control groups;
- before-and-after designs with care;
- natural experiments;
- instrumental variables;
- difference-in-differences;
- repeated evidence;
- a plausible mechanism;
- explicit consideration of alternative explanations.

Every method has assumptions.

> **Memory rule:** Correlation is an observation. Causation is an explanation that needs additional evidence.

---

## Accuracy Can Be Almost Useless

Suppose A platform has one catastrophic job failure for every 1,000 jobs.

A model predicts:

```text
Every job will succeed.
```

It is correct 999 times out of 1,000.

Its accuracy is:

```text
99.9%
```

The model still detects no catastrophic failures.

Accuracy looks impressive because the negative class is common.

For rare events, a confusion matrix is more informative:

| Reality | Predicted failure | Predicted success |
|---|---:|---:|
| Failure | True positive | False negative |
| Success | False positive | True negative |

From these counts, different metrics answer different questions.

### Recall

```text
recall = true positives / all actual positives
```

Of all real failures, how many did the model detect?

Use recall when missing a real event is costly.

### Precision

```text
precision = true positives / all predicted positives
```

Of all failure alerts, how many were correct?

Use precision when false alarms are expensive.

### Specificity

```text
specificity = true negatives / all actual negatives
```

Of all normal cases, how many did the model correctly leave alone?

### There is no universally best threshold

A risk model often produces a score, not a final decision.

Choosing a threshold determines the balance:

- lower threshold: more detections, more false alarms;
- higher threshold: fewer false alarms, more missed events.

The correct threshold depends on consequences:

- What does an investigation cost?
- What does a missed failure cost?
- Can the response team handle the alert volume?
- Is the model used for warning, blocking, or prioritization?
- Are costs equal across customers or cases?

ROC curves and AUC summarize discrimination across thresholds, but they do not choose the operational threshold for you. With highly imbalanced data, precision-recall views may reveal more than accuracy or ROC alone.

> A model score is not a decision. A threshold turns scores into consequences.

---

## Base Rates Change the Meaning of an Alert

Suppose a rare platform security breach occurs in 1 of every 10,000 sessions.

A detector is good:

- it catches 99% of breaches;
- it falsely flags 1% of normal sessions.

Test one million sessions:

```text
Real breaches:        100
Detected breaches:     99

Normal sessions:  999,900
False alarms at 1%: 9,999
```

The detector generates:

```text
99 true alerts + 9,999 false alerts = 10,098 alerts
```

Only about 1% of alerts are real.

This surprises people because they focus on the detector's sensitivity and ignore the rarity of the event.

The base rate—the prevalence before seeing the alert—matters.

This appears in:

- medical testing;
- fraud detection;
- intrusion detection;
- automated moderation;
- manufacturing defects;
- rare disease screening;
- anomaly detection.

A low false-positive rate can still overwhelm the true positives when normal cases are vastly more common.

Ask:

- How common is the event?
- How many true cases exist?
- How many normal cases exist?
- What proportion of alerts are correct?
- What happens after an alert?

> **Memory rule:** The rarer the event, the more carefully you must interpret a positive alert.

---

## Charts Can Be Accurate and Still Mislead

A chart is an argument made with geometry.

Correct data can create a false visual impression through scale, selection, and design.

### Truncated axes exaggerate differences

Suppose two success rates are:

```text
98% and 100%
```

A bar chart starting at zero shows a small difference.

A bar chart starting at 97% can make one bar appear several times taller.

A truncated axis is not always wrong. It may help reveal small but meaningful variation in a line chart. But bar length is normally interpreted relative to zero, so truncated bar charts deserve special caution.

### Dual axes can manufacture relationships

A chart places job volume on the left axis and infrastructure cost on the right axis.

By changing the two scales, the lines can be made to overlap closely or appear unrelated.

The relationship may be real, but the visual alignment is partly chosen by the author.

### Unequal bins hide detail

A histogram with wide bins can hide multiple clusters. A chart that groups all runtimes above one hour together can conceal whether those jobs took 61 minutes or three days.

### Cumulative totals almost always rise

A cumulative chart of incidents, costs, or customers tends to move upward even when the current rate is falling.

To understand change, inspect the rate per period as well as the cumulative total.

### Missing baselines create drama

A chart says monthly cost increased from $1 million to $1.2 million.

That is a 20% increase.

But perhaps processed workload increased 50%, so cost per job fell.

The relevant baseline depends on the decision:

- total cost;
- cost per job;
- cost per customer;
- cost per successful result;
- cost adjusted for workload size.

When reading a chart, check:

- Does the axis begin at zero, and should it?
- Are time intervals equal?
- Are percentages accompanied by counts?
- Is the denominator stable?
- Are values cumulative or per-period?
- Are categories or time windows missing?
- Was smoothing applied?
- Are two axes being compared?
- Does the visual size match the numerical difference?

> **Memory rule:** Read the axes before reading the story.

---

## A Metric Can Improve While the System Gets Worse

Suppose A platform rewards the support team for closing tickets quickly.

Average closure time falls.

But agents begin:

- closing tickets before confirming resolution;
- splitting difficult tickets into new cases;
- avoiding complex cases;
- asking customers to reopen instead of keeping tickets active.

The metric improves. Customer experience worsens.

This is a version of **Goodhart's law**:

> When a measure becomes a target, it stops being a good measure.

The statement is intentionally blunt. More precisely, strong incentives encourage people and systems to optimize the measured proxy rather than the underlying goal.

Examples:

- Alert count falls because alerts were disabled.
- Test pass rate rises because difficult tests were removed.
- Availability improves because rejected traffic is excluded.
- Cost per job falls because jobs fail earlier.
- Deployment frequency rises because changes are split artificially.
- Hospital waiting time improves because patients wait somewhere unmeasured.
- Ticket closure rate rises while reopen rate and customer effort rise.

### Use families of metrics

One metric rarely captures a complex goal.

If the goal is effective support, track a balanced set:

- first-response time;
- time to meaningful resolution;
- reopen rate;
- customer effort;
- escalation rate;
- backlog age;
- quality review;
- customer outcome.

Metrics should check one another.

A speed metric needs a quality metric. A reliability metric needs a workload metric. A cost metric needs an outcome metric.

### Keep the goal visible

Instead of saying:

> Our goal is to reduce mean ticket closure time.

say:

> Our goal is to resolve customer problems accurately with reasonable effort and delay. Closure time is one indicator.

> **Memory rule:** A metric is a proxy for the goal, not the goal itself.

---

## Study Design Beats Fancy Mathematics

A sophisticated model cannot rescue fundamentally bad evidence.

Imagine:

- a survey asks a leading question;
- treatment and control groups differ before treatment;
- a performance comparison assigns the hardest work to one team;
- an experiment changes several things at once;
- measurement differs between groups;
- failed participants disappear from the analysis;
- an outcome is chosen after inspecting many results.

The arithmetic may be flawless.

The conclusion may still be unsupported.

Before focusing on the statistical method, ask how the data was created:

- How were cases selected?
- Was there a fair comparison?
- Were measurements consistent?
- Did many observations disappear?
- Was the outcome defined in advance?
- Did the intervention occur before the outcome?
- Could participants or analysts influence assignment?
- Was the analysis changed after seeing the data?
- Does the conclusion go beyond the measured population?

> Clean calculations cannot repair a dirty study design.

---

## One Result Is Rarely the Final Word

A dashboard anomaly, experiment, or published study is one piece of evidence.

Its result may depend on:

- a particular sample;
- an unusual week;
- one customer cohort;
- a measurement decision;
- a model assumption;
- random variation;
- an unnoticed bug;
- a hidden confounder.

Confidence should grow when:

- the design is credible;
- the effect is meaningful;
- uncertainty is reported;
- the result appears in new data;
- different teams reproduce it;
- alternative explanations are tested;
- the mechanism is plausible;
- the finding survives attempts to disprove it.

Replication does not require identical numbers. Different populations and methods naturally produce variation.

The important question is whether the larger body of evidence points in a consistent direction.

> A surprising result is a reason to investigate, not a reason to stop thinking.

---


## Final Thoughts

Numbers are useful because they compress reality.

That is also why they can mislead.

A percentage can hide its counts. An average can hide its distribution. An aggregate can hide differences between groups. A trend depends on its time window. A p-value says nothing about whether an effect matters. An accuracy score can hide class imbalance. A metric can reward the wrong behavior.

The answer is not to distrust statistics. It is to avoid treating a number as if it explains itself.

Every statistic was defined, collected, filtered, summarized, and presented by someone. Understanding those choices is what turns a calculation into useful evidence.

Statistics becomes much less mysterious once you stop asking only, “Is this number correct?” and start asking, “What story can this number actually support?”

---

## Further Reading

- [American Statistical Association: Statement on Statistical Significance and P-Values](https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf)
- [Google Machine Learning Crash Course: Accuracy, Precision, Recall, and Related Metrics](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)
- [Google Machine Learning Crash Course: ROC and AUC](https://developers.google.com/machine-learning/crash-course/classification/roc-and-auc)
