---
layout: post
title: "Statistics Made Simple: Mnemonics, Analogies, and Practical Notes"
date: 2025-08-17
categories: ["Statistics and Probability"]
---

Statistics looks scary because it has formulas, Greek letters, and words that sound more complicated than they are.

But most useful statistics ideas are simple once you attach them to a story.

This post is not a full textbook. It is a memory map: short explanations, analogies, mnemonics, formulas, and practical notes that help the ideas stick.

Use it when you forget what a p-value means, when sensitivity and specificity get mixed up, when precision and recall feel confusing, or when you need to explain statistics without burying someone in math.

---

## The Big Picture

Statistics is about making decisions under uncertainty.

You rarely know the full truth. Usually, you have a sample, some noise, and a question.

The basic workflow is:

1. Look at the data.
2. Understand the shape and spread.
3. Ask what could happen by chance.
4. Estimate uncertainty.
5. Decide whether the evidence is strong enough.

Mnemonic:

> Describe first, decide later.

Practical note:

If you skip the descriptive part and jump straight to tests, you can get a result that is mathematically valid but practically useless.

Example:

A drug may show a statistically significant effect, but if it lowers blood pressure by only 0.2 mmHg, the result may not matter clinically.

---

## Population vs Sample

Analogy: "The soup and the spoon"

The population is the whole pot of soup.

The sample is one spoonful.

You taste the spoonful because you cannot drink the whole pot. But the spoonful only helps if it represents the soup well.

Key terms:

| Term | Meaning |
|---|---|
| Population | The full group you care about |
| Sample | The part you actually observe |
| Parameter | A true value in the population, usually unknown |
| Statistic | A value calculated from the sample |

Example:

You want to know the average height of all adults in a city.

- Population: all adults in the city.
- Sample: 500 adults you measured.
- Parameter: the true average height of all adults in the city.
- Statistic: the average height of your 500-person sample.

Mnemonic:

> Parameter belongs to the population. Statistic belongs to the sample.

Practical note:

A bigger sample helps, but it does not fix a biased sample. Measuring 100,000 gym members still will not represent all adults.

---

## Sampling Bias

Analogy: "Only tasting soup from the top"

A sample is biased when it does not represent the population.

Example:

You survey only LinkedIn users and conclude that everyone is worried about career growth.

That may describe LinkedIn users, not everyone.

Common sampling problems:

| Problem | Meaning | Example |
|---|---|---|
| Selection bias | Some people are more likely to enter the sample | Surveying only app users |
| Survivorship bias | You only see what survived | Studying successful startups only |
| Non-response bias | People who respond differ from those who do not | Angry customers answer more often |
| Convenience sampling | You sample whoever is easy to reach | Asking only your friends |

Mnemonic:

> Bad spoon, bad soup judgment.

Practical note:

Sampling design often matters more than sample size.

---

## Mean, Median, and Mode

Analogy: "Three ways to describe the center"

The mean is the balancing point.

The median is the middle person in line.

The mode is the most common value.

Example:

```text
Salaries: 30k, 35k, 40k, 45k, 1,000k
```

The mean is pulled upward by the 1,000k salary.

The median stays near the middle.

That is why median income is often more useful than mean income.

| Measure | Memory trick | Good for |
|---|---|---|
| Mean | Balancing point | Symmetric data |
| Median | Middle person | Skewed data, outliers |
| Mode | Most popular | Categories, repeated values |

Mnemonic:

> Mean is sensitive. Median is steady. Mode is popular.

Practical note:

Use the median when the data has outliers or strong skew. Use the mean when the distribution is reasonably symmetric and outliers are not dominating the story.

---

## Range, IQR, Variance, and Standard Deviation

Analogy: "How far did the marbles roll?"

Imagine dropping marbles on the floor.

The center tells you where the marbles cluster.

The spread tells you how far they rolled away.

Common spread measures:

| Measure | Meaning | Practical use |
|---|---|---|
| Range | Max - min | Quick rough spread |
| IQR | Q3 - Q1 | Robust spread, ignores extremes |
| Variance | Average squared distance from mean | Mathematical modeling |
| Standard deviation | Square root of variance | Spread in original units |

Mnemonic:

> Variance is spread squared. Standard deviation is spread you can read.

Example:

If weights are measured in kg:

- Variance is in kg squared, which is hard to interpret.
- Standard deviation is in kg, which is easier to understand.

Practical note:

Standard deviation is useful, but it assumes the mean is a meaningful center. If data is heavily skewed, also look at median, IQR, and percentiles.

---

## Percentiles and Quantiles

Analogy: "Your position in the queue"

A percentile tells you where a value stands compared with others.

If your score is at the 90th percentile, you scored higher than about 90% of the group.

Common quantiles:

| Quantile | Meaning |
|---|---|
| 25th percentile | Q1 |
| 50th percentile | Median |
| 75th percentile | Q3 |
| IQR | Q3 - Q1 |

Mnemonic:

> Percentile means position.

Practical note:

Percentiles are often better than averages for messy real-world data: income, latency, file size, hospital wait time, cloud job runtime, and customer spend.

Example:

For web latency, the average can look fine while the 99th percentile is terrible.

That means most users are fine, but some users are suffering badly.

---

## Z-Score

Analogy: "How many steps from average?"

A z-score tells you how far a value is from the mean, measured in standard deviations.

```text
z = (value - mean) / standard deviation
```

Interpretation:

