# -*- coding: utf-8 -*-
"""Build a 9:16 CantoBuddy promo video from real app screenshots.

Pipeline: compose each frame with Pillow (phone mockup + animated captions +
Ken Burns + crossfades), write JPEG frames, synthesize a soft soundtrack, then
encode with ffmpeg. No stock footage, no video credits — the UI is the real app.
"""
import os, math, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H = 720, 1280
FPS = 30
ROOT = r"C:\Users\brenda\WorkBuddy AI\Canto Buddy\promo"
SHOTS = os.path.join(ROOT, "shots")
FRAMES = os.path.join(ROOT, "frames")
os.makedirs(FRAMES, exist_ok=True)

CORAL = (239, 77, 95)
CORAL_D = (206, 41, 68)
PEACH = (255, 214, 206)
INK = (28, 32, 42)
MUTED = (110, 116, 132)
WHITE = (255, 255, 255)
BG1 = (255, 251, 249)
BG2 = (255, 236, 232)

FD = r"C:\Windows\Fonts"
def F(name, size):
    return ImageFont.truetype(os.path.join(FD, name), size)

F_KICK  = F("segoeuib.ttf", 21)
F_TITLE = F("segoeuib.ttf", 43)
F_SUB   = F("segoeui.ttf", 26)
F_WORD  = F("seguibl.ttf", 56)
F_MARK  = F("seguibl.ttf", 62)
F_TAG   = F("segoeui.ttf", 28)
F_BIG   = F("seguibl.ttf", 62)
F_SMALL = F("segoeuisl.ttf", 21)
F_PILL  = F("segoeuib.ttf", 18)
F_ENDW  = F("segoeui.ttf", 26)


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def vgrad(top, bot):
    y = np.linspace(0, 1, H)[:, None, None]
    arr = (np.array(top) * (1 - y) + np.array(bot) * y).astype(np.uint8)
    return Image.fromarray(np.repeat(arr, W, axis=1), "RGB")


def diag(c1, c2):
    yy, xx = np.mgrid[0:H, 0:W]
    t = ((xx / W) + (yy / H)) / 2
    arr = (np.array(c1) * (1 - t[..., None]) + np.array(c2) * t[..., None]).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def blob(img, cx, cy, r, color, alpha):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.6))
    return Image.alpha_composite(img.convert("RGBA"), layer)


def rmask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


PW, PH = 404, 876
BEZEL = 8
PAD = 52
CANVAS_W, CANVAS_H = PW + 2 * PAD, PH + 2 * PAD
PHONE_POS = ((W - CANVAS_W) // 2, 100)
KICK_Y, TITLE_Y, SUB_Y = 66, 1062, 1116


def build_phone(shot):
    sw, sh = PW - 2 * BEZEL, PH - 2 * BEZEL
    im = Image.open(os.path.join(SHOTS, shot)).convert("RGB")
    im = ImageOps.fit(im, (sw, sh), Image.LANCZOS)
    # Fade the bottom of the screen to white to hide the in-app notification
    # prompt that otherwise sits across every page.
    fh = int(sh * 0.10)
    col = np.array([255 * (y / (fh - 1)) ** 1.5 for y in range(fh)]).astype(np.uint8)
    grad = Image.fromarray(np.repeat(col[:, None], sw, axis=1), "L")
    white = Image.new("RGB", (sw, fh), (255, 255, 255))
    band = im.crop((0, sh - fh, sw, sh))
    im.paste(Image.composite(white, band, grad), (0, sh - fh))

    screen = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    screen.paste(im, (0, 0), rmask((sw, sh), 30))

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [PAD + 4, PAD + 18, PAD + PW - 4, PAD + PH + 18], radius=46, fill=(24, 20, 34, 96))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))
    body = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle([PAD, PAD, PAD + PW - 1, PAD + PH - 1], radius=46, fill=(255, 255, 255, 255))
    canvas.alpha_composite(body)
    canvas.alpha_composite(screen, (PAD + BEZEL, PAD + BEZEL))
    return canvas


def tracked(d, cx, y, text, fnt, fill, tracking=3):
    widths = [d.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=fnt, fill=fill)
        x += w + tracking


