/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState, useMemo, useEffect } from "react";
// Importaciones de Chart.js para el gráfico de regresión
import { Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ScatterController,
  Title,
} from "chart.js";

// Registrar componentes necesarios de Chart.js
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ScatterController,
  Tooltip,
  Legend,
  Title
);

// Definimos interfaces para datos experimentales
interface Measurement {
  f: number; // Frecuencia detectada (Hz)
  L: number; // Longitud manual (m)
  invL: number; // 1/L (m⁻¹)
}

export default function Home() {
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);

  const [frequency, setFrequency] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [duration, setDuration] = useState("2");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- ESTADOS PARA EL EXPERIMENTO ---
  const [currentL, setCurrentL] = useState("");
  const [history, setHistory] = useState<Measurement[]>([]);

  // 1. Cálculos de Regresión Lineal (f vs 1/L)
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

    // Fórmula de Mínimos Cuadrados
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Física del tubo abierto-cerrado (botella): v = 4 * pendiente
    const speedOfSound = slope * 4;

    return { slope, intercept, speedOfSound };
  }, [history]);

  // 2. Configuración de datos para el gráfico de Regresión Gráfica
  const chartData = useMemo(() => {
    if (history.length === 0) return { datasets: [] };

    // Puntos experimentales (Scattering)
    const scatterPoints = history.map((m) => ({ x: m.invL, y: m.f }));

    const datasets: any[] = [
      {
        label: "Datos Experimentales",
        data: scatterPoints,
        backgroundColor: "rgb(37, 99, 235)", // Azul fuerte
        pointRadius: 6,
        type: "scatter",
      },
    ];

    // Línea de mejor ajuste (si hay regresión calculada)
    if (regression) {
      // Calculamos dos puntos extremos para la línea (min y max X)
      const minInvL = Math.min(...history.map((m) => m.invL)) * 0.95;
      const maxInvL = Math.max(...history.map((m) => m.invL)) * 1.05;

      const yAtMin = regression.slope * minInvL + regression.intercept;
      const yAtMax = regression.slope * maxInvL + regression.intercept;

      datasets.push({
        label: "Línea de Ajuste",
        data: [
          { x: minInvL, y: yAtMin },
          { x: maxInvL, y: yAtMax },
        ],
        borderColor: "rgb(22, 163, 74)", // Verde fuerte
        backgroundColor: "transparent",
        borderWidth: 3,
        pointRadius: 0,
        type: "line",
        fill: false,
        tension: 0, // Línea recta pura
      });
    }

    return { datasets };
  }, [history, regression]);

  // Opciones del gráfico de regresión
  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        type: "linear" as const,
        position: "bottom" as const,
        title: {
          display: true,
          text: "1/L (m⁻¹)",
          color: "rgb(75, 85, 99)",
          font: { size: 14, weight: "bold" as any },
        },
        grid: { color: "rgba(229, 231, 235, 0.5)" },
      },
      y: {
        type: "linear" as const,
        title: {
          display: true,
          text: "Frecuencia f (Hz)",
          color: "rgb(75, 85, 99)",
          font: { size: 14, weight: "bold" as any },
        },
        grid: { color: "rgba(229, 231, 235, 0.5)" },
      },
    },
    plugins: {
      title: {
        display: true,
        text: "Regresión Gráfica f vs 1/L",
        font: { size: 16, weight: "bold" as any },
        padding: { top: 10, bottom: 20 },
        color: "rgb(17, 24, 39)",
      },
      legend: { position: "bottom" as const },
    },
  };

  // Función de captura de audio con FFT y Espectrograma
  async function startAnalysis() {
    if (isAnalyzing) return;
    try {
      setIsAnalyzing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Alta resolución

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Referencias a los dos Canvas
      const fftCanvas = fftCanvasRef.current;
      const specCanvas = spectrogramCanvasRef.current;
      if (!fftCanvas || !specCanvas) return;

      const fftCtx = fftCanvas.getContext("2d");
      const specCtx = specCanvas.getContext("2d");
      if (!fftCtx || !specCtx) return;

      // Limpiar espectrograma al inicio de una nueva captura
      specCtx.clearRect(0, 0, specCanvas.width, specCanvas.height);
      let xOffset = 0; // Para desplazar el espectrograma
      let animationId: number;

      let topFreq = 0;
      let topAmp = 0;

      // Función de dibujo que se ejecuta por frame
      const draw = () => {
        analyser.getByteFrequencyData(dataArray);

        // --- Dibujo 1: FFT (Espectro) ---
        fftCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
        let maxAmpFrame = 0;
        let dominantIndexFrame = 0;

        // Dibujamos los primeros 400 bins (~8.6 kHz) para visualización
        for (let i = 0; i < 400; i++) {
          const value = dataArray[i];

          // Buscamos el pico dominante
          if (value > maxAmpFrame) {
            maxAmpFrame = value;
            dominantIndexFrame = i;
          }

          // Barras FFT (Azul degradado)
          fftCtx.fillStyle = `rgb(${value + 80}, 50, 220)`;
          fftCtx.fillRect(i * 3, fftCanvas.height - value * 1.4, 2, value * 1.4);

          // --- Dibujo 2: Espectrograma (Envolvente) ---
          specCtx.fillStyle = `rgb(${value}, 50, ${255 - value})`;
          specCtx.fillRect(xOffset, specCanvas.height - i, 2, 2);
        }

        // Actualizamos frecuencia e intensidad dominantes
        topFreq = Math.round((dominantIndexFrame * audioContext.sampleRate) / analyser.fftSize);
        topAmp = Math.round(maxAmpFrame);
        setFrequency(topFreq);
        setAmplitude(topAmp);

        // Desplazamos el espectrograma 2 pixeles a la derecha
        xOffset += 2;
        if (xOffset > specCanvas.width) xOffset = 0; // Reiniciar si se sale

        animationId = requestAnimationFrame(draw);
      };

      draw();

      // Temporizador de captura (por defecto 2 segundos)
      setTimeout(async () => {
        cancelAnimationFrame(animationId);
        stream.getTracks().forEach((track) => track.stop());
        await audioContext.close();
        setIsAnalyzing(false);
      }, Number(duration) * 1000);
    } catch (err) {
      console.error("Error micrófono:", err);
      setIsAnalyzing(false);
      alert("Error al acceder al micrófono. Verifica los permisos.");
    }
  }

  // Guardar medición en el historial para regresión
  const addMeasurement = () => {
    const L = parseFloat(currentL);
    if (isNaN(L) || L <= 0) {
      alert("Ingresa una longitud L válida (m)");
      return;
    }
    setHistory([...history, { f: frequency, L, invL: 1 / L }]);
    setCurrentL(""); // Limpiar input
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-black font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* PANEL DE CONTROL SUPERIOR (CAPTURA Y VISUALIZACIÓN) */}
        <div className="bg-white p-8 rounded-3xl shadow-lg border">
          <div className="flex items-center justify-between gap-6 mb-6">
            <h1 className="text-3xl font-extrabold text-slate-950">Laboratorio FFT de Resonancia</h1>
            
            <div className="flex gap-4 items-center bg-slate-100 p-2 rounded-2xl">
              <input
                type="number"
                placeholder="Tiempo (s)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="border p-3 rounded-xl w-32 bg-white text-lg"
                disabled={isAnalyzing}
              />
              <button
                onClick={startAnalysis}
                disabled={isAnalyzing}
                className={`text-white px-8 py-3 rounded-2xl text-lg font-semibold transition-colors duration-200 ${isAnalyzing ? "bg-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}
              >
                {isAnalyzing ? "Capturando..." : "Iniciar Análisis Web Audio"}
              </button>
            </div>
          </div>

          {/* Resultados Numéricos en Vivo */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-950 text-white p-6 rounded-2xl text-center space-y-2 border border-slate-700">
              <span className="text-xs uppercase tracking-widest text-slate-400">Frecuencia Dominante:</span>
              <span className="text-6xl font-mono font-black">{frequency} Hz</span>
            </div>
            <div className="bg-slate-100 p-6 rounded-2xl text-center space-y-2 border border-slate-200">
              <span className="text-xs uppercase tracking-widest text-slate-600">Intensidad Relativa:</span>
              <span className="text-6xl font-mono font-bold text-slate-900">{amplitude}</span>
            </div>
          </div>

          {/* Gráficos de Señal: Espectro y Espectrograma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">1. Espectro de Frecuencias (FFT)</h3>
              <canvas ref={fftCanvasRef} width={900} height={400} className="w-full bg-slate-950 rounded-2xl shadow-inner h-64" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">2. Espectrograma (Historia Temporal)</h3>
              <canvas ref={spectrogramCanvasRef} width={900} height={400} className="w-full bg-slate-950 rounded-2xl shadow-inner h-64" />
            </div>
          </div>
        </div>

        {/* PANEL INFERIOR EXPERIMENTAL (DATOS Y REGRESIÓN) */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          
          {/* LADO IZQUIERDO: REGISTRO DE DATOS */}
          <div className="space-y-6">
            <div className="bg-blue-50 p-7 rounded-3xl border-2 border-blue-200 shadow-sm">
              <h2 className="text-xl font-bold mb-4 text-blue-950">Añadir Medición al Experimento</h2>
              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Longitud L (metros). Ej: 0.20"
                  value={currentL}
                  onChange={(e) => setCurrentL(e.target.value)}
                  className="border-2 border-blue-300 p-3 rounded-xl flex-1 text-lg"
                />
                <button onClick={addMeasurement} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold">
                  Guardar Medición
                </button>
              </div>
              <p className="text-sm mt-3 text-slate-600 italic">* Registra la frecuencia detectada actual contra la longitud manual L de la columna de aire.</p>
            </div>

            {/* Tabla de Datos Limpia */}
            <div className="bg-white p-7 rounded-3xl shadow-lg border h-fit">
              <h2 className="text-xl font-bold mb-5">Tabla de Datos: Frecuencia (f) vs Longitud (L)</h2>
              <div className="overflow-auto max-h-80 pr-2">
                <table className="w-full text-base text-left border-collapse">
                  <thead className="bg-slate-100 rounded-lg">
                    <tr>
                      <th className="py-3 px-4 font-bold text-slate-800">L (m)</th>
                      <th className="py-3 px-4 font-bold text-slate-800">1 / L (m⁻¹)</th>
                      <th className="py-3 px-4 font-bold text-slate-800 font-serif">f (Hz)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((m, i) => (
                      <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <td className="py-3 px-4 font-medium">{m.L.toFixed(3)}</td>
                        <td className="py-3 px-4">{m.invL.toFixed(2)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-lg">{m.f}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {history.length === 0 && <p className="text-slate-400 text-center py-6">No hay datos registrados</p>}
            </div>
          </div>

          {/* LADO DERECHO: REGRESIÓN GRÁFICA Y RESULTADOS */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-lg border h-fit">
              {history.length < 2 && (
                <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                   Añade al menos 2 mediciones para generar la Regresión Lineal.
                </div>
              )}
              {history.length >= 2 && <Scatter options={chartOptions} data={chartData} />}
            </div>

            {regression && (
              <div className="bg-green-600 text-white p-7 rounded-3xl shadow-xl space-y-5 border border-green-700">
                <h2 className="text-2xl font-bold">Resultados del Análisis Físico</h2>
                
                {/* Ecuación de Regresión Limpia (f = m * x + b) */}
                <div className="bg-white/10 p-4 rounded-xl text-center space-y-2 border border-green-400/30">
                  <p className="text-sm uppercase tracking-wider text-green-200">Ecuación de Mejor Ajuste:</p>
                  <p className="font-mono text-3xl font-bold">
                    f = <span className="font-extrabold">{regression.slope.toFixed(2)}</span> × (1/L) + <span className="font-extrabold">{regression.intercept.toFixed(2)}</span>
                  </p>
                </div>

                <hr className="my-5 opacity-30 border-green-200" />
                
                <div className="text-center">
                  <p className="text-base uppercase tracking-wider text-green-200">Velocidad del Sonido Estimada ($v$):</p>
                  <p className="text-6xl font-black font-sans">{regression.speedOfSound.toFixed(2)} m/s</p>
                  <p className="text-xs mt-3 italic text-green-100">* Calculado matemáticamente como $v = 4 \times Pendiente$ (Modelo de tubo Abierto-Cerrado).</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN DE QR (RESTAURADA Y MEJORADA) */}
        <div className="bg-white rounded-3xl shadow-lg border p-8 mt-10 flex flex-col items-center">
           <h2 className="text-2xl font-bold mb-5 text-slate-950">Acceso Rápido al Laboratorio Web</h2>
           <img 
            src={`https://quickchart.io/qr?text=${encodeURIComponent("https://proyecto-fourier-web.vercel.app/")}&size=250&format=png`} 
            alt="Código QR del proyecto Fourier" 
            className="rounded-2xl shadow-xl border-4 border-slate-100 p-2"
           />
           <p className="text-sm mt-5 text-slate-500 font-mono">https://proyecto-fourier-web.vercel.app/</p>
        </div>

      </div>
    </main>
  );
}