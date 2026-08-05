import { useState, useRef, useEffect } from 'react';
import fotoNicolle from '../assets/nicolle.png';

export default function Home() {
  const [image, setImage] = useState(null);
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [baseScale, setBaseScale] = useState(1);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        if (containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 32;
          const containerHeight = containerRef.current.clientHeight - 32;
          
          const scaleX = containerWidth / img.width;
          const scaleY = containerHeight / img.height;
          const bestScale = Math.min(scaleX, scaleY, 1);
          
          setBaseScale(bestScale);
        } else {
          setBaseScale(1);
        }

        setImage(img);
        setLines([]);
        setPieces([]);
        setZoom(1);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      canvas.width = image.width;
      canvas.height = image.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      const baseThickness = Math.max(1, Math.max(canvas.width, canvas.height) / 800);

      ctx.globalCompositeOperation = 'difference';
      ctx.setLineDash([10 * baseThickness, 10 * baseThickness]);
      ctx.lineWidth = 1.5 * baseThickness;
      ctx.strokeStyle = '#ffffff';
      
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash([]);
      ctx.lineWidth = 3 * baseThickness;
      ctx.strokeStyle = '#ff008c';

      lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
      });

      if (isDrawing && startPoint && currentPoint) {
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
      }
    }
  }, [image, lines, isDrawing, startPoint, currentPoint]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();

        setZoom((prevZoom) => {
          const delta = e.deltaY < 0 ? 0.25 : -0.25;
          const newZoom = Math.max(0.5, Math.min(5, prevZoom + delta));

          if (newZoom === prevZoom) return prevZoom;

          const imageContainer = container.firstElementChild;
          if (imageContainer) {
            const imageRect = imageContainer.getBoundingClientRect();
            
            const mouseXOnImage = e.clientX - imageRect.left;
            const mouseYOnImage = e.clientY - imageRect.top;

            const ratio = newZoom / prevZoom;
            
            const diffX = mouseXOnImage * ratio - mouseXOnImage;
            const diffY = mouseYOnImage * ratio - mouseYOnImage;

            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += diffX;
                scrollContainerRef.current.scrollTop += diffY;
              }
            }, 0);
          }

          return newZoom;
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [image]);

  const getCoordinates = (e) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const getDistanceToLine = (p, v, w) => {
    const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y);
    if (l2 === 0) return Math.sqrt((p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y));
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return Math.sqrt((p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY));
  };

  const handleMouseDown = (e) => {
    const coords = getCoordinates(e);
    if (coords && canvasRef.current) {
      setIsDrawing(true);
      setStartPoint(coords);
      setCurrentPoint(coords);
    }
  };

  const handleDoubleClick = (e) => {
    const coords = getCoordinates(e);
    if (coords && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleRatio = canvasRef.current.width / rect.width;
      const hitTolerance = 15 * scaleRatio;

      let lineToRemove = -1;

      for (let i = 0; i < lines.length; i++) {
        if (getDistanceToLine(coords, lines[i].start, lines[i].end) < hitTolerance) {
          lineToRemove = i;
          break;
        }
      }

      if (lineToRemove !== -1) {
        setLines(lines.filter((_, idx) => idx !== lineToRemove));
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    
    if (coords) {
      if (e.shiftKey && startPoint) {
        const dx = Math.abs(coords.x - startPoint.x);
        const dy = Math.abs(coords.y - startPoint.y);
        
        if (dx > dy) {
          setCurrentPoint({ x: coords.x, y: startPoint.y });
        } else {
          setCurrentPoint({ x: startPoint.x, y: coords.y });
        }
      } else {
        setCurrentPoint(coords);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (isDrawing && startPoint && currentPoint && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleRatio = canvasRef.current.width / rect.width;
      
      let finalPoint = getCoordinates(e) || currentPoint;

      if (e.shiftKey && finalPoint) {
        const dx = Math.abs(finalPoint.x - startPoint.x);
        const dy = Math.abs(finalPoint.y - startPoint.y);
        if (dx > dy) {
          finalPoint = { x: finalPoint.x, y: startPoint.y };
        } else {
          finalPoint = { x: startPoint.x, y: finalPoint.y };
        }
      }
      
      const dxFinal = finalPoint.x - startPoint.x;
      const dyFinal = finalPoint.y - startPoint.y;
      const distance = Math.sqrt(dxFinal * dxFinal + dyFinal * dyFinal);

      if (distance > 5 * scaleRatio) {
        setLines([...lines, { start: startPoint, end: finalPoint }]);
      }
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleCut = () => {
    if (!image || lines.length === 0) return;

    const width = image.width;
    const height = image.height;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');

    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, width, height);

    maskCtx.strokeStyle = '#000000';
    maskCtx.lineWidth = 1.5; 
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';

    lines.forEach(line => {
      maskCtx.beginPath();
      maskCtx.moveTo(line.start.x, line.start.y);
      maskCtx.lineTo(line.end.x, line.end.y);
      maskCtx.stroke();
    });

    const maskData = maskCtx.getImageData(0, 0, width, height).data;

    const origCanvas = document.createElement('canvas');
    origCanvas.width = width;
    origCanvas.height = height;
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(image, 0, 0);
    const origData = origCtx.getImageData(0, 0, width, height).data;

    const visited = new Uint8Array(width * height);
    const components = [];
    const queue = new Uint32Array(width * height);
    const pixelIndices = new Uint32Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (visited[idx]) continue;
        
        if (maskData[idx * 4] < 128) {
          visited[idx] = 1;
          continue;
        }

        let minX = x, maxX = x, minY = y, maxY = y;
        let qHead = 0, qTail = 0;
        let pCount = 0;
        
        queue[qTail++] = idx;
        visited[idx] = 1;

        while (qHead < qTail) {
          const curr = queue[qHead++];
          pixelIndices[pCount++] = curr;
          
          const cx = curr % width;
          const cy = Math.floor(curr / width);

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          if (cx > 0) {
            const n = curr - 1;
            if (!visited[n]) {
              visited[n] = 1;
              if (maskData[n * 4] >= 128) queue[qTail++] = n;
            }
          }
          if (cx < width - 1) {
            const n = curr + 1;
            if (!visited[n]) {
              visited[n] = 1;
              if (maskData[n * 4] >= 128) queue[qTail++] = n;
            }
          }
          if (cy > 0) {
            const n = curr - width;
            if (!visited[n]) {
              visited[n] = 1;
              if (maskData[n * 4] >= 128) queue[qTail++] = n;
            }
          }
          if (cy < height - 1) {
            const n = curr + width;
            if (!visited[n]) {
              visited[n] = 1;
              if (maskData[n * 4] >= 128) queue[qTail++] = n;
            }
          }
        }

        if (pCount > 50) {
          components.push({
            minX, maxX, minY, maxY,
            pixels: pixelIndices.slice(0, pCount)
          });
        }
      }
    }

    const newPieces = components.map(comp => {
      const compWidth = comp.maxX - comp.minX + 1;
      const compHeight = comp.maxY - comp.minY + 1;
      
      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = compWidth;
      pieceCanvas.height = compHeight;
      const pieceCtx = pieceCanvas.getContext('2d');
      const pieceImgData = pieceCtx.createImageData(compWidth, compHeight);
      
      for (let i = 0; i < comp.pixels.length; i++) {
        const pIdx = comp.pixels[i];
        const px = pIdx % width;
        const py = Math.floor(pIdx / width);
        
        const destX = px - comp.minX;
        const destY = py - comp.minY;
        const destIdx = (destY * compWidth + destX) * 4;
        const srcIdx = pIdx * 4;
        
        pieceImgData.data[destIdx] = origData[srcIdx];
        pieceImgData.data[destIdx + 1] = origData[srcIdx + 1];
        pieceImgData.data[destIdx + 2] = origData[srcIdx + 2];
        pieceImgData.data[destIdx + 3] = origData[srcIdx + 3];
      }
      
      pieceCtx.putImageData(pieceImgData, 0, 0);
      return pieceCanvas.toDataURL('image/png');
    });

    setPieces(newPieces);
    setLines([]);
  };

  const handleDownload = (pieceUrl, index) => {
    const link = document.createElement('a');
    link.download = `fatia-${index + 1}.png`;
    link.href = pieceUrl;
    link.click();
  };

  const clearLines = () => {
    setLines([]);
    setPieces([]);
    setZoom(1);
  };

  return (
    <div className="min-h-screen bg-[#ffdefa] p-8 text-white font-sans overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-2">
            <div className='flex-row flex justify-between'>
                <div>
                    <h1 className="text-3xl font-poppins font-bold text-[#d16eff]">Fatiador de Imagem</h1>
                    <p className="font-poppins text-neutral-500">Clique, segure e arraste o mouse sobre a imagem para criar cortes retos. Onde as linhas se cruzarem, novos pedaços serão criados.</p>
                </div>
                <img className='w-[10%] h-auto rounded-xl' src={fotoNicolle} alt="Nicolle 💕"/>
            </div>
        </header>

        <div className="flex items-center gap-4 mt-[-6%]">
          <label className="font-poppins bg-[#d16eff] hover:bg-[#bd30ff] text-white px-4 py-2 rounded cursor-pointer transition-colors font-medium">
            Carregar Imagem
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>

          {image && (
            <>
              <button
                onClick={handleCut}
                disabled={lines.length === 0}
                className="bg-pink-600 hover:bg-pink-700 font-poppins disabled:bg-pink-700 disabled:text-gray-300 text-white px-4 py-2 rounded transition-colors font-medium"
              >
                Fatiar Imagem
              </button>

              <button
                onClick={clearLines}
                disabled={lines.length === 0 && pieces.length === 0}
                className="bg-purple-700 font-poppins hover:bg-purple-600 disabled:bg-purple-800 disabled:text-neutral-200 text-white px-4 py-2 rounded transition-colors font-medium"
              >
                Limpar Tudo
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
          <div 
            ref={containerRef}
            className="lg:col-span-2 rounded-[20px] bg-[#ffabf2] relative flex flex-col min-h-[400px] h-[70vh] overflow-hidden"
          >
            {image && (
              <div className="absolute top-4 right-4 z-10 flex gap-2 bg-[#ffdefa] p-2 rounded-xl shadow-md">
                <button 
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} 
                  className="bg-pink-600 hover:bg-pink-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors"
                >
                  -
                </button>
                <span className="text-pink-900 font-poppins font-bold px-2 flex items-center justify-center min-w-[3rem]">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  onClick={() => setZoom(z => Math.min(5, z + 0.25))} 
                  className="bg-pink-600 hover:bg-pink-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
              </div>
            )}

            {!image ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-neutral-500 font-poppins">Nenhuma imagem carregada</p>
              </div>
            ) : (
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-auto p-4 grid place-items-center cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDoubleClick={handleDoubleClick}
              >
                <div 
                  className="relative shrink-0"
                  style={{
                    width: `${image.width * baseScale * zoom}px`,
                    height: `${image.height * baseScale * zoom}px`
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full block"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#ffabf2] rounded-[20px] p-6 space-y-4 max-h-[70vh] overflow-y-auto overflow-hidden">
            <h2 className="text-xl font-semibold font-poppins">Pedaços ({pieces.length})</h2>

            {pieces.length === 0 ? (
              <p className="text-neutral-500 text-sm font-poppins">Faça cortes e clique em Fatiar.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {pieces.map((piece, index) => (
                  <div key={index} className="space-y-2">
                    <div className="rounded bg-pink-800 aspect-square flex items-center justify-center p-2 relative overflow-hidden group">
                      <img
                        src={piece}
                        alt={`Pedaço ${index + 1}`}
                        className="max-w-full max-h-full object-contain drop-shadow-md transform group-hover:scale-110 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleDownload(piece, index)}
                          className="bg-purple-600 font-poppins hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm transition-colors"
                        >
                          Baixar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}