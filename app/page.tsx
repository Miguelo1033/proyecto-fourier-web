/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState, useMemo } from "react";

interface Measurement {
  f: number;
  L: number;
  invL: number;
}

export default function Home() {
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const [frequency, setFrequency] = useState(0);
  const [duration, setDuration] = useState("2");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // --- NUEVOS ESTADOS PARA EL EXPERIMENTO ---
  const [currentL, setCurrentL] = useState(""); // Longitud manual
  const [history, setHistory] = useState<Measurement[]>([]);

  // Función para realizar la regresión lineal (Mínimos Cuadrados)
  const regression = useMemo(() => {
    if (history.length < 2) return null;

    const n = history.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    history.forEach((m) => {
      sumX += m.invL;
      sumY += m.f;
      sumXY += m.invL * m.f;
      sumX2 += m.invL * m.invL;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Según física de tubo abierto-cerrado (botella): v = 4 * pendiente
    // Si su profesor insiste en v = 2 * pendiente, cambiar el 4 por 2.
    const speedOfSound = slope * 4; 

    return { slope, intercept, speedOfSound };
  }, [history]);

  async function startAnalysis() {
    if (isAnalyzing) return;
    try {
      setIsAnalyzing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const fftCanvas = fftCanvasRef.current;
      const fftCtx = fftCanvas?.getContext("2d");
      let animationId: number;
      let topFreq = 0;

      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        if (fftCtx && fftCanvas) {
          fftCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
          let maxAmp = 0;
          let dominantIndex = 0;
          for (let i = 0; i < 400; i++) {
            if (dataArray[i] > maxAmp) {
              maxAmp = dataArray[i];
              dominantIndex = i;
            }
            fftCtx.fillStyle = `rgb(50, 50, 200)`;
            fftCtx.fillRect(i * 3, fftCanvas.height - dataArray[i], 2, dataArray[i]);
          }
          topFreq = Math.round((dominantIndex * audioContext.sampleRate) / analyser.fftSize);
          setFrequency(topFreq);
        }
        animationId = requestAnimationFrame(draw);
      };

      draw();
      setTimeout(async () => {
        cancelAnimationFrame(animationId);
        stream.getTracks().forEach(t => t.stop());
        await audioContext.close();
        setIsAnalyzing(false);
      }, Number(duration) * 1000);
    } catch (err) {
      setIsAnalyzing(false);
      alert("Error al acceder al micrófono");
    }
  }

  const addMeasurement = () => {
    const L = parseFloat(currentL);
    if (isNaN(L) || L <= 0) {
      alert("Ingresa una longitud L válida (m)");
      return;
    }
    setHistory([...history, { f: frequency, L, invL: 1 / L }]);
    setCurrentL("");
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-black">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        
        {/* LADO IZQUIERDO: CAPTURA EN VIVO */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h1 className="text-2xl font-bold mb-4">Control de Laboratorio</h1>
            <div className="flex gap-4 mb-4">
              <input 
                type="number" placeholder="Tiempo (s)" value={duration}
                onChange={e => setDuration(e.target.value)}
                className="border p-2 rounded-lg w-24"
              />
              <button 
                onClick={startAnalysis} disabled={isAnalyzing}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:bg-slate-300"
              >
                {isAnalyzing ? "Capturando..." : "Iniciar Captura"}
              </button>
            </div>
            <div className="text-center p-4 bg-slate-100 rounded-xl">
              <span className="text-sm block">Frecuencia Detectada:</span>
              <span className="text-5xl font-mono font-bold">{frequency} Hz</span>
            </div>
            <canvas ref={fftCanvasRef} width={600} height={200} className="w-full bg-black mt-4 rounded-lg" />
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200">
            <h2 className="font-bold mb-3">Registrar Dato Experimental</h2>
            <div className="flex gap-4">
              <input 
                type="number" placeholder="Longitud L (metros)" value={currentL}
                onChange={e => setCurrentL(e.target.value)}
                className="border p-2 rounded-lg flex-1"
              />
              <button onClick={addMeasurement} className="bg-green-600 text-white px-4 py-2 rounded-lg">
                Guardar Medición
              </button>
            </div>
            <p className="text-xs mt-2 text-slate-500">Ej: Si la columna mide 15cm, ingresa 0.15</p>
          </div>
        </div>

        {/* LADO DERECHO: RESULTADOS Y REGRESIÓN */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-md h-fit">
            <h2 className="text-xl font-bold mb-4">Tabla de Datos ($f$ vs $1/L$)</h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">L (m)</th>
                  <th className="py-2">1/L (m⁻¹)</th>
                  <th className="py-2">f (Hz)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m, i) => (
                  <tr key={i} className="border-b">
                    <td>{m.L.toFixed(3)}</td>
                    <td>{m.invL.toFixed(2)}</td>
                    <td>{m.f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && <p className="text-slate-400 text-center py-4">No hay datos guardados</p>}
          </div>

          {regression && (
            <div className="bg-green-600 text-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-xl font-bold mb-2">Resultados de Regresión</h2>
              <p className="text-lg opacity-90">Modelo: $f = {regression.slope.toFixed(2)} \cdot (1/L) + {regression.intercept.toFixed(2)}$</p>
              <hr className="my-4 opacity-30" />
              <div className="text-center">
                <p className="text-sm uppercase tracking-wider">Velocidad del Sonido Estimada:</p>
                <p className="text-5xl font-bold">{regression.speedOfSound.toFixed(2)} m/s</p>
                <p className="text-xs mt-2 italic">* Calculado como $v = 4 \times pendiente$ (Tubo abierto-cerrado)</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}