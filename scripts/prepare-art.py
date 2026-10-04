"""Prepare the designer's source art for the browser. Requires Pillow."""

from pathlib import Path
from io import BytesIO

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "2D Assets"
OUTPUT = ROOT / "public/assets/art"
OUTPUT.mkdir(parents=True, exist_ok=True)


def save_webp(image: Image.Image, name: str) -> None:
    buffer = BytesIO()
    image.save(buffer, format="WEBP", quality=90, method=6)
    target = OUTPUT / f"{name}.webp"
    temporary = target.with_suffix(".tmp")
    temporary.write_bytes(buffer.getvalue())
    temporary.replace(target)


for name, filename, color in [
    ("kitchen", "Kitchen Level.png", "#fff0cb"),
    ("dessert", "Dessert Level.png", "#f5d98d"),
]:
    original = Image.open(SOURCE / "Maps" / filename).convert("RGBA")
    background = Image.new("RGBA", original.size, color)
    background.alpha_composite(original)
    background = background.convert("RGB")
    size = (1024, round(background.height * 1024 / background.width))
    save_webp(background.resize(size, Image.Resampling.LANCZOS), f"map-{name}")
    # Show the start of each authored vertical map in the journey postcards.
    crop_height = round(background.width * 0.6)
    preview = background.crop(
        (0, background.height - crop_height, background.width, background.height)
    )
    save_webp(preview.resize((640, 384), Image.Resampling.LANCZOS), f"preview-{name}")

for index in range(1, 6):
    image = Image.open(SOURCE / "Pigeon" / f"PigeonFlight{index}.png").convert("RGBA")
    # A common canvas preserves body alignment through every wing position.
    frame = Image.new("RGBA", (625, 959))
    frame.alpha_composite(image)
    save_webp(frame.resize((128, 196), Image.Resampling.LANCZOS), f"pigeon-flight-{index}")

rest = Image.open(SOURCE / "Pigeon/PigeonRest.png").convert("RGBA")
save_webp(rest.crop(rest.getbbox()).resize((300, 293), Image.Resampling.LANCZOS), "pigeon-rest")
hero = Image.open(SOURCE / "Pigeon/PigeonFlight2.png").convert("RGBA")
hero = hero.crop(hero.getbbox())
save_webp(hero.resize((540, 640), Image.Resampling.LANCZOS), "pigeon-hero")

OBSTACLES = {
    "kitchen-pot-gold": "ObstaclesKitchen/DutchOven1.png",
    "kitchen-pot-red": "ObstaclesKitchen/DutchOven2.png",
    "kitchen-pot-brown": "ObstaclesKitchen/DutchOven3.png",
    "kitchen-pan-light": "ObstaclesKitchen/Pan 1.png",
    "kitchen-pan-dark": "ObstaclesKitchen/Pan2.png",
    "kitchen-knives": "ObstaclesKitchen/Knives.png",
    "kitchen-board": "ObstaclesKitchen/Cuttingboard.png",
    "kitchen-spatula": "ObstaclesKitchen/PizzaSpatula.png",
    "dessert-cactus-light": "ObstaclesDesert/Cactus1.png",
    "dessert-cactus-dark": "ObstaclesDesert/Cactus2.png",
    "dessert-rock-large": "ObstaclesDesert/DutchOven2.png",
    "dessert-rock-left": "ObstaclesDesert/DutchOven2_2.png",
    "dessert-rock-right": "ObstaclesDesert/DutchOven2_3.png",
}
for name, filename in OBSTACLES.items():
    image = Image.open(SOURCE / filename).convert("RGBA")
    image = image.crop(image.getbbox())
    image.thumbnail((320, 320), Image.Resampling.LANCZOS)
    save_webp(image, name)

images = list(OUTPUT.glob("*.webp"))
for path in images:
    with Image.open(path) as image:
        image.verify()
print(f"Prepared and verified {len(images)} images in {OUTPUT.relative_to(ROOT)}")