# ------------------------------------------------------------------ scenes
SCENES = [
    dict(key="intro", dur=2.9),
    dict(key="content", dur=3.2, shot="home.png", kicker="EVERYTHING IN ONE APP",
         title="One app for daily life",
         sub=["Learn Cantonese, follow Hong Kong life,", "and play together — free for helpers."]),
    dict(key="content", dur=3.0, shot="learn.png", kicker="LEARN",
         title="Real Cantonese, step by step",
         sub=["334 practical words · 24 categories", "with audio, pictures and quizzes."]),
    dict(key="content", dur=3.0, shot="discover.png", kicker="DISCOVER",
         title="Hong Kong life & news",
         sub=["Culture, news and stories from home —", "in English, Filipino and Bahasa."]),
    dict(key="content", dur=3.2, shot="games.png", kicker="PLAY TOGETHER",
         title="Four games, one link",
         sub=["UNO · Big Two · Word Match · Sudoku", "No account, no install — just a room code."]),
    dict(key="content", dur=3.0, shot="sudoku.png", kicker="MADE FOR FAMILY",
         title="Play with the people you love",
         sub=["Pick an avatar, share the code,", "and race the same puzzle together."]),
    dict(key="end", dur=3.7),
]
XFADE = 0.5

# precompute backgrounds + phones
bg_light = blob(blob(vgrad(BG1, BG2), 620, 170, 230, CORAL, 26), 90, 1120, 260, PEACH, 34).convert("RGBA")
bg_coral = blob(diag((255, 120, 132), CORAL_D), 120, 210, 320, WHITE, 26).convert("RGBA")
for sc in SCENES:
    if sc["key"] == "content":
        sc["bg"] = bg_light.copy()
        sc["phone"] = build_phone(sc["shot"])
    elif sc["key"] == "intro":
        sc["bg"] = bg_coral.copy()
    else:
        sc["bg"] = bg_coral.copy()


