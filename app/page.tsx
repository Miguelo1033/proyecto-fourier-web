/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useRef, useEffect } from "react";
// IMPORTANTE: Cambiamos Scatter por Line para mayor estabilidad en móviles
import { Line } from "react-chartjs-2";
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
  const [duration, setDuration] = useState<string>("3");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<number>(0);
  const [amplitude, setAmplitude] = useState<number>(0);
  const [inputL, setInputL] = useState<string>("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [velocity, setVelocity] = useState<number | null>(null);

  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- LÓGICA DE REGRESIÓN (BLINDADA CONTRA EL INFINITO) ---
  useEffect(() => {
    if (measurements.length < 2) {
      setVelocity(null);
      return;
    }
    const n = measurements.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    measurements.forEach((m) => {
      sumX += m.invL; 
      sumY += m.f;
      sumXY += m.invL * m.f; 
      sumXX += m.invL * m.invL;
    });
    
    const denominator = n * sumXX - sumX * sumX;
    
    // ESCUDO MATEMÁTICO: Evita división por 0 o números diminutos
    if (Math.abs(denominator) < 1e-7) {
      setVelocity(null);
      return;
    }
    
    const slope = (n * sumXY - sumX * sumY) / denominator;
    setVelocity(2 * slope); 
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
      alert("Error al acceder al micrófono.");
    }
  }

  // --- AGREGAR MEDIDAS ---
  const handleAddMeasurement = () => {
    const L = parseFloat(inputL);
    if (!L || isNaN(L) || L <= 0) {
      alert("Por favor, ingresa una longitud válida.");
      return;
    }

    // ESCUDO DE DUPLICADOS: Si la longitud ya existe, no la dejamos pasar
    if (measurements.some(m => m.L === L)) {
      alert(`Ya registraste la longitud ${L}m. Ingresa una diferente para poder generar la recta correctamente.`);
      return;
    }
    
    if (L > 2) {
      const confirmacion = window.confirm(
        `¿Estás seguro de que el tubo mide ${L} metros? Recuerda ingresar el dato en metros. Ejemplo: si mide 23 cm, debes escribir 0.23`
      );
      if (!confirmacion) return;
    }

    if (frequency <= 0) {
      alert("Primero debes capturar una frecuencia estable.");
      return;
    }

    setMeasurements([...measurements, { L, invL: 1 / L, f: frequency }]);
    setInputL("");
  };

  // --- DATA DE GRÁFICA CONFIGURADA PARA MÓVILES ---
  const chartDatasets: any[] = [
    {
      label: "Datos Experimentales (f vs 1/L)",
      data: measurements.map(m => ({ x: m.invL, y: m.f })),
      backgroundColor: "#60a5fa",
      pointRadius: 8,
      showLine: false, // Esto hace que se vea como un Scatter dentro de un componente Line
      type: "line",
    }
  ];

  if (velocity !== null && measurements.length >= 2) {
    const n = measurements.length;
    const sumX = measurements.reduce((acc, m) => acc + m.invL, 0);
    const sumY = measurements.reduce((acc, m) => acc + m.f, 0);
    const slope = velocity / 2; 
    const intercept = (sumY - slope * sumX) / n;

    const minX = Math.min(...measurements.map(m => m.invL)) * 0.8;
    const maxX = Math.max(...measurements.map(m => m.invL)) * 1.2;

    chartDatasets.push({
      label: "Ajuste por Mínimos Cuadrados",
      data: [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept }
      ],
      type: "line",
      borderColor: "#34d399",
      borderWidth: 3,
      pointRadius: 0,
      fill: false,
    });
  }

  const chartData = { datasets: chartDatasets };

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-slate-200 p-4 md:p-10 font-sans">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">Analisis de frencuencia <span className="text-blue-500 text-lg">v2.0</span></h1>
          <p className="text-slate-500 text-sm font-mono">UdeA • Ingeniería de Sonido • Resonancia</p>
        </div>
        
        <div className="bg-white p-2 rounded-lg flex flex-col items-center shadow-lg shadow-blue-500/10 shrink-0">
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://proyecto-fourier-web.vercel.app/"
            alt="Link del proyecto" 
            className="w-16 h-16"
          />
          <span className="text-[10px] text-black font-bold mt-1 uppercase">Abrir en móvil</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm">
            <h3 className="text-blue-400 font-bold uppercase text-xs mb-4 tracking-widest">Configuración</h3>
            
            <div className="mb-6">
              <label className="text-xs text-slate-400 block mb-2">Tiempo de análisis (segundos):</label>
              <input 
                type="number" 
                value={duration} 
                onChange={e => setDuration(e.target.value)}
                className="w-full bg-black border border-slate-700 p-3 rounded-xl focus:ring-2 ring-blue-500 outline-none text-center font-bold"
                min="1"
                max="15"
              />
            </div>

            <button 
              onClick={startAnalysis} 
              disabled={isAnalyzing}
              className={`w-full py-4 rounded-2xl font-black transition-all shadow-xl text-white ${
                isAnalyzing ? "bg-red-500 animate-pulse" : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/10"
              }`}
            >
              {isAnalyzing ? "🎙️ ESCUCHANDO TUBO..." : "CAPTURAR FRECUENCIA"}
            </button>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
            <h3 className="text-emerald-400 font-bold uppercase text-xs mb-4 tracking-widest">Registrar Medida</h3>
            <label className="text-xs text-slate-400 block mb-2">Longitud de la columna L (en metros):</label>
            <input 
              type="number" 
              step="0.001" 
              value={inputL} 
              onChange={e => setInputL(e.target.value)}
              className="w-full bg-black border border-slate-700 p-3 rounded-xl mb-2 outline-none text-center font-mono" 
              placeholder="Ej: 0.230" 
            />
            <span className="text-[11px] text-slate-500 block mb-4 italic text-center">23 cm se ingresa como 0.23</span>
            
            <button 
              onClick={handleAddMeasurement} 
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold transition-all"
            >
              GUARDAR PUNTO
            </button>
          </div>

          {velocity !== null && (
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-3xl text-white shadow-2xl shadow-emerald-500/20">
              <p className="text-[10px] font-black uppercase opacity-80 tracking-wider">Velocidad del Sonido Estimada</p>
              <p className="text-4xl font-black">{velocity.toFixed(2)} <span className="text-sm font-normal">m/s</span></p>
              <p className="text-[9px] opacity-60 mt-2 font-mono">* Calculado como v = 2 × pendiente</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
               <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-wide">Espectro de Frecuencia FFT (Pico: {frequency} Hz)</p>
               <canvas ref={fftCanvasRef} width={400} height={200} className="w-full h-48 bg-black rounded-xl" />
             </div>
             <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
               <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-wide">Espectrograma (Cascada Temporal)</p>
               <canvas ref={spectrogramCanvasRef} width={400} height={200} className="w-full h-48 bg-black rounded-xl" />
             </div>
          </div>

          <div className="bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-inner">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Modelo de Ajuste Lineal (f vs 1/L)</h2>
                <div className="text-xs font-mono px-3 py-1 bg-slate-950 rounded-full text-slate-400">Muestras: N = {measurements.length}</div>
             </div>
             <div className="h-[400px] w-full">
                {/* AHORA USAMOS COMPONENTE LINE */}
                <Line 
                  data={chartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    scales: {
                      x: { type: 'linear', grid: { color: '#1e293b' }, title: { display: true, text: 'Inverso de la Longitud 1/L (m⁻¹)', color: '#94a3b8'} },
                      y: { grid: { color: '#1e293b' }, title: { display: true, text: 'Frecuencia f (Hz)', color: '#94a3b8'} }
                    }
                  } as any} 
                />
             </div>
          </div>

          <div className="bg-slate-900/30 rounded-3xl border border-slate-800 overflow-hidden">
             <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
               <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Matriz de Datos Registrados</span>
               {measurements.length > 0 && (
                 <button onClick={() => setMeasurements([])} className="text-xs text-red-400 hover:underline">Limpiar datos</button>
               )}
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-4">Índice</th>
                      <th className="p-4">Longitud L (m)</th>
                      <th className="p-4">Inverso 1/L (m⁻¹)</th>
                      <th className="p-4">Frecuencia f (Hz)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {measurements.map((m, i) => (
                      <tr key={i} className="hover:bg-blue-500/5 transition-colors">
                        <td className="p-4 text-slate-500 font-mono">#{i+1}</td>
                        <td className="p-4 font-bold font-mono">{m.L.toFixed(3)}</td>
                        <td className="p-4 text-blue-400 font-mono">{m.invL.toFixed(3)}</td>
                        <td className="p-4 text-indigo-400 font-black font-mono">{m.f} Hz</td>
                      </tr>
                    ))}
                    {measurements.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-600 italic">Ningún punto guardado todavía.</td>
                      </tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        </div>
      </div>
    </main>
  );
}
