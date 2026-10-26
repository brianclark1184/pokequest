"""Create and verify seven 100 x 150 mm thermal-printer QR labels."""
import json
from pathlib import Path
import subprocess

import fitz
from PIL import Image, ImageDraw
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
import zxingcpp

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf'
PREVIEW = ROOT / 'tmp' / 'pdfs'
PDF = OUT / 'pokequest-qr-labels-100x150mm.pdf'


def create():
    config = json.loads(subprocess.check_output(
        ['node', '-e', "console.log(JSON.stringify(require('./app.js').CONFIG))"],
        cwd=ROOT, text=True, encoding='utf-8'))
    # Match supplied artwork by decoded destination, rather than relying on filenames.
    qr_images = {}
    for path in (ROOT / 'assets' / 'qr').glob('*.png'):
        decoded = zxingcpp.read_barcodes(Image.open(path))
        if len(decoded) != 1:
            raise ValueError(f'Expected one readable QR in {path}')
        qr_images[decoded[0].text] = path
    labels = [('Start here', config['canonicalUrl'])] + [
        (item['displayName'], config['canonicalUrl'] + '?pokemon=' + item['id'])
        for item in config['pokemon']]
    assert len(labels) == 7
    for _, url in labels:
        assert url in qr_images, f'Missing QR image for {url}'

    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF), pagesize=(100 * mm, 150 * mm))
    c.setTitle('PokeQuest - Seven 100 x 150 mm QR Labels')
    c.setAuthor('PokeQuest')
    for i, (title, url) in enumerate(labels):
        c.setFillColorRGB(0, 0, 0)
        c.setFont('Helvetica-Bold', 16)
        c.drawCentredString(50 * mm, 136 * mm, 'PokéQuest')
        c.setFont('Helvetica-Bold', 27)
        c.drawCentredString(50 * mm, 120 * mm, title)
        # Full original image, including its white quiet zone, with no overlays.
        c.drawImage(str(qr_images[url]), 10 * mm, 33 * mm,
                    width=80 * mm, height=80 * mm, preserveAspectRatio=True,
                    anchor='c', mask='auto')
        c.linkURL(url, (10 * mm, 33 * mm, 90 * mm, 113 * mm), relative=0)
        c.setFont('Helvetica-Bold', 11)
        c.drawCentredString(50 * mm, 26 * mm, 'Open your Camera. Scan the code.')
        c.drawCentredString(50 * mm, 20 * mm, 'Tap the link to ' + ('start!' if i == 0 else 'collect!'))
        c.setFont('Helvetica', 10)
        c.drawCentredString(50 * mm, 9 * mm, 'Find any 4 of 6 Pokémon for prizes!')
        c.showPage()
    c.save()

    # Verify actual page dimensions, titles, and QR destinations after rendering.
    doc = fitz.open(PDF)
    assert len(doc) == 7
    thumbs = []
    for i, (page, (title, url)) in enumerate(zip(doc, labels)):
        assert abs(page.rect.width / mm - 100) < 0.01
        assert abs(page.rect.height / mm - 150) < 0.01
        assert title in page.get_text()
        pix = page.get_pixmap(dpi=200, colorspace=fitz.csRGB)
        img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        decoded = zxingcpp.read_barcodes(img)
        assert len(decoded) == 1 and decoded[0].text == url, (title, decoded)
        img.save(PREVIEW / f'qr-label-{i + 1}.png')
        img.thumbnail((300, 450))
        thumbs.append(img)
    sheet = Image.new('RGB', (4 * 320, 2 * 480), '#dddddd')
    draw = ImageDraw.Draw(sheet)
    for i, img in enumerate(thumbs):
        x, y = (i % 4) * 320 + 10, (i // 4) * 480 + 10
        sheet.paste(img, (x, y))
        draw.text((x, y + 452), f'Label {i + 1}', fill='black')
    sheet.save(PREVIEW / 'qr-labels-preview.png')
    print(f'Created {PDF}')
    print('Verified: 7 pages, each 100 x 150 mm; all 7 rendered QR destinations match config.')


if __name__ == '__main__':
    create()
