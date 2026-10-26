"""Regenerate the letter-size family flyer: python tools/create-flyer.py."""
from pathlib import Path

import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
OUT.mkdir(parents=True, exist_ok=True)
PDF = OUT / 'pokequest-family-flyer.pdf'
c = canvas.Canvas(str(PDF), pagesize=(612, 792))
c.setTitle('PokéQuest - Family Scavenger Hunt')
c.setAuthor('PokéQuest')
INK = '#241A3D'
PURPLE = '#6135A0'


def text(x, y, value, size=14, bold=False, color=INK, centered=False):
    c.setFillColor(HexColor(color))
    c.setFont('Helvetica-Bold' if bold else 'Helvetica', size)
    (c.drawCentredString if centered else c.drawString)(x, y, value)


def rounded(x, y, w, h, color, radius=16):
    c.setFillColor(HexColor(color))
    c.roundRect(x, y, w, h, radius, stroke=0, fill=1)


rounded(30, 564, 552, 198, '#F2ECFA', 22)
text(306, 732, 'TRUNK-OR-TREAT SCAVENGER HUNT', 12, True, PURPLE, True)
text(306, 678, 'PokéQuest', 49, True, INK, True)
text(306, 646, 'Find Pokémon. Earn prizes. Have fun!', 19, False, INK, True)
text(306, 606, 'ANY 4 OF 6 POKÉMON = A PRIZE FOR EACH CHILD', 13, True, PURPLE, True)

names = ['pikachu', 'gengar', 'charmander', 'bulbasaur', 'squirtle', 'zubat']
for i, name in enumerate(names):
    art = ImageReader(str(ROOT / 'assets' / 'pokemon' / f'{name}.webp'))
    c.drawImage(art, 42 + i * 89, 467, width=82, height=88,
                preserveAspectRatio=True, anchor='c', mask='auto')

text(42, 438, 'YOUR QUEST IN 3 EASY STEPS', 13, True, PURPLE)


def step(n, y, title, lines):
    rounded(42, y - 9, 34, 34, PURPLE, 17)
    text(59, y, str(n), 20, True, '#FFFFFF', True)
    text(90, y + 4, title, 20, True)
    for i, line in enumerate(lines):
        text(90, y - 21 - i * 20, line, 14)


step(1, 390, 'Scan to start', ['Use a parent\'s phone camera.', 'Tap the link. Set your child count', 'and tap Start.'])
step(2, 275, 'Go find Pokémon', ['Look for Pokémon QR signs.', 'Scan any 4 different Pokémon', 'with the same phone & browser.'])
step(3, 160, 'Get your prizes!', ['Return to the Pokémon Trunk.', 'Tap Show volunteer.', 'One prize per child!'])

rounded(357, 139, 219, 269, '#F2ECFA', 16)
text(466.5, 380, 'SCAN HERE TO START', 13, True, PURPLE, True)
# Preserve the supplied QR and its full white quiet zone; no decorations overlap it.
c.drawImage(str(ROOT / 'assets' / 'qr' / 'qr-pokequest.png'),
            358.5, 155, width=216, height=216)
c.linkURL('https://pokequest.fly.dev/', (358.5, 155, 574.5, 371), relative=0)
text(466.5, 119, 'pokequest.fly.dev', 13, True, INK, True)

c.setStrokeColor(HexColor('#DDD3E9'))
c.line(42, 81, 570, 81)
text(306, 59, 'One shared quest per family. No app download or account needed.', 12, False, INK, True)
text(306, 39, 'Missing your finds? Tap "Missing your Pokémon?" in the game.', 11, False, PURPLE, True)
c.showPage()
c.save()

# Render a review copy without needing an external PDF viewer.
doc = fitz.open(str(PDF))
assert len(doc) == 1
page = doc[0]
for phrase in ['Scan to start', 'Go find Pokémon', 'Get your prizes!', 'Show volunteer']:
    assert phrase in page.get_text(), phrase
preview = OUT / 'pokequest-family-flyer.png'
page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5)).save(str(preview))
print(f'Created {PDF}')
print(f'Rendered {preview}')
