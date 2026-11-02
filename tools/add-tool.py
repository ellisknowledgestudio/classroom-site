#!/usr/bin/env python3
"""Add (or register) a classroom tool: page + hub card + homepage count, then check it.

Usage:
  python3 tools/add-tool.py SUBJECT FOLDER "Card title" "Card text ending with Ages X-Y." [--page path/to/index.html]

- With --page, copies that file to SUBJECT/FOLDER/index.html (it must already contain the GA4 tag).
- Without --page, the tool folder must already exist in the repo (e.g. it is live but missing from the hub).
- Adds the card as the last item in SUBJECT/index.html's <div class="grid">, unless a card for the same
  href is already there.
- Updates "N free tool(s) to explore" for SUBJECT on the homepage to the number of cards in the hub.
- Fails loudly if anything looks wrong, so nothing half-done gets committed.
"""
import re, sys, shutil, os, html

GA_ID = "G-BKF789W3RD"

def fail(msg):
    sys.exit("ERROR: " + msg)

def check_page(path, subject, folder):
    h = open(path, encoding="utf-8").read()
    if h.count("gtag('config', '%s')" % GA_ID) != 1:
        fail("%s must contain gtag('config', '%s') exactly once" % (path, GA_ID))
    if h.count("googletagmanager.com/gtag/js?id=%s" % GA_ID) != 1:
        fail("%s must load the %s gtag script exactly once" % (path, GA_ID))
    others = set(re.findall(r"G-[A-Z0-9]{8,}", h)) - {GA_ID}
    if others:
        fail("%s contains other GA4 IDs: %s" % (path, ", ".join(sorted(others))))
    if re.search(r"Paste your[^>]*GA4", h, re.I):
        fail("%s still has a GA4 placeholder comment" % path)
    canon = "https://classroom.ellisknowledgestudio.com/%s/%s/" % (subject, folder)
    if ('rel="canonical" href="%s"' % canon) not in h:
        fail("%s canonical link should be %s" % (path, canon))
    if "`" in re.sub(r"<style>.*?</style>", "", h, flags=re.S):
        fail("%s contains a backtick (template literals are not allowed)" % path)

def main():
    args = sys.argv[1:]
    page = None
    if "--page" in args:
        i = args.index("--page"); page = args[i + 1]; del args[i:i + 2]
    if len(args) != 4:
        fail(__doc__)
    subject, folder, title, text = args
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", folder):
        fail("folder name must be lower case words joined by hyphens: %r" % folder)
    if not re.search(r"Ages \d+-\d+\.$", text):
        fail("card text must end with 'Ages X-Y.'")
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    dest = os.path.join(subject, folder, "index.html")
    if page:
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(page, dest)
    elif not os.path.isfile(dest):
        fail("%s does not exist; pass --page" % dest)
    check_page(dest, subject, folder)

    hub = os.path.join(subject, "index.html")
    if not os.path.isfile(hub):
        fail("hub %s does not exist (new subjects need their hub page created first)" % hub)
    h = open(hub, encoding="utf-8").read()
    href = "/%s/%s/" % (subject, folder)
    m = re.search(r'(<div class="grid">)(.*?)(\n[ \t]*</div>)', h, re.S)
    if not m:
        fail('could not find <div class="grid"> ... </div> in %s' % hub)
    if ('href="%s"' % href) not in m.group(2):
        card = '    <a class="card" href="%s"><h3>%s</h3><p>%s</p></a>' % (href, html.escape(title, quote=False), html.escape(text, quote=False))
        h = h[:m.end(2)] + "\n" + card + h[m.end(2):]
        open(hub, "w", encoding="utf-8").write(h)
        print("added card to", hub)
    else:
        print("card already in", hub)
    m = re.search(r'<div class="grid">(.*?)\n[ \t]*</div>', h, re.S)
    n = len(re.findall(r'<a class="card"', m.group(1)))

    home = "index.html"
    hh = open(home, encoding="utf-8").read()
    pat = r'(<a class="card" href="/%s/">.*?<p>)(\d+) free tools? to explore(</p>)' % re.escape(subject)
    if not re.search(pat, hh, re.S):
        fail("could not find the %s count on the homepage" % subject)
    word = "tool" if n == 1 else "tools"
    hh2 = re.sub(pat, lambda mm: "%s%d free %s to explore%s" % (mm.group(1), n, word, mm.group(3)), hh, count=1, flags=re.S)
    if hh2 != hh:
        open(home, "w", encoding="utf-8").write(hh2)
        print("homepage %s count -> %d" % (subject, n))
    print("OK", dest)

if __name__ == "__main__":
    main()
