"use client";

import React, { useState, useRef, useEffect } from "react";
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface Measurement {
  L: number;
  invL: number;
  f: number;
}

export default function ResonanciaFinal() {
  const [duration, setDuration] = useState<string>("3"); // Tiempo de escucha
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<number>(0);
  const [amplitude, setAmplitude] = useState<number>(0);
  const [inputL, setInputL] = useState<string>("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [velocity, setVelocity] = useState<number | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Obtener URL para el QR al cargar
  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  // --- LÓGICA DE REGRESIÓN ---
  useEffect(() => {
    if (measurements.length < 2) {
      setVelocity(null);
      return;
    }
    const n = measurements.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    measurements.forEach((m) => {
      sumX += m.invL; sumY += m.f;
      sumXY += m.invL * m.f; sumXX += m.invL * m.invL;
    });
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    setVelocity(2 * slope); // Ajuste según tu fórmula v=2*m
  }, [measurements]);

  // --- CAPTURA DE AUDIO ---
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

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const fftCtx = fftCanvasRef.current?.getContext("2d");
      const specCtx = spectrogramCanvasRef.current?.getContext("2d");

      let xOffset = 0;
      let animationId: number;
      let maxAmpObserved = 0;
      let bestFreqObserved = 0;

      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        if (fftCtx) {
          fftCtx.clearRect(0, 0, 800, 300);
          fftCtx.fillStyle = "#3b82f6";
          for (let i = 0; i < 400; i++) {
            const val = dataArray[i];
            if (val > (dataArray[bestFreqObserved] || 0)) {
               // Búsqueda simple de pico
            }
            fftCtx.fillRect(i * 2, 300 - val, 1.5, val);
          }
        }

        let frameMax = 0;
        let frameIdx = 0;
        for (let i = 0; i < 500; i++) {
          if (dataArray[i] > frameMax) {
            frameMax = dataArray[i];
            frameIdx = i;
          }
        }

        const currentF = Math.round((frameIdx * audioContext.sampleRate) / analyser.fftSize);
        if (frameMax > maxAmpObserved) {
          maxAmpObserved = frameMax;
          bestFreqObserved = currentF;
        }

        setFrequency(currentF);
        setAmplitude(frameMax);
        
        if (specCtx) {
          for (let i = 0; i < 300; i++) {
            const v = dataArray[i];
            specCtx.fillStyle = `rgb(${v}, ${v/2}, ${255-v})`;
            specCtx.fillRect(xOffset, 300 - i, 2, 2);
          }
        }
        xOffset = (xOffset + 1) % 800;
        animationId = requestAnimationFrame(draw);
      };

      draw();
      setTimeout(async () => {
        cancelAnimationFrame(animationId);
        stream.getTracks().forEach(t => t.stop());
        await audioContext.close();
        setFrequency(bestFreqObserved);
        setIsAnalyzing(false);
      }, Number(duration) * 1000);
    } catch (e) {
      setIsAnalyzing(false);
      alert("Error micrófono");
    }
  }

  const scatterData = {
    datasets: [
      {
        label: "Datos Experimentales",
        data: measurements.map(m => ({ x: m.invL, y: m.f })),
        backgroundColor: "#60a5fa",
        pointRadius: 8,
      },
      ...(velocity ? [{
        label: "Regresión Lineal",
        data: [
          { x: 0, y: (velocity/2) * 0 + (measurements[0]?.f - (velocity/2)*measurements[0]?.invL || 0) },
          { x: 15, y: (velocity/2) * 15 + (measurements[0]?.f - (velocity/2)*measurements[0]?.invL || 0) }
        ],
        type: "line" as const,
        borderColor: "#34d399",
        borderWidth: 3,
        pointRadius: 0,
      }] : [])
    ]
  };

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-slate-200 p-4 md:p-10">
      {/* HEADER CON QR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Analisis de resonancia <span className="text-blue-500 text-lg">V.1</span></h1>
          <p className="text-slate-500 text-sm font-mono">UdeA • Ingeniería • Resonancia</p>
        </div>
        
        <div className="bg-white p-2 rounded-lg flex flex-col items-center shadow-lg shadow-blue-500/10">
        <img 
        src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://proyecto-fourier-web.vercel.app/" 
        alt="QR Code" 
        className="w-16 h-16"
        />
        <span className="text-[10px] text-black font-bold mt-1 uppercase">Abrir en móvil</span>
      </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* COLUMNA IZQUIERDA: CONTROLES (1/4) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm">
            <h3 className="text-blue-400 font-bold uppercase text-xs mb-4 tracking-widest">Configuración</h3>
            
            <div className="mb-6">
              <label className="text-xs text-slate-400 block mb-2">Tiempo de análisis (s):</label>
              <input 
                type="number" 
                value={duration} 
                onChange={e => setDuration(e.target.value)}
                className="w-full bg-black border border-slate-700 p-3 rounded-xl focus:ring-2 ring-blue-500 outline-none"
              />
            </div>

            <button 
              onClick={startAnalysis} 
              disabled={isAnalyzing}
              className={`w-full py-4 rounded-2xl font-black transition-all shadow-xl ${
                isAnalyzing ? "bg-red-500 animate-pulse" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {isAnalyzing ? "ANALIZANDO..." : "CAPTURAR FRECUENCIA"}
            </button>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
            <h3 className="text-emerald-400 font-bold uppercase text-xs mb-4 tracking-widest">Añadir Medida</h3>
            <label className="text-xs text-slate-400 block mb-2">Longitud L (m):</label>
            <input 
              type="number" 
              step="0.001" 
              value={inputL} 
              onChange={e => setInputL(e.target.value)}
              className="w-full bg-black border border-slate-700 p-3 rounded-xl mb-4 outline-none" 
              placeholder="Ej: 0.155" 
            />
            <button onClick={() => {
                const L = parseFloat(inputL);
                if(!L || frequency <= 0) return alert("Captura frecuencia primero");
                setMeasurements([...measurements, { L, invL: 1/L, f: frequency }]);
                setInputL("");
            }} className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold">
              GUARDAR PUNTO
            </button>
          </div>

          {velocity && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-2xl shadow-blue-500/20">
              <p className="text-[10px] font-black uppercase opacity-70">Velocidad del Sonido</p>
              <p className="text-4xl font-black">{velocity.toFixed(2)} <span className="text-sm font-normal">m/s</span></p>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: GRÁFICAS GRANDES (3/4) */}
        <div className="lg:col-span-3 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
               <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Espectro de Frecuencia (Pico: {frequency}Hz)</p>
               <canvas ref={fftCanvasRef} width={400} height={200} className="w-full h-48 bg-black rounded-xl" />
             </div>
             <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
               <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Espectrograma en Tiempo Real</p>
               <canvas ref={spectrogramCanvasRef} width={400} height={200} className="w-full h-48 bg-black rounded-xl" />
             </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-inner">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Gráfica de Resonancia: F vs 1/L</h2>
                <div className="text-xs text-slate-500">N= {measurements.length} puntos</div>
             </div>
             <div className="h-[400px] w-full">
                {/* Agregamos "as any" en data y en options para silenciar a TypeScript */}
                <Scatter 
                  data={scatterData as any} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: {
                      x: { grid: { color: '#1e293b' }, title: { display: true, text: 'Inverso de la Longitud 1/L (m⁻¹)', color: '#94a3b8'} },
                      y: { grid: { color: '#1e293b' }, title: { display: true, text: 'Frecuencia f (Hz)', color: '#94a3b8'} }
                    }
                  } as any} 
                />
             </div>
          </div>

          {/* TABLA DE DATOS */}
          <div className="bg-slate-900/30 rounded-3xl border border-slate-800 overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr><th className="p-4">Medición</th><th className="p-4">Longitud L(m)</th><th className="p-4">Inverso 1/L</th><th className="p-4">Frecuencia (Hz)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {measurements.map((m, i) => (
                    <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                      <td className="p-4 text-slate-500 font-mono">#{i+1}</td>
                      <td className="p-4 font-bold">{m.L}</td>
                      <td className="p-4 text-blue-400">{m.invL.toFixed(3)}</td>
                      <td className="p-4 text-indigo-400 font-black">{m.f}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      </div>
    </main>
  );
}