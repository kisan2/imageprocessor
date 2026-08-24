
import React, { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./App.css";

export default function App() {
  const [images, setImages] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPosition, setLogoPosition] = useState("top-left");

  const [enhance, setEnhance] = useState(true);
  const [upscale, setUpscale] = useState(false);
  const [removeRedEye, setRemoveRedEye] = useState(true);

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Load image from File
   */
  const loadImage = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Unable to load image: ${file.name}`));
      };

      img.src = url;
    });

  const handleImages = (e) => {
    setImages(Array.from(e.target.files || []));
  };

  const handleLogo = (e) => {
    setLogoFile(e.target.files?.[0] || null);
  };

  const handleLogoPosition = (e) => {
    setLogoPosition(e.target.value);
  };

  /**
   * Basic image enhancement
   */
  const enhanceImage = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Brightness + contrast
      r = Math.min(255, r * 1.08 + 10);
      g = Math.min(255, g * 1.08 + 10);
      b = Math.min(255, b * 1.08 + 10);

      // Slight saturation
      const avg = (r + g + b) / 3;

      r = r + (r - avg) * 0.08;
      g = g + (g - avg) * 0.08;
      b = b + (b - avg) * 0.08;

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
  };

  /**
   * Red-eye removal
   *
   * Detects pixels that have:
   * - Strong red dominance
   * - Relatively low green/blue values
   * - Enough red intensity to be considered an eye reflection
   *
   * Instead of simply removing red, we replace it with
   * a darker neutral value to preserve the eye appearance.
   */
  const removeRedEyeEffect = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let correctedPixels = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;

        let r = data[index];
        let g = data[index + 1];
        let b = data[index + 2];

        /**
         * Red-eye characteristics
         *
         * r should be significantly greater than g/b.
         */
        const redDominance = r - Math.max(g, b);

        const isRedEyePixel =
          r > 90 &&
          redDominance > 45 &&
          r > g * 1.35 &&
          r > b * 1.35 &&
          g < 150 &&
          b < 150;

        if (!isRedEyePixel) {
          continue;
        }

        /**
         * Check surrounding pixels.
         *
         * This helps prevent modifying isolated red objects.
         */
        let redNeighbors = 0;

        for (let ny = -1; ny <= 1; ny++) {
          for (let nx = -1; nx <= 1; nx++) {
            if (nx === 0 && ny === 0) continue;

            const neighborIndex =
              ((y + ny) * width + (x + nx)) * 4;

            const nr = data[neighborIndex];
            const ng = data[neighborIndex + 1];
            const nb = data[neighborIndex + 2];

            if (
              nr > 80 &&
              nr - Math.max(ng, nb) > 30
            ) {
              redNeighbors++;
            }
          }
        }

        /**
         * Require surrounding red pixels.
         */
        if (redNeighbors < 2) {
          continue;
        }

        /**
         * Preserve brightness while removing strong red.
         */
        const average = (g + b) / 2;

        const newRed = Math.min(
          r,
          average * 1.15
        );

        data[index] = Math.max(0, Math.min(255, newRed));

        correctedPixels++;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return correctedPixels;
  };

  /**
   * Sharpen image
   */
  const sharpen = (ctx, width, height) => {
    const weights = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ];

    const side = 3;
    const halfSide = 1;

    const srcData = ctx.getImageData(
      0,
      0,
      width,
      height
    );

    const src = srcData.data;

    const output = ctx.createImageData(
      width,
      height
    );

    const dst = output.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(
              height - 1,
              Math.max(
                0,
                y + cy - halfSide
              )
            );

            const scx = Math.min(
              width - 1,
              Math.max(
                0,
                x + cx - halfSide
              )
            );

            const srcOffset =
              (scy * width + scx) * 4;

            const weight =
              weights[cy * side + cx];

            r += src[srcOffset] * weight;
            g += src[srcOffset + 1] * weight;
            b += src[srcOffset + 2] * weight;
          }
        }

        const dstOffset =
          (y * width + x) * 4;

        dst[dstOffset] = Math.max(
          0,
          Math.min(255, r)
        );

        dst[dstOffset + 1] = Math.max(
          0,
          Math.min(255, g)
        );

        dst[dstOffset + 2] = Math.max(
          0,
          Math.min(255, b)
        );

        dst[dstOffset + 3] =
          src[dstOffset + 3];
      }
    }

    ctx.putImageData(output, 0, 0);
  };

  /**
   * Logo position
   */
  const getLogoCoordinates = (
    imgWidth,
    imgHeight,
    logoWidth,
    logoHeight,
    position
  ) => {
    const padding = imgWidth * 0.02;

    switch (position) {
      case "top-left":
        return [padding, padding];

      case "top-right":
        return [
          imgWidth - logoWidth - padding,
          padding,
        ];

      case "bottom-left":
        return [
          padding,
          imgHeight - logoHeight - padding,
        ];

      case "bottom-right":
        return [
          imgWidth - logoWidth - padding,
          imgHeight - logoHeight - padding,
        ];

      default:
        return [padding, padding];
    }
  };

  /**
   * Convert canvas to JPEG Blob
   */
  const canvasToBlob = (canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error("Failed to create image")
            );
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        0.95
      );
    });

  /**
   * Main processing
   */
  const processAndDownload = async () => {
    if (!logoFile || images.length === 0) {
      alert(
        "Please upload images and a logo first."
      );
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus("Preparing...");

    try {
      const zip = new JSZip();

      const logoImg = await loadImage(logoFile);

      for (let i = 0; i < images.length; i++) {
        const file = images[i];

        setStatus(
          `Processing ${i + 1} of ${images.length}: ${file.name}`
        );

        const img = await loadImage(file);

        /**
         * Canvas dimensions
         */
        let canvasWidth = img.width;
        let canvasHeight = img.height;

        if (upscale) {
          canvasWidth = img.width * 2;
          canvasHeight = img.height * 2;
        }

        const canvas =
          document.createElement("canvas");

        const ctx =
          canvas.getContext("2d", {
            willReadFrequently: true,
          });

        if (!ctx) {
          throw new Error(
            "Could not create canvas context."
          );
        }

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        /**
         * Better quality when scaling
         */
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        /**
         * Draw original / 2x image
         */
        ctx.drawImage(
          img,
          0,
          0,
          canvasWidth,
          canvasHeight
        );

        /**
         * Red-eye removal
         */
        if (removeRedEye) {
          setStatus(
            `Removing red-eye: ${i + 1} of ${images.length}`
          );

          removeRedEyeEffect(
            ctx,
            canvas.width,
            canvas.height
          );
        }

        /**
         * Enhancement
         */
        if (enhance) {
          setStatus(
            `Enhancing image: ${i + 1} of ${images.length}`
          );

          enhanceImage(
            ctx,
            canvas.width,
            canvas.height
          );

          /**
           * Sharpen only when enhancement
           * is enabled.
           */
          setStatus(
            `Sharpening image: ${i + 1} of ${images.length}`
          );

          sharpen(
            ctx,
            canvas.width,
            canvas.height
          );
        }

        /**
         * Logo
         */
        setStatus(
          `Adding logo: ${i + 1} of ${images.length}`
        );

        const logoHeight =
          canvas.height * 0.15;

        const logoWidth =
          (logoImg.width / logoImg.height) *
          logoHeight;

        const [logoX, logoY] =
          getLogoCoordinates(
            canvas.width,
            canvas.height,
            logoWidth,
            logoHeight,
            logoPosition
          );

        ctx.drawImage(
          logoImg,
          logoX,
          logoY,
          logoWidth,
          logoHeight
        );

        /**
         * Convert to JPEG
         */
        const blob =
          await canvasToBlob(canvas);

        /**
         * Always use .jpg because
         * output is JPEG.
         */
        const outputName =
          file.name.replace(
            /\.[^/.]+$/,
            ""
          ) + ".jpg";

        zip.file(
          outputName,
          blob
        );

        /**
         * Progress
         */
        setProgress(
          Math.round(
            ((i + 1) / images.length) *
              100
          )
        );

        /**
         * Allow browser UI to update
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 10)
        );
      }

      setStatus("Creating ZIP...");

      const zipBlob =
        await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        });

      saveAs(
        zipBlob,
        "edited_images.zip"
      );

      setStatus("Done ✅");
    } catch (error) {
      console.error(error);

      setStatus(
        `Error: ${
          error?.message ||
          "Something went wrong"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1>
        Bulk Image Enhancer + Logo
      </h1>

      <div className="card">
        {/* Images */}
        <label>
          Upload Images
        </label>

        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleImages}
          disabled={loading}
          style={{
            border: "1px solid black",
            borderRadius: 5,
          }}
        />

        {/* Logo */}
        <label>
          Upload Logo
        </label>

        <input
          type="file"
          accept="image/*"
          onChange={handleLogo}
          disabled={loading}
          style={{
            border: "1px solid black",
            borderRadius: 5,
          }}
        />

        {/* Logo position */}
        <label>
          Logo Position
        </label>

        <select
          value={logoPosition}
          onChange={handleLogoPosition}
          disabled={loading}
          style={{
            padding: 10,
            borderRadius: 5,
          }}
        >
          <option value="top-left">
            Top Left
          </option>

          <option value="top-right">
            Top Right
          </option>

          <option value="bottom-left">
            Bottom Left
          </option>

          <option value="bottom-right">
            Bottom Right
          </option>
        </select>

        {/* Enhancement */}
        <label>
          <input
            type="checkbox"
            checked={enhance}
            onChange={(e) =>
              setEnhance(e.target.checked)
            }
            disabled={loading}
          />{" "}
          Enhance Image
        </label>

        {/* Red eye */}
        <label>
          <input
            type="checkbox"
            checked={removeRedEye}
            onChange={(e) =>
              setRemoveRedEye(
                e.target.checked
              )
            }
            disabled={loading}
          />{" "}
          Remove Red-Eye
        </label>

        {/* Upscale */}
        <label>
          <input
            type="checkbox"
            checked={upscale}
            onChange={(e) =>
              setUpscale(e.target.checked)
            }
            disabled={loading}
          />{" "}
          Super-Resolution Upscale (2×)
        </label>

        {/* Process */}
        <button
          onClick={processAndDownload}
          disabled={loading}
        >
          {loading
            ? "Processing..."
            : "Process & Download ZIP"}
        </button>

        {/* Progress */}
        {loading && (
          <>
            <div className="progressBar">
              <div
                className="progress"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="status">
              {status}
            </p>

            <p>
              {progress}% complete
            </p>
          </>
        )}
      </div>
    </div>
  );
}
