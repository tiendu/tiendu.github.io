import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split

# -----------------------------
# 1) Synthetic heteroscedastic data
# -----------------------------
rng = np.random.default_rng(0)

def f(x):
    return 2 * x * np.sin(x) + 10

def make_data(n=1800):
    X = rng.uniform(0, 10, size=n)
    noise_sd = 0.5 + 0.5 * X   # noise grows with x
    y = f(X) + rng.normal(0, noise_sd, size=n)
    return X.reshape(-1, 1), y

X, y = make_data()

# Train / calib / test split
X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.30, random_state=0)
X_train, X_cal,  y_train, y_cal  = train_test_split(X_tmp, y_tmp, test_size=0.35, random_state=0)

alpha = 0.10  # target miscoverage, so 90% target coverage
q_low = alpha / 2
q_high = 1 - alpha / 2

# -----------------------------
# 2) Fit models: CQR (quantile) + baseline (mean)
# -----------------------------
low_model = GradientBoostingRegressor(loss="quantile", alpha=q_low, random_state=0)
high_model = GradientBoostingRegressor(loss="quantile", alpha=q_high, random_state=0)
mean_model = GradientBoostingRegressor(random_state=0)

low_model.fit(X_train, y_train)
high_model.fit(X_train, y_train)
mean_model.fit(X_train, y_train)

# -----------------------------
# 3) Conformal calibration for CQR
#    score_i = max(q_low(x_i)-y_i, y_i-q_high(x_i))
#    qhat is the (1-alpha) empirical quantile with finite-sample index
# -----------------------------
lo_cal = low_model.predict(X_cal)
hi_cal = high_model.predict(X_cal)

# guard against crossing
lo_cal, hi_cal = np.minimum(lo_cal, hi_cal), np.maximum(lo_cal, hi_cal)

scores = np.maximum(lo_cal - y_cal, y_cal - hi_cal)  # >= 0 if outside; <=0 if inside (often <=0)
scores_sorted = np.sort(scores)

n_cal = len(scores_sorted)
k = int(np.ceil((n_cal + 1) * (1 - alpha))) - 1  # finite-sample conformal index
k = np.clip(k, 0, n_cal - 1)
qhat = scores_sorted[k]

# CQR intervals on test
lo_test_raw = low_model.predict(X_test)
hi_test_raw = high_model.predict(X_test)
lo_test_raw, hi_test_raw = np.minimum(lo_test_raw, hi_test_raw), np.maximum(lo_test_raw, hi_test_raw)

lo_test_cqr = lo_test_raw - qhat
hi_test_cqr = hi_test_raw + qhat

# -----------------------------
# 4) Fixed-width baseline from calibration residuals
#    Use mean model, compute half-width = (1-alpha) quantile of |residual|
# -----------------------------
mu_cal = mean_model.predict(X_cal)
abs_res = np.abs(y_cal - mu_cal)
half_width = np.quantile(abs_res, 1 - alpha)

mu_test = mean_model.predict(X_test)
lo_test_fix = mu_test - half_width
hi_test_fix = mu_test + half_width

# -----------------------------
# 5) Sliding-window local coverage on test set
# -----------------------------
x_test = X_test[:, 0]

def local_coverage(x0, window):
    mask = (x_test >= x0 - window) & (x_test <= x0 + window)
    if mask.sum() < 10:  # avoid noisy estimates when few points
        return np.nan, np.nan, mask.sum()
    y_w = y_test[mask]

    cqr_cov = np.mean((y_w >= lo_test_cqr[mask]) & (y_w <= hi_test_cqr[mask]))
    fix_cov = np.mean((y_w >= lo_test_fix[mask]) & (y_w <= hi_test_fix[mask]))
    return cqr_cov, fix_cov, mask.sum()

# Precompute a smooth x-grid for plotting interval curves
x_grid = np.linspace(0, 10, 400)
Xg = x_grid.reshape(-1, 1)

# Curves for visual context (optional but nice)
mu_g = mean_model.predict(Xg)
lo_g_fix, hi_g_fix = mu_g - half_width, mu_g + half_width

lo_g_raw = low_model.predict(Xg)
hi_g_raw = high_model.predict(Xg)
lo_g_raw, hi_g_raw = np.minimum(lo_g_raw, hi_g_raw), np.maximum(lo_g_raw, hi_g_raw)
lo_g_cqr, hi_g_cqr = lo_g_raw - qhat, hi_g_raw + qhat

# -----------------------------
# 6) Animate: window slides across x, show local coverage
# -----------------------------
window = 0.6  # half-window width in x units (tune this)
frames = 80
xs = np.linspace(x_grid.min() + window, x_grid.max() - window, frames)

fig, ax = plt.subplots(figsize=(9, 4.5))

def fmt_cov(x):
    if np.isnan(x):
        return "NA"
    return f"{x*100:.1f}%"

def update(i):
    ax.clear()
    x0 = xs[i]

    # scatter test points for context
    ax.scatter(x_test, y_test, s=8, alpha=0.25, label="test points")

    # interval curves
    ax.plot(x_grid, lo_g_cqr, label="CQR lower")
    ax.plot(x_grid, hi_g_cqr, label="CQR upper")
    ax.plot(x_grid, lo_g_fix, linestyle="--", label="fixed-width lower")
    ax.plot(x_grid, hi_g_fix, linestyle="--", label="fixed-width upper")

    # window highlight
    ax.axvspan(x0 - window, x0 + window, alpha=0.15)
    cqr_cov, fix_cov, npts = local_coverage(x0, window)

    # annotation
    txt = (
        f"Sliding window: [{x0-window:.2f}, {x0+window:.2f}] (n={npts})\n"
        f"Local coverage (target={int((1-alpha)*100)}%): "
        f"CQR={fmt_cov(cqr_cov)} Fixed={fmt_cov(fix_cov)}\n"
        f"Conformal q_hat={qhat:.3f} Fixed half-width={half_width:.3f}"
    )
    ax.set_title("Local coverage via sliding window (CQR vs fixed-width)")
    ax.text(0.02, 0.98, txt, transform=ax.transAxes, va="top")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.legend(loc="lower left")
    ax.set_xlim(0, 10)

anim = FuncAnimation(fig, update, frames=frames, interval=120)

plt.tight_layout()
plt.show()

anim.save("local_coverage_cqr_vs_fixed.gif", writer=PillowWriter(fps=8))