| Z-score | Meaning |
|---:|---|
| 0 | Exactly average |
| +1 | One standard deviation above average |
| -1 | One standard deviation below average |
| +2 | Unusually high in many normal-like datasets |
| -2 | Unusually low in many normal-like datasets |

Mnemonic:

> Z is a universal ruler.

Why it helps:

A raw difference can be misleading.

Being 5 kg above average is very different if the standard deviation is 2 kg versus 20 kg.

Practical note:

Z-scores work best when the data is roughly normal and not full of outliers.

---

## Robust Z-Score

Analogy: "Messy data? Trust the middle."

Classic z-score uses the mean and standard deviation. Both can be distorted by outliers.

Robust z-score uses tougher statistics:

- Median instead of mean.
- MAD, or median absolute deviation, instead of standard deviation.

Simple version:

```text
robust z = (value - median) / MAD
```

Common scaled version:

```text
robust z = 0.6745 * (value - median) / MAD
```

Mnemonic:

> Classic z assumes normality. Robust z assumes reality.

Practical note:

Use robust z-scores for anomaly detection when data has spikes, bad records, long tails, or weird one-off events.

Example:

Cloud job runtimes are often skewed. A few jobs may hang for hours. Mean and standard deviation can be distorted, so median and MAD may tell the story better.

---

## Shapes of Distributions

Analogy: "Every data story has a shape"

Before testing anything, look at the shape of the data.

Common shapes:

| Shape | Meaning | Example |
|---|---|---|
| Normal | Symmetric bell shape | Human height, measurement noise |
| Right-skewed | Long tail to the right | Income, file size, runtime |
| Left-skewed | Long tail to the left | Scores on an easy exam |
| Uniform | All outcomes roughly equal | Fair dice |
| Bimodal | Two peaks | Mixed subgroups |
| Long-tailed | Rare huge values | Cloud cost, web traffic |

Mnemonic:

> Know the shape before you crunch the numbers.

Practical note:

Averages can hide subgroups. If a distribution is bimodal, one average may describe nobody well.

Example:

If runtime has two peaks, maybe small jobs and large jobs are mixed together. The answer is not one average. The answer is to split the groups.

---

## Probability

Analogy: "A long-run bet"

Probability describes how often something would happen in the long run under the same conditions.

If a fair coin has probability 0.5 of heads, it does not mean every 10 flips will give exactly 5 heads.

It means that over many flips, the proportion should move toward 0.5.

Mnemonic:

> Probability is not a promise. It is a long-run pattern.

Practical note:

Small samples can look weird even when nothing unusual is happening.

---

## Odds vs Probability

Analogy: "Two ways to say chance"

Probability compares the event to all outcomes.

Odds compare the event to non-events.

Example:

If 1 out of 5 patients has a condition:

```text
Probability = 1 / 5 = 20%
Odds = 1 / 4
```

Mnemonic:

> Probability asks: out of all, how many? Odds ask: event versus not event.

Practical note:

Logistic regression often works with odds, not raw probability. This is why odds ratios show up so often in medical and epidemiological studies.

---

## Conditional Probability

Analogy: "What is the chance of rain, given clouds?"

Conditional probability means you are no longer asking about the whole world. You are asking inside a smaller condition.

```text
P(A | B) = P(A and B) / P(B)
```

Read it as:

```text
Probability of A, given B
```

Example:

You are not asking:

```text
What is the chance of rain?
```

You are asking:

```text
What is the chance of rain, given that it is cloudy?
```

Mnemonic:

> Given means filtered.

Practical note:

Many statistics mistakes come from ignoring the condition. The chance of disease in the general population is not the same as the chance of disease after a positive test.

---

## Independence

Analogy: "One event tells you nothing about the other"

Two events are independent if knowing one happened does not change the probability of the other.

```text
P(A | B) = P(A)
```

Example:

For a fair coin, the next flip does not care about the previous flip.

Mnemonic:

> Independent means no information gained.

Practical note:

Do not assume independence just because two variables look separate. In real data, hidden factors often connect them.

---

## Mutually Exclusive vs Independent

These are often confused.

Mutually exclusive means both events cannot happen at the same time.

Independent means one event does not change the chance of the other.

Example:

For one coin flip:

- Heads and tails are mutually exclusive.
- Heads and tails are not independent, because if you know it is heads, the chance of tails becomes zero.

Mnemonic:

> Exclusive means cannot both happen. Independent means does not matter.

Practical note:

Mutually exclusive events are usually dependent unless one event has probability zero.

---

## Law of Total Probability

Analogy: "Add up all the paths to the same result"

Sometimes an outcome can happen through different routes.

Example:

A patient can have a cough because of COVID, flu, allergy, or a cold.

The total chance of cough is the sum of each path:

```text
P(cough) = P(cough and COVID)
         + P(cough and flu)
         + P(cough and allergy)
         + P(cough and cold)
```

More generally:

```text
P(A) = P(A | B1)P(B1) + P(A | B2)P(B2) + ...
```

Mnemonic:

> Total chance equals all paths added up.

Practical note:

This is useful when you have subgroups. Always ask: are these groups complete and non-overlapping?

---

## Chain Rule of Probability

Analogy: "Build probability like Lego blocks"

For several events happening together, break the probability into steps.

Example:

You want the chance that:

1. Your alarm rings.
2. You wake up.
3. You leave on time.

```text
P(alarm, wake, leave)
= P(alarm) * P(wake | alarm) * P(leave | alarm, wake)
```

