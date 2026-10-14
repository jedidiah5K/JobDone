# Builds two versions from the same source:
#   web/               the installable website (Supabase accounts, home-screen app); also zipped to dist/jobdone-web.zip
#   dist/jobdone.html  the Claude artifact, only when the private personal/ seed folder is present
import os, shutil, subprocess, sys, zipfile
here = os.path.dirname(os.path.abspath(__file__))
seed_script = os.path.join(here, 'personal', 'build_seed.py')
seed = subprocess.check_output([sys.executable, seed_script, os.path.join(here, '..', 'prompts', 'workout-log-may-oct-2026.csv')]).decode() if os.path.exists(seed_script) else None
src_js = open(os.path.join(here, 'app.js')).read()
css = open(os.path.join(here, 'styles.css')).read()
# Bebas Neue (SIL Open Font License) is inlined so the display type works offline and inside the artifact.
import base64
font = base64.b64encode(open(os.path.join(here, 'fonts', 'bebas-neue-latin.woff2'), 'rb').read()).decode()
css = css.replace('/*FONT*/', "@font-face { font-family: 'Bebas Neue'; font-style: normal; font-weight: 400; font-display: swap; src: url(data:font/woff2;base64," + font + ") format('woff2'); }")
# The Claude artifact carries Job's log; the public website does not (data comes from a backup file).
def fill(t, with_seed):
    app = src_js.replace('/*SEED*/{ log: [], weights: [], moved: [], noname: null, assumptions: [], today: null, profile: {} }', seed.strip()) if with_seed else src_js
    return t.replace('/*STYLES*/', css).replace('/*APP*/', app.replace('</script', '<\\/script'))
dist = os.path.join(here, 'dist'); os.makedirs(dist, exist_ok=True)
seed_ok = seed is not None
if seed_ok:
    open(os.path.join(dist, 'jobdone.html'), 'w').write(fill(open(os.path.join(here, 'shell.html')).read(), True))
# web/ is the deployed site (Vercel serves it as-is). config.js holds your Supabase keys and is never overwritten.
src, web = os.path.join(here, 'web-src'), os.path.join(here, 'web')
os.makedirs(web, exist_ok=True)
for root, _, files in os.walk(src):
    for n in files:
        if n in ('index-shell.html', 'config.example.js'): continue
        rel = os.path.relpath(os.path.join(root, n), src); dst = os.path.join(web, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy2(os.path.join(root, n), dst)
if not os.path.exists(os.path.join(web, 'config.js')):
    shutil.copy2(os.path.join(src, 'config.example.js'), os.path.join(web, 'config.js'))
open(os.path.join(web, 'index.html'), 'w').write(fill(open(os.path.join(src, 'index-shell.html')).read(), False))
z = os.path.join(dist, 'jobdone-web.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    for root, _, files in os.walk(web):
        for n in files:
            full = os.path.join(root, n); f.write(full, os.path.relpath(full, web))
print('built', 'artifact +' if seed_ok else '(no personal seed, artifact skipped)', 'web;', os.path.getsize(z), 'byte zip')
