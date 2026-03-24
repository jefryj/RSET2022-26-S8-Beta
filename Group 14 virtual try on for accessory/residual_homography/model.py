import torch
import torch.nn as nn


class ResidualHomographyNet(nn.Module):

    def __init__(self):
        super().__init__()

        # -----------------------------
        # Feature extractor
        # -----------------------------
        self.features = nn.Sequential(

            nn.Conv2d(7, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(128, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(256, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),

            # Stabilizes training
            nn.Dropout2d(0.2),

            nn.AdaptiveAvgPool2d((7,7))
        )


        # -----------------------------
        # Regression head
        # -----------------------------
        self.regressor = nn.Sequential(

            nn.Flatten(),

            nn.Linear(256 * 7 * 7, 256),
            nn.ReLU(),
            nn.Dropout(0.4),

            nn.Linear(256, 64),
            nn.ReLU(),

            nn.Linear(64, 8)
        )


    def forward(self, x):

        x = self.features(x)

        x = self.regressor(x)

        # Keep offsets bounded
        x = torch.tanh(x)

        return x