Mnemonic:

> Joint probability is step-by-step probability.

Practical note:

The chain rule is the backbone of many probabilistic models. It lets you break a large probability into smaller conditional pieces.

---

## Bayes' Theorem

Analogy: "Update your belief when new evidence arrives"

Bayes' theorem tells you how to update a prior belief using evidence.

```text
Posterior = Prior * Likelihood / Evidence
```

More formally:

```text
P(A | B) = P(B | A)P(A) / P(B)
```

Where:

| Term | Meaning |
|---|---|
| Prior | What you believed before the evidence |
| Likelihood | How expected the evidence is if the hypothesis is true |
| Evidence | How common the evidence is overall |
| Posterior | What you believe after seeing the evidence |

Mnemonic:

> Prior plus proof gives posterior.

Example:

You know rain is uncommon on most days.

But today it is cloudy.

Clouds are more common on rainy days than dry days, so your belief in rain increases.

Practical note:

Bayes is very useful when base rates matter. A rare disease can still be unlikely after a positive test if the test has many false positives.

---

## Base Rate Fallacy

Analogy: "Ignoring how rare the thing was before the test"

Suppose a disease is rare: 1 in 1,000 people.

A test is pretty good, but not perfect.

Even with a positive result, many positives may be false positives because the disease was rare to begin with.

Mnemonic:

> Rare things stay rare until the evidence is strong enough.

Practical note:

Always ask for the base rate before interpreting a test, alert, or model score.

This matters in medicine, fraud detection, security alerts, spam filters, and quality control.

---

## Common Distributions

A distribution describes how values are spread across possible outcomes.

Think of a distribution as the personality of randomness.

| Distribution | Memory trick | Use case |
|---|---|---|
| Bernoulli | One yes/no event | One coin flip, one success/failure |
| Binomial | Count successes | Number of heads in 20 flips |
| Normal | Bell-shaped noise | Heights, measurement error |
| Poisson | Count rare events over space/time | Mutations per region, calls per hour |
| Exponential | Waiting time | Time until next event |
| Uniform | Equal chance | Fair die, random number generator |
| Negative binomial | Overdispersed counts | RNA-seq count data |

Mnemonic:

> Pick the distribution that matches the story.

Practical note:

Do not force everything into a normal distribution. Count data, waiting times, and heavily skewed data often need different tools.

---

## Law of Large Numbers

Analogy: "More flips, more truth"

If you flip a coin 10 times, you might get 7 heads.

That does not prove the coin is unfair.

If you flip it 10,000 times, the proportion of heads should move closer to 50% if the coin is fair.

The law of large numbers says that as the number of trials grows, the sample average gets closer to the expected value.

Mnemonic:

> More trials, less drama.

Practical note:

This does not mean every short sequence will look balanced. Randomness can look very non-random in small samples.

---

## Central Limit Theorem

Analogy: "Averages smooth out the weirdness"

Individual data points can be messy.

But averages of many independent samples tend to behave more normally, even when the original data is not normal.

That is the central limit theorem.

Mnemonic:

> Chaos averages to calm.

Example:

One user's job runtime may be strange.

But the average runtime across many independent jobs is usually more stable and often closer to a bell-shaped distribution.

Practical note:

The central limit theorem applies to sample means, not necessarily to raw data. Your original data can stay skewed even when the mean becomes easier to model.

---

## Standard Error

Analogy: "How shaky is the estimate?"

Standard deviation tells you how spread out individual values are.

Standard error tells you how uncertain your estimate of the mean is.

```text
standard error = standard deviation / sqrt(sample size)
```

Mnemonic:

> SD is spread of data. SE is uncertainty of estimate.

Practical note:

Increasing sample size reduces standard error, but with diminishing returns. To cut standard error in half, you need about four times the sample size.

---

## Hypothesis Testing

Analogy: "A courtroom for data"

A hypothesis test asks whether the data is surprising under a default assumption.

The default assumption is the null hypothesis.

Example:

A new drug is tested.

- Null hypothesis: the drug has no effect.
- Alternative hypothesis: the drug has an effect.

You do not prove the alternative directly. You ask whether the data is unusual if the null were true.

Mnemonic:

> Start boring, then ask if the data is too weird.

Practical note:

A test result is not a complete answer. You still need effect size, uncertainty, study design, and domain knowledge.

---

## Type I and Type II Errors

Mnemonic:

> Alpha accuses. Beta blinds.

Type I error is a false positive.

You think something happened, but it did not.

Example: blaming an innocent person.

Type II error is a false negative.

Something real happened, but you missed it.

Example: letting a guilty person walk free.

| Error | Symbol | Meaning | Memory trick |
|---|---|---|---|
| Type I | alpha | False positive | Alpha accuses |
| Type II | beta | False negative | Beta blinds |

Practical note:

Which error is worse depends on context.

For a dangerous drug side effect, missing a real problem can be worse.

For a noisy alert system, too many false alarms can be worse.

---

## P-Value

Mnemonic:

> P means probability under the null.

A p-value tells you how likely it would be to get a result this extreme or more extreme if the null hypothesis were true.

In plain English:

> If the boring explanation were true, how surprising is this result?

Example:

```text
p = 0.03
```

This means:

```text
If the null hypothesis were true, results this extreme or more extreme would happen about 3% of the time.
```

What a p-value is not:

- It is not the probability that the null hypothesis is true.
- It is not the probability that your hypothesis is true.
- It is not the size of the effect.
- It is not proof that the result matters in practice.

