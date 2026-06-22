import numpy as np
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import imageio.v2 as imageio
import os
from sklearn.datasets import make_moons
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ---- 1. Generate & Scale Data ----
X, y = make_moons(n_samples=300, noise=0.2, random_state=42)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ---- 2. Train/Test Split ----
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.3, random_state=42)

# ---- 3. Prepare Meshgrid ----
h = 0.02
x_min, x_max = X_train[:, 0].min() - 1, X_train[:, 0].max() + 1
y_min, y_max = X_train[:, 1].min() - 1, X_train[:, 1].max() + 1
xx, yy = np.meshgrid(np.arange(x_min, x_max, h),
                     np.arange(y_min, y_max, h))

def make_gif(title_prefix, varying_param, values, fixed_C=None, fixed_gamma=None, out_dir="svm_frames", out_gif="output.gif"):
    os.makedirs(out_dir, exist_ok=True)
    frames = []

    for idx, val in enumerate(values):
        C = fixed_C if fixed_C is not None else val
        gamma = fixed_gamma if fixed_gamma is not None else val

        clf = SVC(kernel='rbf', C=C, gamma=gamma)
        clf.fit(X_train, y_train)

        Z = clf.decision_function(np.c_[xx.ravel(), yy.ravel()])
        Z = Z.reshape(xx.shape)

        plt.figure(figsize=(6, 5))
        plt.contour(xx, yy, Z, levels=[-1, 0, 1], linestyles=['--', '-', '--'], colors='k')
        plt.contourf(xx, yy, Z > 0, alpha=0.3, cmap=plt.cm.coolwarm)
        plt.scatter(X_train[:, 0], X_train[:, 1], c=y_train, cmap=plt.cm.coolwarm, edgecolors='k', s=30)
        plt.scatter(clf.support_vectors_[:, 0], clf.support_vectors_[:, 1],
                    facecolors='none', edgecolors='k', s=80, linewidths=1.5)

        legend_elements = [
            Line2D([0], [0], color='k', linestyle='-', label='Decision Boundary'),
            Line2D([0], [0], color='k', linestyle='--', label='Margins (±1)'),
            Line2D([0], [0], marker='o', markerfacecolor='none', markeredgecolor='k',
                   markersize=10, linestyle='None', label='Support Vectors')
        ]
        plt.legend(handles=legend_elements, loc="upper left")

        var_label = f"{varying_param} = {val:.2e}" if varying_param == "gamma" else f"{varying_param} = {val:.2f}"
        plt.title(f"{title_prefix} ({var_label})")
        plt.xlabel("Feature 1")
        plt.ylabel("Feature 2")
        plt.tight_layout()

        fname = os.path.join(out_dir, f"frame_{idx:02d}.png")
        plt.savefig(fname, dpi=100)
        frames.append(imageio.imread(fname))
        plt.close()

        print(f"[{title_prefix}] Frame {idx+1}/{len(values)} saved")

    imageio.mimsave(out_gif, frames, fps=3, loop=0)
    print(f"\n=== GIF saved as: {out_gif}")

# ---- 4. Generate Both GIFs ----

# A. Fixed gamma, sweep C
make_gif(
    title_prefix="SVM Margin Evolution",
    varying_param="C",
    values=np.logspace(-2, 2, 20),
    fixed_gamma='scale',
    out_dir="svm_moons_C_frames",
    out_gif="svm_moons_C_evolution.gif"
)

# B. Fixed C, sweep gamma
make_gif(
    title_prefix="SVM Margin Evolution",
    varying_param="gamma",
    values=np.logspace(-2, 2, 20),
    fixed_C=1.0,
    out_dir="svm_moons_gamma_frames",
    out_gif="svm_moons_gamma_evolution.gif"
)

