<?php
// Builds sitemap.xml automatically from the .html pages on this site.
// New pages are picked up with no extra work.

$skipDirs  = ['templates', 'fragments', 'vendor', 'api', 'demo', 'phpmailer', 'node_modules', '.trash', '.well-known', 'cgi-bin'];
$skipFiles = ['404.html', 'contact-thanks.html', 'start.html', 'default.php'];

$root = __DIR__;
$host = 'https://' . preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST']);
$urls = [];

$it = new RecursiveIteratorIterator(
  new RecursiveCallbackFilterIterator(
    new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
    function ($f) use ($skipDirs) {
      if ($f->isDir()) return !in_array($f->getFilename(), $skipDirs, true) && $f->getFilename()[0] !== '.';
      return true;
    }
  )
);
foreach ($it as $f) {
  $name = $f->getFilename();
  if (strtolower($f->getExtension()) !== 'html' || in_array($name, $skipFiles, true) || $name[0] === '_') continue;
  $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($root)));
  if ($name === 'index.html') $rel = substr($rel, 0, -strlen('index.html'));
  $urls[$rel] = date('Y-m-d', $f->getMTime());
}
ksort($urls);

header('Content-Type: application/xml; charset=UTF-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $path => $mod) {
  $loc = htmlspecialchars($host . implode('/', array_map('rawurlencode', explode('/', $path))), ENT_XML1);
  echo "  <url><loc>$loc</loc><lastmod>$mod</lastmod></url>\n";
}
echo "</urlset>\n";