Mnemonic:

> Low p means surprising under null, not automatically important.

Practical note:

A tiny p-value can happen with a tiny effect if the sample size is huge. Always check effect size.

---

## The 0.05 Rule

Analogy: "A conventional alarm threshold"

People often call a result statistically significant when:

```text
p < 0.05
```

This means the result would be relatively unusual under the null hypothesis.

But 0.05 is a convention, not a law of nature.

Mnemonic:

> 0.05 is a threshold, not a truth machine.

Practical note:

Do not treat p = 0.049 as magic and p = 0.051 as worthless. They are almost the same evidence.

---

## Confidence Intervals

Analogy: "A fishing net for the true value"

A confidence interval gives a range of plausible values for an unknown parameter.

Example:

```text
Average difference: 5 kg
95% confidence interval: 2 kg to 8 kg
```

This says the estimate is 5 kg, but the uncertainty range is from 2 kg to 8 kg.

Careful interpretation:

A 95% confidence interval means that if we repeated the same study many times, about 95% of intervals made this way would contain the true value.

It does not mean there is a 95% probability that this specific interval contains the true value in the frequentist interpretation.

Mnemonic:

> Confidence is about the method, not magic around one interval.

Practical note:

Wide interval: uncertain estimate.

Narrow interval: more precise estimate.

If the interval is narrow but centered around a useless effect, the result may still not matter.

---

## Effect Size

Analogy: "Statistical signal versus real-world importance"

A p-value asks:

```text
Is there evidence of a difference?
```

Effect size asks:

```text
How big is the difference?
```

Example:

A drug lowers blood pressure by 0.2 mmHg with p < 0.001.

That may be statistically significant but clinically useless.

Mnemonic:

> Significance says detectable. Effect size says meaningful.

Practical note:

Always report effect size with uncertainty. A result without magnitude is incomplete.

Common effect sizes:

| Situation | Effect size example |
|---|---|
| Difference between means | Mean difference, Cohen's d |
| Binary outcome | Risk ratio, odds ratio, risk difference |
| Correlation | Pearson r, Spearman rho |
| Model performance | AUC, F1, accuracy, RMSE |

---

## Power and Sample Size

Analogy: "The louder the signal, the easier it is to hear"

Power is the probability that a test detects a real effect.

```text
power = 1 - beta
```

Low power means you may miss real effects.

High power means you are more likely to detect them.

Power increases when:

- Sample size is larger.
- Effect size is larger.
- Noise is lower.
- Alpha threshold is looser.

Mnemonic:

> No power, no proof.

Practical note:

A non-significant result from a small study does not prove there is no effect. It may simply be underpowered.

---

## Multiple Testing

Analogy: "Buying more lottery tickets"

If you run one test at alpha = 0.05, your false positive risk is controlled for that one test.

If you run 1,000 tests, some small p-values will appear by chance.

This is a major issue in genomics, biomarker discovery, A/B testing, and high-dimensional data.

Common corrections:

| Method | Meaning | Personality |
|---|---|---|
| Bonferroni | Divide alpha by number of tests | Simple, strict, conservative |
| FDR | Control expected false discoveries among discoveries | More practical for many tests |
| q-value | FDR-adjusted significance measure | Common in genomics |

Mnemonic:

> More tests, more traps.

Practical note:

If you test many genes, variants, features, or metrics, do not interpret raw p-values alone.

---

## Confusion Matrix

Analogy: "A scoreboard for classification"

A confusion matrix compares predictions against reality.

| | Actual positive | Actual negative |
|---|---:|---:|
| Predicted positive | True positive (TP) | False positive (FP) |
| Predicted negative | False negative (FN) | True negative (TN) |

In plain English:

| Term | Meaning | Example in disease testing |
|---|---|---|
| True positive | Test says positive, and person truly has disease | Correctly detects disease |
| False positive | Test says positive, but person does not have disease | False alarm |
| False negative | Test says negative, but person has disease | Missed case |
| True negative | Test says negative, and person truly does not have disease | Correctly clears healthy person |

Mnemonic:

> Every classification metric comes from this table.

Practical note:

Before debating AUC, F1, sensitivity, specificity, precision, or recall, draw the confusion matrix. It makes the trade-offs obvious.

---

## Sensitivity, Recall, and True Positive Rate

Analogy: "How many real positives did we catch?"

Sensitivity, recall, and true positive rate usually mean the same thing.

They ask:

```text
Of all actual positives, how many did we correctly find?
```

Formula:

```text
Sensitivity = Recall = True positive rate = TP / (TP + FN)
```

Example:

If 100 people truly have COVID and the test catches 90:

```text
Sensitivity = 90 / 100 = 90%
```

Mnemonic:

> Sensitivity catches the sick.

Or:

> Recall remembers the real positives.

When sensitivity matters most:

- Infectious disease screening.
- Cancer screening.
- Safety monitoring.
- Fraud or security triage where missing a case is dangerous.
- Variant calling when you do not want to miss true variants.

Practical note:

High sensitivity means fewer false negatives.

But it does not mean positive results are always trustworthy. That is precision.

---

## Specificity and True Negative Rate

Analogy: "How many real negatives did we correctly clear?"

Specificity asks:

```text
Of all actual negatives, how many did we correctly mark negative?
```

Formula:

```text
Specificity = True negative rate = TN / (TN + FP)
```

Example:

