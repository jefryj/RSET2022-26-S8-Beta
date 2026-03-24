import torch
import torch.nn as nn


class LGRWResidual3DNet(nn.Module):
    def __init__(self, in_channels=6):
        super().__init__()

        # -------------------------
        # Encoder
        # -------------------------
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),

            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),

            nn.AdaptiveAvgPool2d((4, 4))
        )

        # -------------------------
        # Fully Connected
        # -------------------------
        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4)
        )

        # -------------------------
        # Heads
        # -------------------------

        # Affine residual (6 params)
        self.delta_h_head = nn.Linear(512, 6)

        # Confidence head
        self.confidence_head = nn.Sequential(
            nn.Linear(512, 1),
            nn.Sigmoid()
        )

        self._init_weights()

    # -------------------------
    # Stable Initialization
    # -------------------------
    def _init_weights(self):
        nn.init.zeros_(self.delta_h_head.weight)
        nn.init.zeros_(self.delta_h_head.bias)

        nn.init.zeros_(self.confidence_head[0].weight)
        nn.init.constant_(self.confidence_head[0].bias, 0.0)

    # -------------------------
    # Forward
    # -------------------------
    def forward(self, x):

        features = self.encoder(x)
        features = self.fc(features)

        # Residual bounded to [-0.5, 0.5]
        delta_h = torch.tanh(self.delta_h_head(features)) * 0.5

        confidence = self.confidence_head(features)

        return delta_h, None, None, confidence
