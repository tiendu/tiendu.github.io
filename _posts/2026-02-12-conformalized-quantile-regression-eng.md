---
date: 2026-02-12
layout: post
title: "Conformalized Quantile Regression (CQR): Prediction Intervals That Breathe With Your Data"
categories: ["Statistics and Probability"]
---

When we say a model is "confident," what do we actually mean?

In real data, confidence isn't a property of the model --- it's a
property of the neighborhood the model is standing in.

Some regions of the input space are calm: measurements are stable,
patterns repeat, error is small. Other regions are chaotic:
signal-to-noise collapses, variance explodes, and small shifts in input
swing the output wildly. If you've worked with single-cell data, you
already know this feeling: low-to-moderate expression behaves nicely,
then suddenly the high-expression regime turns into a fog of noise.

Yet we keep putting the same kind of uncertainty on everything.
One-size-fits-all error bars. A single global sigma. A clean-looking
confidence interval that stays the same thickness even when the data is
screaming "I'm not equally reliable everywhere."

That mismatch is expensive. It makes us over-trust predictions in noisy
regimes and over-cautious in clean regimes. It blurs decision
boundaries, hides failure modes, and turns downstream analysis into a
gamble.

What we actually want is simple:

**uncertainty that expands when the world gets messy, and tightens when
the world is predictable --- while still being statistically honest.**

That's what **Conformalized Quantile Regression (CQR)** gives you:
intervals that *breathe* with the data, plus a calibration step that
makes a concrete promise about coverage --- without assuming the noise
is Gaussian, homoscedastic, or even well-behaved.

---

## The problem: fixed-width uncertainty lies (quietly)

A lot of "uncertainty" in applied ML is either:

-   global (one number for all examples),
-   heuristic (e.g., bootstrap bands without guarantees), or
-   distribution-assuming (e.g., Gaussian residuals, constant variance).

But many real-world problems are **heteroscedastic**: the noise changes
across the feature space.

Examples:

-   Single-cell gene expression: variance increases with expression
    level.
-   Forecasting: error grows with horizon.
-   Medical prediction: uncertainty spikes for rare cohorts.

You don't want one interval width. You want intervals that adapt.

---

## The idea: quantiles + conformal calibration

CQR is a two-step pattern:

1.  Learn conditional quantiles.
2.  Conformalize using a calibration dataset to guarantee coverage.

The quantile model learns where uncertainty should expand or shrink.

Conformal calibration then adjusts the interval to make sure coverage is
statistically valid.

---

## Notes and gotchas

-   Quantile crossing can happen (lower \> upper). Guard against it.
-   Coverage is marginal, not conditional.
-   Data shift can break guarantees.

---

## Simple Python implementation

```python
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

### Where to go next

-   Use stronger quantile models.
-   Try cross-conformal (CV+) variants.
-   Evaluate coverage across subgroups.

CQR lets you say:

> "On future data drawn like this, my interval will contain the truth
> about 90% of the time."