If 900 people truly do not have COVID and the test correctly clears 855:

```text
Specificity = 855 / 900 = 95%
```

Mnemonic:

> Specificity clears the healthy.

When specificity matters most:

- Confirmatory testing.
- Legal or compliance flags.
- Expensive follow-up tests.
- High-stakes diagnosis where false positives cause harm.
- Quality control alerts where false alarms waste time.

Practical note:

High specificity means fewer false positives.

But it does not mean you caught most actual positives. That is sensitivity.

---

## Sensitivity vs Specificity

These two are easy to mix up.

Simple memory:

> Sensitivity looks at actual positives.
> Specificity looks at actual negatives.

Another memory:

> Sensitive tests are good at ruling OUT disease when negative.
> Specific tests are good at ruling IN disease when positive.

This is often remembered as:

```text
SNOUT: high SeNsitivity, Negative result rules OUT
SPIN: high SPecificity, Positive result rules IN
```

Example:

For a dangerous infectious disease, you may want high sensitivity first, because missing infected people is risky.

For confirming a diagnosis before harsh treatment, you may want high specificity, because false positives are costly.

Practical note:

Changing the decision threshold often trades sensitivity against specificity.

A lower threshold catches more positives but creates more false positives.

A higher threshold avoids false positives but misses more positives.

---

## False Positive Rate and False Negative Rate

These are the error versions of specificity and sensitivity.

False positive rate asks:

```text
Of all actual negatives, how many did we wrongly call positive?
```

Formula:

```text
False positive rate = FP / (FP + TN)
False positive rate = 1 - specificity
```

False negative rate asks:

```text
Of all actual positives, how many did we wrongly call negative?
```

Formula:

```text
False negative rate = FN / (FN + TP)
False negative rate = 1 - sensitivity
```

Mnemonic:

> False positive rate is false alarm rate.
> False negative rate is miss rate.

Practical note:

Do not say "false positive rate" when you mean "probability that a positive result is false." That second idea is related to precision and false discovery rate.

---

## Precision and Positive Predictive Value

Analogy: "When the model says positive, should I trust it?"

Precision asks:

```text
Of all predicted positives, how many were truly positive?
```

Formula:

```text
Precision = Positive predictive value = TP / (TP + FP)
```

Example:

If a model flags 100 samples as positive and only 25 are truly positive:

```text
Precision = 25 / 100 = 25%
```

Mnemonic:

> Precision means positive calls are precious.

Or:

> Precision trusts positives.

When precision matters most:

- Rare disease testing.
- Fraud detection.
- Spam detection.
- Security alerts.
- Manual review queues.
- Variant prioritization.

Practical note:

Precision depends heavily on prevalence.

If the thing you are looking for is rare, precision can be low even when sensitivity and specificity look good.

---

## Negative Predictive Value

Analogy: "When the test says negative, should I relax?"

Negative predictive value asks:

```text
Of all predicted negatives, how many were truly negative?
```

Formula:

```text
Negative predictive value = TN / (TN + FN)
```

Mnemonic:

> NPV trusts negatives.

Practical note:

Like precision, NPV depends on prevalence.

When a disease is very rare, NPV is often high because most people are truly negative anyway.

---

## Accuracy

Analogy: "How often was the model right overall?"

Accuracy asks:

```text
Of all predictions, how many were correct?
```

Formula:

```text
Accuracy = (TP + TN) / (TP + TN + FP + FN)
```

Mnemonic:

> Accuracy is overall correctness.

But be careful.

Example:

If only 1% of patients have a disease, a model that always says "no disease" gets 99% accuracy.

But it catches zero sick patients.

Practical note:

Accuracy can be misleading when classes are imbalanced.

For rare events, check precision, recall, specificity, F1, PR-AUC, and the confusion matrix.

---

## Balanced Accuracy

Analogy: "Accuracy that does not let the majority class dominate"

Balanced accuracy averages sensitivity and specificity.

Formula:

```text
Balanced accuracy = (sensitivity + specificity) / 2
```

Mnemonic:

> Balanced accuracy listens to both sides.

Practical note:

Balanced accuracy is useful when positive and negative classes are imbalanced.

---

## F1 Score

Analogy: "A compromise between finding positives and trusting positives"

F1 combines precision and recall into one number.

Formula:

```text
F1 = 2 * precision * recall / (precision + recall)
```

It is the harmonic mean, so it punishes imbalance.

Example:

If precision is high but recall is terrible, F1 will not be great.

If recall is high but precision is terrible, F1 will not be great either.

Mnemonic:

> F1 wants both: find positives and be right.

Practical note:

Use F1 when positive class performance matters and you need a single summary.

But do not hide the actual precision and recall. F1 alone can be vague.

---

## False Discovery Rate

Analogy: "Of the discoveries, how many are wrong?"

False discovery rate asks:

```text
Of all predicted positives, how many are false positives?
```

Formula:

```text
False discovery rate = FP / (TP + FP)
False discovery rate = 1 - precision
```

Mnemonic:

> FDR is the junk inside your discoveries.

Practical note:

This is extremely important in genomics and high-throughput screening.

If you test thousands of genes or variants, you need to control how many discoveries are likely false.

---

## A Small COVID Test Example

Suppose 1,000 people are tested.

100 truly have COVID.

900 truly do not.

The test has:

- 90% sensitivity.
- 95% specificity.

Confusion matrix:

