<?php
/**
 * Create default bill-bunny-logo.png if missing (green bunny icon for PWA/UI).
 * Run: php scripts/create-default-logo.php
 */

declare(strict_types=1);

if (!extension_loaded('gd')) {
    fwrite(STDERR, "GD extension required.\n");
    exit(1);
}

$dir = dirname(__DIR__) . '/assets/icons';
if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$path = $dir . '/bill-bunny-logo.png';
if (is_file($path)) {
    echo "Logo already exists: {$path}\n";
    exit(0);
}

$size = 512;
$img = imagecreatetruecolor($size, $size);
imagealphablending($img, false);
imagesavealpha($img, true);
$transparent = imagecolorallocatealpha($img, 0, 0, 0, 127);
imagefill($img, 0, 0, $transparent);
imagealphablending($img, true);

$green = imagecolorallocate($img, 22, 101, 52);
$light = imagecolorallocate($img, 74, 222, 128);
$white = imagecolorallocate($img, 255, 255, 255);
$dark = imagecolorallocate($img, 21, 128, 61);

// Rounded background
imagefilledellipse($img, (int) ($size / 2), (int) ($size / 2), $size - 24, $size - 24, $green);

// Ears
imagefilledellipse($img, 170, 130, 120, 160, $light);
imagefilledellipse($img, 342, 130, 120, 160, $light);
imagefilledellipse($img, 170, 130, 70, 100, $green);
imagefilledellipse($img, 342, 130, 70, 100, $green);

// Face
imagefilledellipse($img, 256, 290, 280, 260, $light);

// Eyes
imagefilledellipse($img, 210, 270, 36, 48, $dark);
imagefilledellipse($img, 302, 270, 36, 48, $dark);
imagefilledellipse($img, 218, 262, 12, 12, $white);
imagefilledellipse($img, 310, 262, 12, 12, $white);

// Nose
imagefilledellipse($img, 256, 320, 28, 22, $dark);

// Mouth
imagesetthickness($img, 4);
imagearc($img, 256, 340, 60, 40, 20, 160, $dark);

imagepng($img, $path);
imagedestroy($img);

echo "Created {$path}\n";
