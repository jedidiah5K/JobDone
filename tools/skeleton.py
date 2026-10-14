# Draws the X-ray skeleton used as JobDone's still background and prints it as SVG markup.
# Front view, the body's centre line at x = 200, units roughly millimetres / 2.
# Run: python3 tools/skeleton.py > tools/skeleton.svg   (build.py inlines it into the app)
import math

C = 200
out = []
def f(v): return f'{v:.1f}'
def path(d, w, op=1, cap='round'): out.append(f'<path d="{d}" stroke-width="{w}" opacity="{op}" stroke-linecap="{cap}"/>')
def ell(cx, cy, rx, ry, w=2, op=1, fill=False): out.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" stroke-width="{w}" opacity="{op}"{" class=\"f\"" if fill else ""}/>')
def both(fn):  # draw a left-side part and its mirror
    fn(1); fn(-1)
def m(s, x): return C + s * x  # mirror helper: s = 1 right of centre line (person's left), -1 left

# --- Skull ---
path(f'M{C-44} 86 C{C-50} 40 {C-28} 14 {C} 14 C{C+28} 14 {C+50} 40 {C+44} 86 C{C+42} 100 {C+36} 104 {C+34} 112 L{C-34} 112 C{C-36} 104 {C-42} 100 {C-44} 86 Z', 3.2)
path(f'M{C-30} 52 C{C-14} 44 {C+14} 44 {C+30} 52', 1.4, .5)
both(lambda s: ell(m(s, 17), 80, 11.5, 10, 2.6, 1, True))
path(f'M{C} 88 L{C-6} 102 L{C+6} 102 Z', 2)
path(f'M{C-30} 112 C{C-30} 132 {C-18} 146 {C} 148 C{C+18} 146 {C+30} 132 {C+30} 112', 3)
for i in range(-5, 6):  # teeth
    path(f'M{C+i*4.6} 110 L{C+i*4.6} 120', 2.6, .8, 'butt')
path(f'M{C-26} 115 L{C+26} 115', 1, .5)

# --- Spine ---
for i in range(7):  # cervical
    y = 156 + i * 8.5
    out.append(f'<rect x="{f(C-9-i*.4)}" y="{f(y)}" width="{f(18+i*.8)}" height="6.2" rx="2.5" stroke-width="1.8"/>')
for i in range(17):  # thoracic + lumbar
    y = 218 + i * (14 if i < 12 else 17)
    w = 20 + i * 1.1 if i < 12 else 34 + (i - 12) * 2.4
    h = 10 if i < 12 else 13
    out.append(f'<rect x="{f(C-w/2)}" y="{f(y)}" width="{f(w)}" height="{h}" rx="3" stroke-width="2"/>')
    if i >= 12: both(lambda s, y=y, w=w: path(f'M{f(m(s, w/2))} {f(y+6)} L{f(m(s, w/2+10))} {f(y+4)}', 3, .8))

# --- Clavicles, sternum, ribs ---
both(lambda s: path(f'M{m(s, 8)} 210 C{m(s, 30)} 200 {m(s, 50)} 214 {m(s, 74)} 202', 5))
out.append(f'<rect x="{C-8}" y="214" width="16" height="96" rx="7" stroke-width="2.4"/>')
path(f'M{C-4} 310 L{C} 326 L{C+4} 310', 2)
for i in range(11):
    y = 222 + i * 15.5
    reach = [44, 58, 68, 75, 80, 82, 82, 80, 76, 70, 62][i]
    drop = 34 + i * 2.2
    def rib(s, y=y, reach=reach, drop=drop, i=i):
        path(f'M{f(m(s, 11))} {f(y)} C{f(m(s, reach*.7))} {f(y-16)} {f(m(s, reach+6))} {f(y+4)} {f(m(s, reach))} {f(y+drop*.55)} '
             f'C{f(m(s, reach-6))} {f(y+drop*.9)} {f(m(s, reach*.6))} {f(y+drop)} {f(m(s, reach*.42))} {f(y+drop+2)}', 4.2 if i < 9 else 3.6)
        if i < 9:  # costal cartilage back to the sternum
            ty = 222 + min(i, 6) * 13
            path(f'M{f(m(s, reach*.42))} {f(y+drop+2)} Q{f(m(s, 20))} {f(y+drop-2)} {f(m(s, 9))} {f(ty+6)}', 1.8, .45)
    both(rib)

