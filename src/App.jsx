import React, { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./App.css";

export default function App() {
  const [images, setImages] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPosition, setLogoPosition] = useState("top-left");
  const [enhance, setEnhance] = useState(true);
  const [upscale, setUpscale] = useState(false); // Super-resolution upscale
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const loadImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = URL.createObjectURL(file);
    });

  const handleImages = (e) => setImages([...e.target.files]);
  const handleLogo = (e) => setLogoFile(e.target.files[0]);
  const handleLogoPosition = (e) => setLogoPosition(e.target.value);

  const enhanceImage = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] * 1.08 + 10);
      data[i + 1] = Math.min(255, data[i + 1] * 1.08 + 10);
      data[i + 2] = Math.min(255, data[i + 2] * 1.08 + 10);
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] += (data[i] - avg) * 0.08;
      data[i + 1] += (data[i + 1] - avg) * 0.08;
      data[i + 2] += (data[i + 2] - avg) * 0.08;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const sharpen = (ctx, width, height) => {
    const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const side = 3;
    const halfSide = 1;

    const srcData = ctx.getImageData(0, 0, width, height);
    const src = srcData.data;

    const output = ctx.createImageData(width, height);
    const dst = output.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
            const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
            const srcOffset = (scy * width + scx) * 4;
            const wt = weights[cy * side + cx];
            r += src[srcOffset] * wt;
            g += src[srcOffset + 1] * wt;
            b += src[srcOffset + 2] * wt;
          }
        }

        const dstOffset = (y * width + x) * 4;
        dst[dstOffset] = r;
        dst[dstOffset + 1] = g;
        dst[dstOffset + 2] = b;
        dst[dstOffset + 3] = 255;
      }
    }

    ctx.putImageData(output, 0, 0);
  };

  const getLogoCoordinates = (imgWidth, imgHeight, logoWidth, logoHeight, position) => {
    const padding = imgWidth * 0.02;
    switch (position) {
      case "top-left":
        return [padding, padding];
      case "top-right":
        return [imgWidth - logoWidth - padding, padding];
      case "bottom-left":
        return [padding, imgHeight - logoHeight - padding];
      case "bottom-right":
        return [imgWidth - logoWidth - padding, imgHeight - logoHeight - padding];
      default:
        return [padding, padding];
    }
  };

  const processAndDownload = async () => {
    if (!logoFile || images.length === 0) {
      alert("Upload images and a logo first");
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus("Preparing...");

    const zip = new JSZip();
    const logoImg = await loadImage(logoFile);

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      setStatus(`Processing ${i + 1} of ${images.length}`);

      const img = await loadImage(file);

      // Super-resolution upscale
      let canvasWidth = img.width;
      let canvasHeight = img.height;
      if (upscale) {
        canvasWidth = img.width * 2; // 2x upscale
        canvasHeight = img.height * 2;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Draw image (upscaled if chosen)
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      // Enhance + sharpen if chosen
      if (enhance) enhanceImage(ctx, canvas.width, canvas.height);
      sharpen(ctx, canvas.width, canvas.height);

      // Logo
      const logoHeight = canvas.height * 0.15;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      const [logoX, logoY] = getLogoCoordinates(
        canvas.width,
        canvas.height,
        logoWidth,
        logoHeight,
        logoPosition
      );

      ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95)
      );

      zip.file(file.name, blob);

      setProgress(Math.round(((i + 1) / images.length) * 100));
      await new Promise((r) => setTimeout(r, 10));
    }

    setStatus("Creating ZIP...");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "edited_images.zip");

    setStatus("Done ✅");
    setLoading(false);
  };

  return (
    <div className="container" style={{
      display:"flex",
      flexDirection:"column",
      gap:3
    }}>
      <h1>Bulk Image Enhancer + Logo</h1>

      <div className="card">
        <label>Upload Images</label>
        <input type="file" multiple accept="image/*" onChange={handleImages} style={{
          border:"1px solid black",
          borderRadius:5
        }} />

        <label>Upload Logo</label>
        <input type="file" accept="image/*" onChange={handleLogo} style={{
          border:"1px solid black",
          borderRadius:5
        }} />

        <label>Logo Position</label>
        <select value={logoPosition} onChange={handleLogoPosition} style={{
          padding:10,
          borderRadius:5
        }}>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={enhance}
            onChange={(e) => setEnhance(e.target.checked)}
          />{" "}
          Enhance Image
        </label>

        <label>
          <input
            type="checkbox"
            checked={upscale}
            onChange={(e) => setUpscale(e.target.checked)}
          />{" "}
          Super-Resolution Upscale (2×)
        </label>

        <button onClick={processAndDownload} disabled={loading}>
          {loading ? "Processing..." : "Process & Download ZIP"}
        </button>

        {loading && (
          <>
            <div className="progressBar">
              <div className="progress" style={{ width: `${progress}%` }} />
            </div>
            <p className="status">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