def render_content(sc, t):
    base = sc["bg"].copy()
    z = 1.0 + 0.05 * (t / sc["dur"])
    ph = sc["phone"]
    cw, chh = ph.size
    zw, zh = int(cw / z), int(chh / z)
    cx, cy = cw // 2, chh // 2
    crop = ph.crop((cx - zw // 2, cy - zh // 2, cx + zw // 2, cy + zh // 2)).resize((cw, chh), Image.LANCZOS)
    base.alpha_composite(crop, PHONE_POS)

    a = ease((t - 0.06) / 0.5)
    if a > 0:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        al = int(255 * a)
        slide = (1 - a) * 24
        tracked(d, W // 2, KICK_Y + slide, sc["kicker"], F_KICK, (*CORAL, al), 3)
        d.text((W // 2, TITLE_Y + slide), sc["title"], font=F_TITLE, fill=(*INK, al), anchor="ma")
        for i, line in enumerate(sc["sub"]):
            d.text((W // 2, SUB_Y + i * 37 + slide), line, font=F_SUB, fill=(*MUTED, al), anchor="ma")
        base.alpha_composite(layer)
    return base


def render_intro(sc, t):
    base = sc["bg"].copy()
    a = ease(t / 0.6)
    al = int(255 * a)
    d = ImageDraw.Draw(base)
    # pill — solid white with coral text so it reads on the coral background
    pt = "FREE FOR HELPERS"
    tw = d.textlength(pt, font=F_PILL)
    d.rounded_rectangle([W // 2 - tw / 2 - 22, 206, W // 2 + tw / 2 + 22, 246], radius=20,
                        fill=(255, 255, 255, al))
    d.text((W // 2, 226), pt, font=F_PILL, fill=(*CORAL, al), anchor="mm")
    # mark
    ms = 104
    mx, my = W // 2 - ms // 2, 306
    d.rounded_rectangle([mx, my, mx + ms, my + ms], radius=28, fill=(255, 255, 255, al))
    d.text((W // 2, my + ms // 2 + 2), "C", font=F_MARK, fill=(*CORAL, al), anchor="mm")
    # wordmark + tagline + pillars
    d.text((W // 2, 462), "CantoBuddy", font=F_WORD, fill=(255, 255, 255, al), anchor="ma")
    d.text((W // 2, 552), "Learn Cantonese", font=F_TAG, fill=(255, 242, 239, int(242 * a)), anchor="ma")
    d.text((W // 2, 592), "for daily life in Hong Kong", font=F_TAG, fill=(255, 242, 239, int(242 * a)), anchor="ma")
    d.text((W // 2, 686), "Learn  ·  Discover  ·  Play together", font=F_ENDW,
           fill=(255, 238, 235, int(220 * a)), anchor="ma")
    d.text((W // 2, 1120), "cantobuddy.com", font=F_SMALL, fill=(255, 236, 233, int(210 * a)), anchor="ma")
    return base


def render_end(sc, t):
    base = sc["bg"].copy()
    a = ease(t / 0.6)
    al = int(255 * a)
    d = ImageDraw.Draw(base)
    pt = "FREE FOR HELPERS"
    tw = d.textlength(pt, font=F_PILL)
    d.rounded_rectangle([W // 2 - tw / 2 - 22, 396, W // 2 + tw / 2 + 22, 436], radius=20,
                        fill=(255, 255, 255, al))
    d.text((W // 2, 416), pt, font=F_PILL, fill=(*CORAL, al), anchor="mm")
    d.text((W // 2, 486), "cantobuddy.com", font=F_BIG, fill=(255, 255, 255, al), anchor="ma")
    d.text((W // 2, 606), "Learn · Discover · Play together", font=F_TAG,
           fill=(255, 240, 237, int(240 * a)), anchor="ma")
    d.text((W // 2, 1124), "CantoBuddy", font=F_ENDW, fill=(255, 236, 233, int(200 * a)), anchor="ma")
    return base


def render(sc, t):
    if sc["key"] == "intro":
        return render_intro(sc, t)
    if sc["key"] == "end":
        return render_end(sc, t)
    return render_content(sc, t)


# ------------------------------------------------------------------ timeline
timeline = []
clock = 0.0
for sc in SCENES:
    timeline.append((sc, clock, sc["dur"]))
    clock += sc["dur"]
TOTAL = clock
NFRAMES = int(round(TOTAL * FPS))


def frame_at(t):
    for i, (sc, st, du) in enumerate(timeline):
        if st <= t < st + du:
            local = t - st
            if i > 0 and local < XFADE:
                prev, pst, pdu = timeline[i - 1]
                A = render(prev, pdu - XFADE + local)
                B = render(sc, local)
                return Image.blend(A.convert("RGB"), B.convert("RGB"), local / XFADE)
            return render(sc, local).convert("RGB")
    return render(timeline[-1][0], timeline[-1][2]).convert("RGB")


print("total %.2fs, %d frames" % (TOTAL, NFRAMES))
for i in range(NFRAMES):
    frame_at(i / FPS).save(os.path.join(FRAMES, "f_%04d.jpg" % i), quality=91)
    if i % 90 == 0:
        print("  frame", i)
print("frames done")


# ------------------------------------------------------------------ music
def make_music(total, path):
    sr = 44100
    n = int(total * sr)
    out = np.zeros(n)
    bpm = 92.0
    beat = 60.0 / bpm
    bar = 4 * beat
    prog = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F

    def hz(m):
        return 440.0 * 2 ** ((m - 69) / 12.0)

    nbars = int(math.ceil(total / bar)) + 1
    for b in range(nbars):
        chord = prog[b % 4]
        s = int(b * bar * sr)
        e = min(n, s + int(bar * sr))
        if s >= n:
            break
        L = e - s
        seg = np.arange(L) / sr
        env = np.ones(L)
        att = min(int(0.45 * sr), L)
        rel = min(int(0.6 * sr), L)
        if att > 0:
            env[:att] = np.linspace(0, 1, att)
        if rel > 0:
            env[-rel:] = np.minimum(env[-rel:], np.linspace(1, 0, rel))
        for m in chord:  # warm pad
            f = hz(m)
            out[s:e] += 0.026 * env * (np.sin(2 * np.pi * f * seg) + 0.45 * np.sin(2 * np.pi * f * 1.004 * seg))
        out[s:e] += 0.05 * env * np.sin(2 * np.pi * hz(chord[0] - 12) * seg)  # bass
        for k in range(8):  # arpeggio
            ns = s + int(k * (bar / 8) * sr)
            if ns >= e:
                break
            L2 = min(int(0.5 * sr), n - ns)
            if L2 <= 0:
                break
            tt = np.arange(L2) / sr
            out[ns:ns + L2] += 0.033 * np.exp(-tt * 6) * np.sin(2 * np.pi * hz(chord[k % 3] + 12) * tt)
        for k in (0, 2):  # soft kick
            ns = s + int(k * beat * sr)
            L2 = min(int(0.22 * sr), n - ns)
            if L2 > 0:
                tt = np.arange(L2) / sr
                out[ns:ns + L2] += 0.12 * np.exp(-tt * 22) * np.sin(2 * np.pi * 58 * tt)

    fi, fo = int(0.8 * sr), int(1.6 * sr)
    out[:fi] *= np.linspace(0, 1, fi)
    out[-fo:] *= np.linspace(1, 0, fo)
    peak = np.max(np.abs(out)) or 1.0
    out = out / peak * 0.82
    d = int(0.006 * sr)
    right = np.concatenate([np.zeros(d), out[:-d]])
    st = np.stack([out, right], axis=1)
    pcm = np.clip(st * 32767, -32768, 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


make_music(TOTAL, os.path.join(ROOT, "music.wav"))
print("music done ->", TOTAL, "s")
