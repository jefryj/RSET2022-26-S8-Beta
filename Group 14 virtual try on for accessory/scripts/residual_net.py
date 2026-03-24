import torch

# -------------------------------------------------
# Build Affine Homography From Residual Vector
# -------------------------------------------------

def build_delta_homography(delta_h_params):
    """
    Convert 6 affine residual parameters into full 3x3 matrix.

    delta_h_params: (B, 6)
        [a, b, tx,
         c, d, ty]

    Returns:
        delta_H: (B, 3, 3)
    """

    batch_size = delta_h_params.size(0)

    # Identity baseline
    delta_H = torch.eye(3, device=delta_h_params.device) \
                    .unsqueeze(0) \
                    .repeat(batch_size, 1, 1)

    # Fill first two rows
    delta_H[:, :2, :3] += delta_h_params.view(batch_size, 2, 3)

    return delta_H


# -------------------------------------------------
# Confidence-Aware Blending
# -------------------------------------------------

def blend_homography(H0, delta_H, confidence):
    """
    Final homography blending:

        H_final = confidence * (delta_H @ H0)
                  + (1 - confidence) * H0

    Inputs:
        H0         : (B, 3, 3)
        delta_H    : (B, 3, 3)
        confidence : (B, 1)
    """

    H_refined = torch.matmul(delta_H, H0)

    c = confidence.view(-1, 1, 1)

    H_final = c * H_refined + (1.0 - c) * H0

    return H_final


# -------------------------------------------------
# Temporal Smoothing (Optional for Video)
# -------------------------------------------------

def temporal_smooth(H_prev, H_curr, alpha=0.8):
    """
    Exponential moving average smoothing.

    alpha closer to 1.0 → more stable
    """

    if H_prev is None:
        return H_curr

    return alpha * H_prev + (1.0 - alpha) * H_curr