| | Actual COVID | Actual no COVID |
|---|---:|---:|
| Test positive | 90 | 45 |
| Test negative | 10 | 855 |

Metrics:

```text
Sensitivity = 90 / (90 + 10) = 90%
Specificity = 855 / (855 + 45) = 95%
Precision = 90 / (90 + 45) = 66.7%
NPV = 855 / (855 + 10) = 98.8%
Accuracy = (90 + 855) / 1000 = 94.5%
```

What this teaches:

- Sensitivity tells you the test catches most infected people.
- Specificity tells you the test clears most uninfected people.
- Precision tells you only about two-thirds of positive results are true positives in this example.
- NPV tells you a negative result is very reassuring here.

Practical note:

If COVID prevalence changes, precision and NPV change too, even if sensitivity and specificity stay the same.

That is why base rate matters.

---

## Precision vs Recall

These two are also easy to mix up.

Recall asks:

```text
Did we find the real positives?
```

Precision asks:

```text
Can we trust the positive predictions?
```

Memory table:

| Metric | Denominator | Question |
|---|---|---|
| Recall / sensitivity | All actual positives | Did we catch them? |
| Precision / PPV | All predicted positives | Were our positive calls correct? |
| Specificity | All actual negatives | Did we clear negatives? |
| NPV | All predicted negatives | Were our negative calls correct? |

Mnemonic:

> Recall is about what reality had.
> Precision is about what you claimed.

Practical examples:

For cancer screening, recall matters because missing cancer is dangerous.

For a manual review queue, precision matters because every false alarm wastes human time.

For spam filtering, you may want high precision for marking spam, because sending a real email to spam is painful.

For search engines, recall means finding all relevant documents, while precision means the top results are actually relevant.

---

## Thresholds

Analogy: "Where do you draw the line?"

Many models output a score between 0 and 1.

Example:

```text
Predicted probability of disease = 0.72
```

You still need a threshold:

```text
If score >= 0.50, call positive.
If score < 0.50, call negative.
```

Changing the threshold changes the metrics.

Lower threshold:

- More positives found.
- Higher sensitivity / recall.
- More false positives.
- Lower specificity.
- Precision may fall.

Higher threshold:

- Fewer positive calls.
- Higher specificity.
- Fewer false positives.
- More false negatives.
- Sensitivity / recall may fall.

Mnemonic:

> Thresholds move the trade-off.

Practical note:

There is no universally best threshold. Choose based on cost.

Ask:

- Is a false negative worse?
- Is a false positive worse?
- How expensive is follow-up?
- How rare is the condition?
- How much human review capacity exists?

---

## ROC Curve and AUC

Analogy: "How good is your spam filter across thresholds?"

A classifier often gives a score, not just yes or no.

You choose a threshold.

A lower threshold catches more positives but creates more false positives.

A higher threshold reduces false positives but misses more true positives.

The ROC curve shows this trade-off across thresholds.

ROC plots:

```text
Y-axis: true positive rate = sensitivity
X-axis: false positive rate = 1 - specificity
```

AUC summarizes the curve:

| AUC | Meaning |
|---:|---|
| 1.0 | Perfect ranking |
| 0.5 | Random guessing |
| < 0.5 | Worse than random ranking |

Another useful interpretation:

> AUC is the chance that the model ranks a random positive example above a random negative example.

Mnemonic:

> Bigger area, better ranking.

Practical note:

ROC-AUC can look good on imbalanced data. For rare events, also check precision-recall curves.

---

## Precision-Recall Curve and PR-AUC

Analogy: "When positives are rare, focus on the positive calls"

A precision-recall curve shows how precision and recall trade off across thresholds.

It is especially useful when the positive class is rare.

PR curve plots:

```text
Y-axis: precision
X-axis: recall
```

Why it matters:

If only 1 in 1,000 samples is positive, a model can have a decent ROC-AUC while still producing too many false positives.

Precision-recall makes that pain visible.

Mnemonic:

> Rare positives need PR, not just ROC.

Practical note:

Use PR-AUC when you care about finding rare positives and false positives are costly.

Examples:

- Fraud detection.
- Rare disease screening.
- Pathogenic variant prioritization.
- Security alerts.
- Defect detection.

---

## Calibration

Analogy: "Does 70% really mean 70%?"

A model is calibrated if its predicted probabilities match reality.

Example:

Among all cases where the model says 70% risk, about 70% should truly be positive.

A model can rank well but be poorly calibrated.

Example:

It may put sick patients above healthy patients, but still overstate every risk score.

Mnemonic:

> Ranking asks who is higher. Calibration asks whether the number is honest.

Practical note:

AUC measures ranking, not calibration.

If you use predicted probabilities for decisions, risk estimates, clinical triage, or cost modeling, check calibration.

---

## Which Classification Metric Should I Use?

There is no single best metric.

Choose based on the mistake you fear most.

| Situation | Metric to watch | Why |
|---|---|---|
| Missing positives is dangerous | Sensitivity / recall | Reduce false negatives |
| False alarms are expensive | Specificity / precision | Reduce false positives |
| Positive class is rare | Precision, recall, PR-AUC | Accuracy and ROC-AUC can mislead |
| Classes are balanced | Accuracy may be okay | Overall correctness is meaningful |
| Both classes matter | Balanced accuracy | Does not let majority class dominate |
| Need one positive-class score | F1 | Combines precision and recall |
| Need ranking quality | ROC-AUC | Measures ordering across thresholds |
| Need reliable probabilities | Calibration | Checks if scores mean what they say |

