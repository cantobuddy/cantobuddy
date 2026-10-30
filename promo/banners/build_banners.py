# -*- coding: utf-8 -*-
"""Generate Facebook group banners (1080x1080) as HTML and screenshot them with
headless Chrome. Text is rendered by the browser, so the Cantonese/Jyutping copy
and emoji are pixel-accurate (unlike AI image text)."""
import os, subprocess

ROOT = r"C:\Users\brenda\WorkBuddy AI\Canto Buddy\promo\banners"
os.makedirs(ROOT, exist_ok=True)
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

RESET = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;overflow:hidden;background:#fff}
body{font-family:'Segoe UI','Segoe UI Emoji',sans-serif;-webkit-font-smoothing:antialiased;color:#1c2029}
.stage{position:relative;width:1080px;height:1080px;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:76px 66px}
.emoji{font-family:'Segoe UI Emoji','Apple Color Emoji',sans-serif;line-height:1}
.head{font-family:'Arial Black','Segoe UI Black',sans-serif;font-weight:900;line-height:.98;letter-spacing:-1px}
.cta{display:inline-flex;align-items:center;gap:14px;background:#fff;color:#e63946;font-weight:900;font-size:42px;padding:22px 42px;border-radius:999px;box-shadow:0 20px 44px rgba(0,0,0,.22);letter-spacing:.3px}
.cta .dot{width:15px;height:15px;border-radius:50%;background:#25d366;display:inline-block}
.foot{margin-top:22px;font-size:24px;font-weight:600;opacity:.78;letter-spacing:.2px}
.mark{position:absolute;top:50px;left:52px;display:flex;align-items:center;gap:14px;font-weight:900;font-size:29px;z-index:5}
.mark .sq{width:60px;height:60px;border-radius:17px;background:#fff;color:#e63946;display:grid;place-items:center;font-size:36px;font-weight:900}
.free{position:absolute;top:48px;right:50px;transform:rotate(7deg);background:#ffd43b;color:#7a4b00;font-weight:900;font-size:25px;padding:12px 22px;border-radius:13px;box-shadow:0 10px 24px rgba(0,0,0,.18);letter-spacing:.5px;z-index:5}
"""


def page(css, body):
    return ("<!doctype html><html><head><meta charset='utf-8'><style>" + RESET + css +
            "</style></head><body>" + body + "</body></html>")


MARK = "<div class='mark'><span class='sq'>C</span><span>CantoBuddy</span></div>"
FREE = "<div class='free'>100% FREE</div>"

BANNERS = {}

# ---------------------------------------------------------------- 1. Ngo m ming
BANNERS["banner1_ngomming"] = page("""
.stage{background:linear-gradient(155deg,#ff8191 0%,#ef4d5f 52%,#d02f4a 100%);color:#fff}
.b1 .mark,.b1 .mark .sq{color:#fff}
.b1 .mark .sq{background:#fff;color:#e63946}
.emoji{font-size:132px;margin-bottom:6px}
.head{font-size:120px;margin-bottom:18px}
.sub{font-size:49px;font-weight:700;line-height:1.18;margin-bottom:22px}
.sub .m{font-size:52px}
.body{font-size:33px;line-height:1.4;opacity:.9;margin-bottom:34px}
.body b{opacity:1}
""", "<div class='stage b1'>" + MARK + FREE + """
  <div class='emoji'>😵‍💫</div>
  <div class='head'>“Ngo m ming…”</div>
  <div class='sub'>Still don’t understand<br>Madam’s Cantonese? <span class='m'>😅</span></div>
  <div class='body'>Learn the words you actually use —<br><b>free, no sign-up.</b></div>
  <div class='cta'><span class='dot'></span>cantobuddy.com</div>
  <div class='foot'>CantoBuddy · Learn Cantonese for daily life in Hong Kong</div>
</div>""")

# ---------------------------------------------------------------- 2. Soup
BANNERS["banner2_soup"] = page("""
.stage{background:radial-gradient(120% 90% at 50% 0%,#fff4dc 0%,#ffe3bd 55%,#ffcf9c 100%);color:#2a1c12}
.b2 .mark{color:#7a3b1d}
.b2 .mark .sq{background:#e63946;color:#fff}
.emoji{font-size:150px;margin-bottom:8px}
.head{font-size:72px;color:#3a2114;margin-bottom:22px;max-width:960px}
.sub{font-size:40px;font-weight:700;line-height:1.32;color:#6b4526;margin-bottom:34px;max-width:860px}
.cta{background:#e63946;color:#fff;box-shadow:0 20px 44px rgba(198,50,70,.35)}
.cta .dot{background:#fff}
.foot{color:#8a5a33}
""", "<div class='stage b2'>" + MARK + """
  <div class='free' style='background:#e63946;color:#fff'>FREE FOR HELPERS</div>
  <div class='emoji'>🍲</div>
  <div class='head'>Learn Cantonese<br>while the soup boils</div>
  <div class='sub'>5 minutes a day. Real words for the kitchen,<br>the market, and the kids.</div>
  <div class='cta'><span class='dot'></span>cantobuddy.com</div>
  <div class='foot'>CantoBuddy · 334 practical words, with audio</div>
</div>""")

# ---------------------------------------------------------------- 3. Meme 2-panel
BANNERS["banner3_meme"] = page("""
.stage{padding:0;justify-content:flex-start;background:#12131a;color:#fff}
.panels{display:grid;grid-template-columns:1fr 1fr;width:1080px;height:812px}
.panel{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:54px 44px;text-align:center}
.p-madam{background:linear-gradient(160deg,#ff7d8d,#e63946)}
.p-me{background:linear-gradient(160deg,#2a2d3a,#15161d)}
.plabel{font-family:'Arial Black',sans-serif;font-size:56px;letter-spacing:1px;margin-bottom:26px}
.p-madam .plabel{color:#fff}
.p-me .plabel{color:#ffd43b}
.phrase{font-size:34px;font-weight:800;line-height:1.5;margin:9px 0;padding:14px 20px;border-radius:16px;background:rgba(255,255,255,.16)}
.p-me .big{font-size:150px}
.p-me .me-txt{font-size:40px;font-weight:800;margin-top:16px;color:#cfd3e0}
.bar{height:268px;width:1080px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#1c2029}
.bar .t{font-size:44px;font-weight:900}
.bar .cta{background:#e63946;color:#fff;box-shadow:0 14px 30px rgba(230,57,70,.35);font-size:40px;padding:18px 38px}
""", """<div class='stage'>
  <div class='panels'>
    <div class='panel p-madam'>
      <div class='plabel'>MADAM:</div>
      <div class='phrase'>“m goi nei… sik jo faan mei aa?”</div>
      <div class='phrase'>“dim gaai gam gwai aa?”</div>
      <div class='phrase'>“tai siu siu zek gai aa!”</div>
    </div>
    <div class='panel p-me'>
      <div class='plabel'>ME:</div>
      <div class='emoji big'>😶‍🌫️</div>
      <div class='me-txt'>“…ngo m ming”</div>
    </div>
  </div>
  <div class='bar'>
    <div class='t'>Understand it all — free for helpers</div>
    <div class='cta'><span class='dot'></span>cantobuddy.com</div>
  </div>
</div>""")

# ---------------------------------------------------------------- 4. Games
BANNERS["banner4_games"] = page("""
.stage{background:linear-gradient(150deg,#8b5cff 0%,#5b6cff 55%,#2b6cf0 100%);color:#fff}
.b4 .mark,.b4 .mark .sq{color:#fff}
.b4 .mark .sq{background:#fff;color:#6b4bff}
.emoji{font-size:128px;margin-bottom:10px}
.head{font-size:94px;margin-bottom:20px;max-width:940px}
.sub{font-size:38px;font-weight:700;line-height:1.35;margin-bottom:34px;opacity:.95;max-width:880px}
.cta{background:#ffd43b;color:#5a3d00;box-shadow:0 20px 44px rgba(0,0,0,.28)}
.cta .dot{background:#25d366}
""", "<div class='stage b4'>" + MARK + FREE + """
  <div class='emoji'>🎮</div>
  <div class='head'>Beat your anak<br>at Sudoku 🃏</div>
  <div class='sub'>UNO · Big Two · Word Match · Sudoku<br>Play together online — from 6,000 km away.</div>
  <div class='cta'><span class='dot'></span>cantobuddy.com</div>
  <div class='foot'>No account · no install · just a room code</div>
</div>""")

# ---------------------------------------------------------------- 5. Cheat sheet
rows = [
    ("m goi", "please / thank you"),
    ("ngo m ming", "I don’t understand"),
    ("dim gaai?", "why?"),
    ("hou gwai", "so expensive!"),
    ("mou man tai", "no problem"),
]
row_html = "".join(
    "<div class='row'><div class='num'>%d</div><div class='rt'><div class='ph'>%s</div>"
    "<div class='mn'>%s</div></div></div>" % (i + 1, ph, mn)
    for i, (ph, mn) in enumerate(rows))

BANNERS["banner5_cheatsheet"] = page("""
.stage{background:#fff7f4;color:#1c2029;justify-content:flex-start;padding:58px 66px}
.title{font-family:'Arial Black',sans-serif;font-size:58px;line-height:1.05;color:#c02b41;margin:0 0 8px;max-width:960px}
.subt{font-size:28px;font-weight:700;color:#8a6a66;margin-bottom:22px}
.rows{width:930px;display:flex;flex-direction:column;gap:10px}
.row{display:flex;align-items:center;gap:20px;background:#fff;border-radius:18px;padding:11px 22px;box-shadow:0 10px 24px rgba(180,60,80,.08)}
.num{flex:0 0 auto;width:54px;height:54px;border-radius:50%;background:#e63946;color:#fff;font-weight:900;font-size:28px;display:grid;place-items:center}
.rt{text-align:left}
.ph{font-size:36px;font-weight:900;color:#1c2029;letter-spacing:.3px}
.mn{font-size:24px;font-weight:600;color:#7a7f8c;margin-top:1px}
.cta{margin-top:24px;background:#e63946;color:#fff;box-shadow:0 16px 34px rgba(230,57,70,.3);font-size:34px;padding:15px 32px}
.cta .dot{background:#fff}
.foot{color:#8a6a66;font-size:21px;margin-top:10px}
""", "<div class='stage b5'>" + """
  <div class='title'>5 Cantonese phrases<br>that save your day 😌</div>
  <div class='subt'>Save this. You’ll need it before lunch.</div>
  <div class='rows'>""" + row_html + """</div>
  <div class='cta'><span class='dot'></span>334 more words — free</div>
  <div class='foot'>cantobuddy.com · Learn Cantonese for daily life in Hong Kong</div>
</div>""")

# ---------------------------------------------------------------- 6. Value prop
BANNERS["banner6_value"] = page("""
body{background:#ef4d5f}
.stage{background:linear-gradient(155deg,#ff8191 0%,#ef4d5f 55%,#d02f4a 100%);color:#fff;justify-content:center}
.b6 .mark,.b6 .mark .sq{color:#fff}
.b6 .mark .sq{background:#fff;color:#e63946}
.head{font-size:78px;margin-bottom:14px;max-width:940px}
.flag{font-size:88px;margin-bottom:6px}
.lead{font-size:34px;font-weight:700;opacity:.95;margin-bottom:30px}
.bullets{display:flex;flex-direction:column;gap:14px;margin-bottom:32px;width:900px}
.bl{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.14);border-radius:18px;padding:14px 22px;font-size:32px;font-weight:700;text-align:left}
.bl .e{font-size:36px}
.cta{background:#fff;color:#e63946}
.foot{opacity:.9}
""", "<div class='stage b6'>" + MARK + FREE + """
  <div class='emoji flag'>🏙️</div>
  <div class='head'>Free Cantonese app<br>for helpers</div>
  <div class='lead'>Everything in one place — no sign-up.</div>
  <div class='bullets'>
    <div class='bl'><span class='e'>📚</span> 334 real words &amp; phrases, with audio</div>
    <div class='bl'><span class='e'>📰</span> HK news &amp; stories from home</div>
    <div class='bl'><span class='e'>🎮</span> UNO · Big Two · Word Match · Sudoku</div>
  </div>
  <div class='cta'><span class='dot'></span>cantobuddy.com</div>
  <div class='foot'>No sign-up · no ads · just open it</div>
</div>""")


def shoot(name, html):
    path = os.path.join(ROOT, name + ".html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    out = os.path.join(ROOT, name + ".png")
    url = "file:///" + path.replace("\\", "/")
    subprocess.run([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        "--user-data-dir=" + os.path.join(ROOT, "_prof"),
        "--window-size=1080,1080", "--force-device-scale-factor=1",
        "--virtual-time-budget=1200", "--screenshot=" + out, url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("made", out, os.path.getsize(out), "bytes")


for name, html in BANNERS.items():
    shoot(name, html)
