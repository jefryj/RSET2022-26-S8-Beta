from data_loader import ResidualHomographyDataset
import matplotlib.pyplot as plt

dataset = ResidualHomographyDataset(
    dataset_root="../datasets",
    split="train"
)

x, y = dataset[0]

print("Input shape:", x.shape)
print("Corner offsets:", y)

face = x[:3].permute(1,2,0).numpy()
acc = x[3:6].permute(1,2,0).numpy()
mask = x[6].numpy()

plt.subplot(131)
plt.title("Face")
plt.imshow(face)

plt.subplot(132)
plt.title("Warped Accessory")
plt.imshow(acc)

plt.subplot(133)
plt.title("Mask")
plt.imshow(mask,cmap="gray")

plt.show()