Mnemonic:

> The best metric depends on the cost of being wrong.

Practical note:

Always include the confusion matrix. It prevents metric theater.

---

## Correlation

Analogy: "Two things moving together"

Correlation measures how two variables move together.

- Positive correlation: both tend to increase together.
- Negative correlation: one increases while the other decreases.
- Near zero correlation: no simple linear relationship.

Mnemonic:

> Correlation is co-movement.

Practical note:

Correlation mostly captures linear relationships. Two variables can have a strong non-linear relationship and still have low correlation.

---

## Pearson vs Spearman Correlation

Pearson correlation measures linear relationship.

Spearman correlation measures ranked relationship.

Example:

If y tends to increase when x increases, but not in a straight-line way, Spearman may capture the relationship better.

| Correlation | Good for | Sensitive to outliers? |
|---|---|---|
| Pearson | Linear relationships | Yes |
| Spearman | Monotonic ranked relationships | Less sensitive |

Mnemonic:

> Pearson likes lines. Spearman likes ranks.

Practical note:

Plot the data. A single correlation number can hide curves, clusters, and outliers.

---

## Correlation Is Not Causation

Analogy: "Ice cream and shark attacks"

Ice cream sales and shark attacks may both rise in summer.

That does not mean ice cream causes shark attacks.

The hidden cause is summer weather.

Mnemonic:

> Just because they dance together does not mean one leads.

Common hidden problems:

- Confounding variables.
- Reverse causality.
- Selection bias.
- Time trends.
- Data leakage.

Practical note:

To argue causation, you need stronger design: randomized experiments, natural experiments, causal models, or very careful observational analysis.

---

## Regression

Analogy: "Drawing the best simple explanation"

Regression models the relationship between an outcome and one or more predictors.

Simple linear regression:

```text
y = intercept + slope * x + error
```

The slope tells you how much y changes when x increases by one unit, on average.

Mnemonic:

> Regression estimates direction and size.

Practical note:

Regression is not automatically causal. A regression coefficient can be biased if important confounders are missing.

---

## Logistic Regression

Analogy: "Regression for yes/no outcomes"

Linear regression predicts a number.

Logistic regression predicts the probability of a binary outcome.

Examples:

- Disease or no disease.
- Spam or not spam.
- Churn or no churn.
- Pass or fail.

Mnemonic:

> Logistic regression turns evidence into probability.

Practical note:

Logistic regression coefficients are often interpreted through odds ratios. This is useful, but odds ratios can feel less intuitive than probabilities.

---

## Residuals

Analogy: "What the model failed to explain"

A residual is the difference between the observed value and the model prediction.

```text
residual = observed - predicted
```

Mnemonic:

> Residuals are leftovers.

Practical note:

Always inspect residuals. Patterns in residuals mean the model missed something.

Examples:

- Curved residual pattern: relationship may be nonlinear.
- Wider residual spread at high values: variance changes with scale.
- Huge residuals: possible outliers or bad data.

---

## Overfitting

Analogy: "Memorizing the practice exam"

A model overfits when it learns the noise in the training data instead of the real pattern.

It performs well on training data but badly on new data.

Mnemonic:

> Fit the pattern, not the noise.

Signs of overfitting:

- Training performance is much better than validation performance.
- Model is too complex for the amount of data.
- Results change a lot across samples.

Practical note:

Use train/test splits, cross-validation, regularization, and simple baselines.

---

## Bias and Variance

Analogy: "Archery target"

Bias means your arrows are consistently off-center.

Variance means your arrows are scattered everywhere.

A good model has both low bias and low variance.

Mnemonic:

> Bias misses the target. Variance misses consistency.

Practical note:

Very simple models may underfit because they have high bias.

Very complex models may overfit because they have high variance.

---

## Cross-Validation

Analogy: "Do not trust one practice exam"

Cross-validation splits data into multiple folds.

The model trains on some folds and validates on the remaining fold, repeated several times.

Mnemonic:

> Rotate the test seat.

Practical note:

Cross-validation gives a more stable estimate of model performance, especially when data is limited.

But it does not fix data leakage. If the same patient, sample, project, or family appears in both train and test folds, performance may look better than reality.

---

## Data Leakage

Analogy: "Peeking at the answer key"

Data leakage happens when information from the test set sneaks into training.

Examples:

- Scaling data before train/test split.
- Selecting features using all data before validation.
- Having duplicate samples across train and test.
- Using future information to predict the past.

Mnemonic:

> Leakage makes fake genius.

Practical note:

When performance looks too good, suspect leakage first.

---

## Hidden Markov Models

Analogy: "Guessing your roommate's mood from their actions"

In a hidden Markov model, there is a hidden state you cannot directly observe.

But you can observe signals produced by that state.

Example:

You cannot directly see your roommate's mood.

But you observe behavior:

- Singing.
- Sleeping.
- Eating quietly.
- Avoiding people.

From those observations, you infer the hidden mood over time.

Main parts:

| Part | Meaning |
|---|---|
| Hidden states | Unknown conditions |
| Observations | Visible signals |
| Transition probabilities | How states change over time |
| Emission probabilities | How states produce observations |

Mnemonic:

> Hidden cause, seen signs.

Practical note:

HMMs are useful when sequence matters: speech, genomics, weather states, user behavior, and time-series labeling.

---

## Markov Property

Analogy: "The next step depends on now, not the whole past"

