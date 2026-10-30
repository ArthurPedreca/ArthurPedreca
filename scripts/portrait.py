# One-off: turns scripts/img/portrait.jpg into the character portrait the build draws.
# Run it again only when the photo changes:  python3 scripts/portrait.py
# Dark parts of the photo (hair, beard, sweater) become the dense characters, so the figure
# stands lit on the terminal's dark field, the way chafa or jp2a would print it.
import json
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

HERE = Path(__file__).parent
RAMP = " .:-=+*#%@"


def render(box, cols, rows):
    im = Image.open(HERE / "img" / "portrait.jpg").convert("L").crop(box)
    im = ImageOps.autocontrast(im, cutoff=1)
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=2))
    px = im.resize((cols, rows), Image.LANCZOS).load()
    out = []
    for y in range(rows):
        row = ""
        for x in range(cols):
            i = min(len(RAMP) - 1, int((1 - px[x, y] / 255) * len(RAMP)))
            row += " " if i < 2 else RAMP[i]  # drop the faint wall texture
        out.append(row.rstrip())
    return out


art = {
    "wide": render((20, 0, 380, 330), 74, 40),
    "narrow": render((30, 0, 370, 330), 40, 23),
}
(HERE / "portrait.json").write_text(json.dumps(art, indent=0))
print({k: (max(len(r) for r in v), len(v)) for k, v in art.items()})