# --- Shoulders, arms, hands ---
def arm(s):
    path(f'M{m(s, 74)} 204 C{m(s, 88)} 196 {m(s, 96)} 214 {m(s, 92)} 230', 4)  # acromion / shoulder cap
    ell(m(s, 84), 222, 11, 12, 2.6)  # humeral head
    path(f'M{m(s, 86)} 232 L{m(s, 104)} 398', 9)  # humerus
    ell(m(s, 105), 402, 11, 7, 2.4)  # elbow
    path(f'M{m(s, 100)} 410 L{m(s, 112)} 548', 4.6)  # ulna
    path(f'M{m(s, 110)} 408 L{m(s, 124)} 546', 5.2)  # radius
    for k in range(4):  # carpals
        ell(m(s, 112 + k * 4.5), 556 + (k % 2) * 5, 4, 3.6, 1.8)
    for k, (dx, ln) in enumerate([(-8, 40), (-2, 52), (4, 56), (10, 52), (16, 42)]):
        x0, y0 = m(s, 116 + dx * .5), 566
        ang = math.radians(90 + s * (k - 2) * 6 - s * 4)
        x1, y1 = x0 + math.cos(ang) * ln * s * .15, y0 + math.sin(ang) * ln
        if k == 0: x1, y1 = m(s, 104), 600
        path(f'M{f(x0)} {f(y0)} L{f(x1)} {f(y1)}', 3, .9)
        for t in (.42, .74): ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 2.2, 1.4, 1.2, .6)
both(arm)

# --- Pelvis ---
def ilium(s):
    path(f'M{m(s, 20)} 470 C{m(s, 46)} 452 {m(s, 92)} 448 {m(s, 102)} 476 C{m(s, 108)} 502 {m(s, 88)} 520 {m(s, 74)} 540 '
         f'C{m(s, 66)} 552 {m(s, 62)} 560 {m(s, 58)} 570', 4)
    path(f'M{m(s, 58)} 570 C{m(s, 54)} 596 {m(s, 40)} 610 {m(s, 16)} 606 L{m(s, 6)} 592', 3.6)
    ell(m(s, 36), 586, 13, 10, 2.2)  # obturator foramen
    ell(m(s, 60), 556, 15, 15, 2.6)  # acetabulum
both(ilium)
path(f'M{C-20} 470 L{C+20} 470 L{C+10} 540 Q{C} 552 {C-10} 540 Z', 2.6)  # sacrum
for i in range(4): both(lambda s, i=i: ell(m(s, 8), 484 + i * 14, 2.6, 2.4, 1.4, .7))

# --- Legs and feet ---
def leg(s):
    ell(m(s, 62), 556, 10, 10, 2.4)  # femoral head
    path(f'M{m(s, 66)} 562 L{m(s, 84)} 576', 7)  # neck
    path(f'M{m(s, 86)} 566 C{m(s, 96)} 568 {m(s, 96)} 584 {m(s, 88)} 590', 4)  # greater trochanter
    path(f'M{m(s, 84)} 584 L{m(s, 52)} 790', 12)  # femur
    path(f'M{m(s, 34)} 790 C{m(s, 34)} 804 {m(s, 72)} 806 {m(s, 72)} 792', 5)  # condyles
    ell(m(s, 52), 796, 9, 11, 2.2, .9)  # patella
    path(f'M{m(s, 46)} 812 L{m(s, 44)} 960', 10)  # tibia
    path(f'M{m(s, 66)} 816 L{m(s, 62)} 956', 4.2)  # fibula
    path(f'M{m(s, 34)} 966 C{m(s, 40)} 958 {m(s, 64)} 958 {m(s, 68)} 968', 4)  # ankle
    for k in range(5):  # metatarsals and toes
        x0 = m(s, 40 + k * 7)
        x1 = m(s, 30 + k * 11)
        path(f'M{f(x0)} 974 L{f(x1)} 998', 3.2 - k * .3, .9)
        path(f'M{f(x1)} 1002 L{f(x1 - s * 1)} 1012', 2.6 - k * .2, .7)
both(leg)

body = ''.join(out)
print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 1024" preserveAspectRatio="xMidYMid meet">'
      f'<style>.f{{fill:#06070d}}</style><defs><linearGradient id="xb" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#F2FFD6"/><stop offset=".5" stop-color="#DDF6FF"/><stop offset="1" stop-color="#B8F2FF"/></linearGradient>'
      f'<filter id="xg" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>'
      f'<g fill="none" stroke="url(#xb)" stroke-linejoin="round"><g filter="url(#xg)" opacity=".55">{body}</g><g>{body}</g></g></svg>')