The Markov property says the next state depends only on the current state, not the full history.

```text
P(next | current, past) = P(next | current)
```

Mnemonic:

> The present carries the past.

Practical note:

This is a simplifying assumption. It is not always true, but it makes many sequence models practical.

---

## Common Statistical Traps

### 1. Confusing p-value with truth

A p-value does not tell you the probability that your hypothesis is true.

### 2. Ignoring effect size

A result can be statistically significant but practically tiny.

### 3. Trusting averages too much

Averages can hide skew, outliers, and subgroups.

### 4. Forgetting base rates

A positive test does not mean much without knowing how common the condition is.

### 5. Running many tests without correction

More tests create more false positives.

### 6. Treating correlation as causation

Co-movement is not proof of cause.

### 7. Ignoring data quality

Bad data can make clean formulas produce clean nonsense.

### 8. Using accuracy on imbalanced data

A model can be 99% accurate and still miss every rare positive.

### 9. Reporting AUC only

AUC can hide poor calibration, poor threshold choice, or poor precision on rare positives.

### 10. Forgetting the cost of errors

A false positive and false negative are not equally bad in every domain.

Mnemonic:

> Clean math cannot save dirty data.

---

## One-Page Memory Table

| Concept | Memory phrase | Meaning |
|---|---|---|
| Population vs sample | Soup and spoon | Sample estimates population |
| Sampling bias | Bad spoon, bad soup judgment | Sample does not represent population |
| Mean | Balancing point | Average value |
| Median | Middle person | Robust center |
| Standard deviation | Spread you can read | Typical distance from mean |
| Percentile | Position in queue | Relative standing |
| Z-score | Universal ruler | Distance from mean in SD units |
| Robust z-score | Trust the middle | Outlier-resistant z-score |
| Conditional probability | Given means filtered | Probability inside a condition |
| Bayes | Prior plus proof | Update belief with evidence |
| Base rate | How rare before evidence | Background probability |
| Total probability | Add all paths | Sum routes to same outcome |
| Chain rule | Lego blocks | Build joint probability step by step |
| Law of large numbers | More trials, less drama | Average approaches expected value |
| Central limit theorem | Chaos averages to calm | Sample means become normal-like |
| Standard error | Shaky estimate | Uncertainty of the mean estimate |
| Type I error | Alpha accuses | False positive |
| Type II error | Beta blinds | False negative |
| Power | No power, no proof | Chance to detect a real effect |
| P-value | Probability under null | Surprise if null were true |
| Confidence interval | Fishing net | Plausible range from a repeatable method |
| Effect size | Meaningful size | How big the difference is |
| Sensitivity / recall | Catches the sick | True positive rate |
| Specificity | Clears the healthy | True negative rate |
| False positive rate | False alarm rate | 1 - specificity |
| False negative rate | Miss rate | 1 - sensitivity |
| Precision / PPV | Trusts positives | Correctness of positive calls |
| NPV | Trusts negatives | Correctness of negative calls |
| Accuracy | Overall correctness | Correct predictions among all predictions |
| Balanced accuracy | Listens to both sides | Average of sensitivity and specificity |
| F1 | Wants both | Harmonic mean of precision and recall |
| FDR | Junk in discoveries | 1 - precision |
| ROC-AUC | Bigger area, better ranking | Ranking quality across thresholds |
| PR-AUC | Rare positives need PR | Precision-recall performance |
| Calibration | Is the number honest? | Predicted probabilities match reality |
| Correlation | Co-movement | Variables move together |
| Regression | Direction and size | Estimate relationship |
| Residual | Leftovers | What the model failed to explain |
| Overfitting | Memorizing noise | Great training, weak generalization |
| Data leakage | Peeking at answers | Test information leaks into training |
| HMM | Hidden cause, seen signs | Infer hidden states from observations |

---

## Quick Formula Sheet

Classification metrics:

```text
Sensitivity / Recall / TPR = TP / (TP + FN)
Specificity / TNR          = TN / (TN + FP)
False positive rate        = FP / (FP + TN) = 1 - specificity
False negative rate        = FN / (FN + TP) = 1 - sensitivity
Precision / PPV            = TP / (TP + FP)
Negative predictive value  = TN / (TN + FN)
Accuracy                   = (TP + TN) / (TP + TN + FP + FN)
Balanced accuracy          = (sensitivity + specificity) / 2
F1 score                   = 2 * precision * recall / (precision + recall)
False discovery rate       = FP / (TP + FP) = 1 - precision
```

Probability basics:

```text
P(A | B) = P(A and B) / P(B)
P(A and B) = P(A | B)P(B)
P(A) = P(A | B1)P(B1) + P(A | B2)P(B2) + ...
P(A | B) = P(B | A)P(A) / P(B)
```

Estimation basics:

```text
standard error = standard deviation / sqrt(sample size)
z = (value - mean) / standard deviation
robust z = 0.6745 * (value - median) / MAD
power = 1 - beta
```

---

## Final Thoughts

You do not need to be a math genius to understand statistics.

You need the right mental hooks.

The formulas matter, but they are easier to remember when the idea already makes sense.

Start with the story:

- What is being measured?
- What is uncertain?
- What would happen by chance?
- How big is the effect?
- What mistake would hurt more: false positive or false negative?
- Is the model finding positives, or just looking accurate because positives are rare?
- How much should we trust the estimate?

Statistics is not just about numbers.

It is a way to think clearly when the truth is noisy.
