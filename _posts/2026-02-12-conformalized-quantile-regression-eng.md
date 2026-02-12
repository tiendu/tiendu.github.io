---
date: 2026-02-12
layout: post
title: "Conformalized Quantile Regression (CQR): Prediction Intervals That Breathe With Your Data"
categories: ["Statistics and Probability"]
---

## Confidence is local, not global

When we say a model is "confident," what do we actually mean?

In practice, confidence isn't a property of the model itself --- it's a
property of the *region of the data space* the model is standing in.

Some regions are calm: measurements are stable, patterns repeat, and
predictions behave predictably. Other regions are chaotic:
signal-to-noise collapses, variance explodes, and small perturbations in
input produce wildly different outputs.

If you've worked with single-cell data, you've probably felt this
already. Low-to-moderate expression behaves nicely. Then suddenly,
high-expression regimes turn into a fog of noise.

Yet most pipelines still attach uncertainty as if the world were
uniform.

One global sigma. One fixed-width error bar. One confidence interval
that looks clean and reassuring --- even when the data itself is
screaming:

> "I am not equally reliable everywhere."

This mismatch matters. It leads us to over-trust predictions in noisy
regimes and under-utilize signal where the model is actually stable. It
hides failure modes and distorts downstream decisions.

What we actually want is simple:

**uncertainty that expands when reality becomes messy, and tightens when
reality becomes predictable --- while remaining statistically honest.**

That's where Conformalized Quantile Regression (CQR) enters.

---

## The hidden assumption behind most error bars

A surprising amount of applied ML still treats uncertainty as one of
three things:

-   a global number applied everywhere,
-   a heuristic visualization,
-   or a distributional assumption (usually Gaussian with constant
    variance).

But real-world systems are rarely homoscedastic.

Noise often grows with the signal itself.

Examples show up everywhere:

-   Single-cell gene expression: higher counts often mean higher
    variance.
-   Forecasting systems: uncertainty grows with time horizon.
-   Clinical models: rare cohorts behave differently from common ones.

A fixed-width interval assumes uncertainty is uniform. Reality
disagrees.

---

## Stop predicting points. Start predicting boundaries.

Instead of predicting only a point estimate, we can predict
*boundaries*.

The idea behind quantile regression is simple:

Rather than estimating:

    y = f(x)

we estimate:

    lower_bound(x)
    upper_bound(x)

These represent conditional quantiles --- for example, the 5th and 95th
percentiles.

Because they are learned independently, the width between them can vary
across the input space. Regions with more noise naturally produce wider
intervals.

The model begins to express something closer to local uncertainty.

But there's a catch.

Quantile regression alone does not guarantee that a "90% interval"
actually contains the truth 90% of the time.

That's where conformal prediction comes in.

---

## Calibration is where uncertainty becomes real

Conformal prediction treats calibration as an empirical correction step.

Instead of assuming the model is perfectly calibrated, we measure its
mistakes on a held-out dataset.

For each calibration example:

    score = max(q_low(x_i) - y_i, y_i - q_high(x_i))

This measures how far the true value falls outside the predicted
interval.

We then compute a correction factor `q_hat` and expand the interval:

    [q_low(x) - q_hat, q_high(x) + q_hat]

This single adjustment turns an adaptive but potentially miscalibrated
interval into one with finite-sample coverage guarantees --- without
assuming Gaussian noise or any specific distribution.

In other words:

-   quantile regression shapes the interval,
-   conformal calibration makes it trustworthy.

---

## What adaptive uncertainty actually looks like

Consider a toy dataset where noise increases with signal:

    X = Uniform(0, 10)
    signal = 2X sin(X) + 10
    noise_sd = 0.5 + 0.5 * X
    y = signal + Normal(0, noise_sd)

Low values are stable. High values become increasingly noisy.

When we apply CQR:

-   intervals remain tight where signal is reliable,
-   and widen into a "trumpet" shape where uncertainty grows.

This behavior isn't just aesthetically pleasing --- it matches how many
biological measurements behave.

---

## Where this changes real workflows

In single-cell workflows, uncertainty is everywhere:

-   gene expression modeling,
-   protein abundance prediction,
-   trajectory inference,
-   noisy experimental pipelines.

Static confidence intervals ignore biological heterogeneity.

Adaptive conformal intervals:

-   respect local variability,
-   remain statistically calibrated,
-   and avoid fragile distributional assumptions.

---

## Things that break if you ignore them

A few implementation realities matter:

-   Quantile models can cross (lower \> upper). Always guard against
    this.
-   Conformal guarantees are *marginal*, not conditional.
-   Distribution shift breaks promises --- recalibration is necessary
    when environments change.

Despite these caveats, CQR hits a rare engineering sweet spot:

-   simple,
-   model-agnostic,
-   theoretically grounded,
-   and practical to deploy.

---

## Minimal implementation

``` python
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split

def cqr_fit_predict_intervals(
    X_train, y_train,
    X_cal, y_cal,
    X_test,
    alpha=0.10,
    random_state=0
):
    q_low = alpha / 2
    q_high = 1 - alpha / 2

    low_model = GradientBoostingRegressor(
        loss="quantile", alpha=q_low, random_state=random_state
    )
    high_model = GradientBoostingRegressor(
        loss="quantile", alpha=q_high, random_state=random_state
    )

    low_model.fit(X_train, y_train)
    high_model.fit(X_train, y_train)

    low_cal = low_model.predict(X_cal)
    high_cal = high_model.predict(X_cal)

    lo = np.minimum(low_cal, high_cal)
    hi = np.maximum(low_cal, high_cal)

    scores = np.maximum(lo - y_cal, y_cal - hi)

    n = len(scores)
    k = int(np.ceil((n + 1) * (1 - alpha))) - 1
    k = np.clip(k, 0, n - 1)
    qhat = np.sort(scores)[k]

    low_test = low_model.predict(X_test)
    high_test = high_model.predict(X_test)
    lo_t = np.minimum(low_test, high_test)
    hi_t = np.maximum(low_test, high_test)

    lower = lo_t - qhat
    upper = hi_t + qhat
    return lower, upper, qhat
```

---

## Uncertainty should follow reality, not convenience

Most uncertainty estimation tries to make the world look simple.

CQR does the opposite.

It acknowledges that uncertainty is not uniform --- and then gives us a
way to express that reality without sacrificing statistical guarantees.

Instead of forcing fixed error bars onto complex systems, we let
uncertainty move with the data.

And once you start thinking this way, it becomes hard to go back.> about 90% of the time."
