<?php
/**
 * Generate PWA PNG icons from bill-bunny-logo.png.
 * Run: php scripts/generate-icons.php
 */

declare(strict_types=1);

if (!extension_loaded('gd')) {
    fwrite(STDERR, "GD extension required. Install php-gd or use assets/icons/bill-bunny-logo.png directly.\n");
    exit(1);
}

$source = dirname(__DIR__) . '/assets/icons/bill-bunny-logo.png';
if (!is_file($source)) {
    $source = dirname(__DIR__) . '/bill-bunny-logo.png';
}

if (!is_file($source)) {
    fwrite(STDERR, "bill-bunny-logo.png not found in assets/icons/ or project root.\n");
    exit(1);
}

$dir = dirname(__DIR__) . '/assets/icons';
$src = imagecreatefrompng($source);
if (!$src) {
    fwrite(STDERR, "Could not read {$source}\n");
    exit(1);
}

$srcW = imagesx($src);
$srcH = imagesy($src);

foreach ([192, 512] as $size) {
    $img = imagecreatetruecolor($size, $size);
    imagealphablending($img, false);
    imagesavealpha($img, true);
    $transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
    imagefill($img, 0, 0, $transparent);
    imagealphablending($img, true);

    $scale = min($size / $srcW, $size / $srcH);
    $newW = (int) round($srcW * $scale);
    $newH = (int) round($srcH * $scale);
    $dstX = (int) (($size - $newW) / 2);
    $dstY = (int) (($size - $newH) / 2);

    imagecopyresampled($img, $src, $dstX, $dstY, 0, 0, $newW, $newH, $srcW, $srcH);

    $path = $dir . "/icon-{$size}.png";
    imagepng($img, $path);
    imagedestroy($img);
    echo "Created {$path}\n";
}

imagedestroy($src);
echo "Done.\n";
