import json

with open("../datasets/face_glasses/train/trans_params.json") as f:
    data = json.load(f)

first_key = list(data.keys())[0]

print("First key:", first_key)
print("Content:", data[first_key])