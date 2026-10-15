# Builds two versions from the same source:
#   web/               the installable website (Supabase accounts, home-screen app); also zipped to dist/jobdone-web.zip
#   dist/jobdone.html  the Claude artifact, only when the private personal/ seed folder is present
import os, shutil, subprocess, sys, zipfile
here = os.path.dirname(os.path.abspath(__file__))
seed_script = os.path.join(here, 'personal', 'build_seed.py')
seed = subprocess.check_output([sys.executable, seed_script, os.path.join(here, '..', 'prompts', 'workout-log-may-oct-2026.csv')]).decode() if os.path.exists(seed_script) else None
src_js = open(os.path.join(here, 'app.js')).read()
css = open(os.path.join(here, 'styles.css')).read()
import base64
css = css.replace('/*FONT*/', '')  # Oct 2026: system font (SF Pro on iPhone) instead of the rounded Nunito
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
# Optional: minify the website's script and styles when esbuild is available (set JOBDONE_ESBUILD to its path).
esb = os.environ.get('JOBDONE_ESBUILD')
if esb and os.path.exists(esb):
    run = lambda txt, loader: subprocess.run([esb, '--minify', '--loader=' + loader, '--target=safari15', '--log-level=error'], input=txt.encode(), capture_output=True, check=True).stdout.decode()
    _js, _css = src_js, css
    src_js, css = run(src_js, 'js'), run(css, 'css')
html = fill(open(os.path.join(src, 'index-shell.html')).read(), False)
if esb and os.path.exists(esb): src_js, css = _js, _css
# Content security policy: only our own files, Supabase, and the inline app script (pinned by its hash) may run.
import re, hashlib, base64
hashes = ' '.join("'sha256-%s'" % base64.b64encode(hashlib.sha256(m.encode()).digest()).decode() for m in re.findall(r'<script>(.*?)</script>', html, re.S))
sb = 'https://xvyibgnjibzopwtxajin.supabase.co'
csp = ("default-src 'self'; script-src 'self' %s; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; "
       "connect-src 'self' %s wss://xvyibgnjibzopwtxajin.supabase.co; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'") % (hashes, sb)
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="%s">' % csp, 1)
open(os.path.join(web, 'index.html'), 'w').write(html)
z = os.path.join(dist, 'jobdone-web.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    for root, _, files in os.walk(web):
        for n in files:
            full = os.path.join(root, n); f.write(full, os.path.relpath(full, web))
print('built', 'artifact +' if seed_ok else '(no personal seed, artifact skipped)', 'web;', os.path.getsize(z), 'byte zip')
