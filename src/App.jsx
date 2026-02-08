// import React, { useState } from "react";
// import JSZip from "jszip";
// import { saveAs } from "file-saver";
// import "./App.css";

// export default function App() {
//   const [images, setImages] = useState([]);
//   const [logoFile, setLogoFile] = useState(null);
//   const [progress, setProgress] = useState(0);
//   const [status, setStatus] = useState("");
//   const [loading, setLoading] = useState(false);

//   const loadImage = (file) =>
//     new Promise((resolve) => {
//       const img = new Image();
//       img.onload = () => resolve(img);
//       img.src = URL.createObjectURL(file);
//     });

//   const handleImages = (e) => {
//     setImages([...e.target.files]);
//   };

//   const handleLogo = (e) => {
//     setLogoFile(e.target.files[0]);
//   };

//   const processAndDownload = async () => {
//     if (!logoFile || images.length === 0) {
//       alert("Upload images and a logo first");
//       return;
//     }

//     setLoading(true);
//     setProgress(0);
//     setStatus("Preparing...");

//     const zip = new JSZip();
//     const logoImg = await loadImage(logoFile);

//     for (let i = 0; i < images.length; i++) {
//       const file = images[i];
//       setStatus(`Processing ${i + 1} of ${images.length}`);

//       const img = await loadImage(file);

//       const canvas = document.createElement("canvas");
//       const ctx = canvas.getContext("2d");

//       canvas.width = img.width;
//       canvas.height = img.height;

//       ctx.drawImage(img, 0, 0);

//       const logoHeight = img.height * 0.15;
//       const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
//       const padding = img.width * 0.02;

//       ctx.drawImage(logoImg, padding, padding, logoWidth, logoHeight);

//       const blob = await new Promise((resolve) =>
//         canvas.toBlob(resolve, "image/jpeg", 0.95)
//       );

//       zip.file(file.name, blob);

//       setProgress(Math.round(((i + 1) / images.length) * 100));

//       // Let UI breathe (very important)
//       await new Promise((r) => setTimeout(r, 10));
//     }

//     setStatus("Creating ZIP...");
//     const zipBlob = await zip.generateAsync({ type: "blob" });

//     saveAs(zipBlob, "edited_images.zip");

//     setStatus("Done ✅");
//     setLoading(false);
//   };

//   return (
//     <div className="container">
//       <h1>Bulk Image Logo Adder</h1>

//       <div className="card">
//         <label>Upload Images</label>
//         <input type="file" multiple accept="image/*" onChange={handleImages} />

//         <label>Upload Logo</label>
//         <input type="file" accept="image/*" onChange={handleLogo} />

//         <button onClick={processAndDownload} disabled={loading}>
//           {loading ? "Processing..." : "Process & Download ZIP"}
//         </button>

//         {loading && (
//           <>
//             <div className="progressBar">
//               <div
//                 className="progress"
//                 style={{ width: `${progress}%` }}
//               ></div>
//             </div>
//             <p className="status">{status}</p>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }


import React, { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./App.css";

export default function App() {
  const [images, setImages] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
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

  // -------- Image Enhancement --------
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
        let r = 0, g = 0, b = 0;

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

  // -------- Main Process --------
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

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      // Enhance + sharpen
      enhanceImage(ctx, canvas.width, canvas.height);
      sharpen(ctx, canvas.width, canvas.height);

      // Logo
      const logoHeight = img.height * 0.15;
      const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
      const padding = img.width * 0.02;

      ctx.drawImage(logoImg, padding, padding, logoWidth, logoHeight);

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
    <div className="container">
      <h1>Bulk Image Enhancer + Logo</h1>

      <div className="card">
        <label>Upload Images</label>
        <input type="file" multiple accept="image/*" onChange={handleImages} />

        <label>Upload Logo</label>
        <input type="file" accept="image/*" onChange={handleLogo} />

        <button onClick={processAndDownload} disabled={loading}>
          {loading ? "Processing..." : "Process & Download ZIP"}
        </button>

        {loading && (
          <>
            <div className="progressBar">
              <div
                className="progress"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="status">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}

