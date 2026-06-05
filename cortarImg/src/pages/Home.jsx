import { useState, useRef, useEffect } from 'react';
import fotoNicolle from '../assets/nicolle.png'

export default function Home() {
  const [image, setImage] = useState(null);
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [pieces, setPieces] = useState([]);
  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setLines([]);
        setPieces([]);
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
        return;
      }

      setIsDrawing(true);
      setStartPoint(coords);
      setCurrentPoint(coords);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (coords) {
      setCurrentPoint(coords);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && startPoint && currentPoint && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleRatio = canvasRef.current.width / rect.width;
      
      const dx = currentPoint.x - startPoint.x;
      const dy = currentPoint.y - startPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 5 * scaleRatio) {
        setLines([...lines, { start: startPoint, end: currentPoint }]);
      }
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const splitPolygon = (polygon, line) => {
    const getSide = (p, a, b) => {
      const val = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      return Math.abs(val) < 1e-9 ? 0 : (val > 0 ? 1 : -1);
    };

    const getIntersection = (a, b, c, d) => {
      const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
      if (den === 0) return null;
      const numX = (a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x);
      const numY = (a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x);
      return { x: numX / den, y: numY / den };
    };

    const poly1 = [];
    const poly2 = [];

    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];

      const sideCurrent = getSide(current, line.start, line.end);
      const sideNext = getSide(next, line.start, line.end);

      if (sideCurrent >= 0) poly1.push(current);
      if (sideCurrent <= 0) poly2.push(current);

      if (sideCurrent * sideNext < 0) {
        const intersection = getIntersection(line.start, line.end, current, next);
        if (intersection) {
          poly1.push(intersection);
          poly2.push(intersection);
        }
      }
    }

    const getArea = (poly) => {
      let area = 0;
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
      }
      return Math.abs(area / 2);
    };

    if (getArea(poly1) < 1 || getArea(poly2) < 1) {
      return [polygon];
    }

    return [poly1, poly2];
  };

  const handleCut = () => {
    if (!image || lines.length === 0) return;

    let currentPolys = [
      [
        { x: 0, y: 0 },
        { x: image.width, y: 0 },
        { x: image.width, y: image.height },
        { x: 0, y: image.height }
      ]
    ];

    lines.forEach(line => {
      let nextPolys = [];
      currentPolys.forEach(poly => {
        const splits = splitPolygon(poly, line);
        nextPolys.push(...splits);
      });
      currentPolys = nextPolys;
    });

    const newPieces = currentPolys.map(poly => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      poly.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });

      const width = maxX - minX;
      const height = maxY - minY;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      ctx.beginPath();
      ctx.moveTo(poly[0].x - minX, poly[0].y - minY);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x - minX, poly[i].y - minY);
      }
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(image, -minX, -minY);
      return canvas.toDataURL('image/png');
    });

    newPieces.sort((a, b) => a.length - b.length);
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
          <div className="lg:col-span-2 rounded-[20px] overflow-hidden bg-[#ffabf2] flex items-center justify-center min-h-[400px]">
            {!image ? (
              <p className="text-neutral-500 font-poppins">Nenhuma imagem carregada</p>
            ) : (
              <div 
                className="relative p-10 cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  className="max-w-full h-auto"
                  style={{ maxHeight: '70vh' }}
                />
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