/**
 * Ensures an image has power-of-two dimensions, which is required on some
 * older hardware (like the PS2).
 *
 * @param {Image} image The original image.
 * @returns {Image} A new image with power-of-two dimensions, with the original
 *   image data copied to it. If the original image already has power-of-two
 *   dimensions, it is returned unchanged.
 */
export function ensurePowerOfTwo(image) {
  const isPowerOfTwo = (n) => (n > 0) && ((n & (n - 1)) === 0);

  if (isPowerOfTwo(image.width) && isPowerOfTwo(image.height)) {
    return image;
  }

  const nextPowerOfTwo = (n) => {
    let p = 1;
    while (p < n) {
      p *= 2;
    }
    return p;
  };

  const newWidth = nextPowerOfTwo(image.width);
  const newHeight = nextPowerOfTwo(image.height);

  const newImage = new Image(newWidth, newHeight);
  newImage.draw(image, 0, 0); // Copy original image data

  return newImage;
}