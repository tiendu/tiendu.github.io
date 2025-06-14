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

# ---- 4. Set Up Output ----
frame_dir = "svm_moons_frames"
os.makedirs(frame_dir, exist_ok=True)
gif_path = "svm_moons_margin_evolution.gif"
frames = []
C_values = np.logspace(-2, 2, 20)

# ---- 5. Training & Plotting Loop ----
for idx, C in enumerate(C_values):
    clf = SVC(kernel='rbf', C=C, gamma='scale')
    clf.fit(X_train, y_train)

    Z = clf.decision_function(np.c_[xx.ravel(), yy.ravel()])
    Z = Z.reshape(xx.shape)

    # Plot
    plt.figure(figsize=(6, 5))
    
    # Contour: margin (-1, +1) and decision boundary (0)
    plt.contour(xx, yy, Z, levels=[-1, 0, 1], linestyles=['--', '-', '--'], colors='k')

    # Background color
    plt.contourf(xx, yy, Z > 0, alpha=0.3, cmap=plt.cm.coolwarm)

    # Data points
    plt.scatter(X_train[:, 0], X_train[:, 1], c=y_train, cmap=plt.cm.coolwarm, edgecolors='k', s=30)

    # Support vectors
    plt.scatter(clf.support_vectors_[:, 0], clf.support_vectors_[:, 1],
                facecolors='none', edgecolors='k', s=80, linewidths=1.5, label='Support Vectors')

    # Legend explaining what’s what
    legend_elements = [
        Line2D([0], [0], color='k', linestyle='-', label='Decision Boundary'),
        Line2D([0], [0], color='k', linestyle='--', label='Margins (±1)'),
        Line2D([0], [0], marker='o', markerfacecolor='none', markeredgecolor='k',
               markersize=10, linestyle='None', label='Support Vectors')
    ]
    plt.legend(handles=legend_elements, loc="upper left")

    plt.title(f"SVM Margin Evolution (C = {C:.2f})")
    plt.xlabel("Feature 1")
    plt.ylabel("Feature 2")
    plt.tight_layout()

    fname = os.path.join(frame_dir, f"frame_{idx:02d}.png")
    plt.savefig(fname, dpi=100)
    frames.append(imageio.imread(fname))
    plt.close()

    print(f"=== Frame {idx+1}/{len(C_values)} saved")

# ---- 6. Create GIF ----
imageio.mimsave(gif_path, frames, fps=3)
print(f"\n=== GIF saved as: {gif_path}")

# ---- 7. Optional Cleanup ----
# import shutil
# shutil.rmtree(frame_dir)

