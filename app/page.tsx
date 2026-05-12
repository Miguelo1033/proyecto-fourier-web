/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";

// Definimos una interfaz para el estado de los resultados
interface AnalysisResult {
  dominant: number;
  secondary: number;
  amplitude: number;
  duration: number;
}

export default function Home() {
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);

  const [savedFFT, setSavedFFT] = useState("");
  const [frequency, setFrequency] = useState(0);
  const [secondaryFrequency, setSecondaryFrequency] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [duration, setDuration] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [lastResult, setLastResult] = useState<AnalysisResult>({
    dominant: 0,
    secondary: 0,
    amplitude: 0,
    duration: 0
  });

  async function startAnalysis() {
    if (!duration || Number(duration) <= 0) {
      alert("Ingresa un tiempo válido");
      return;
    }

    if (isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      const analysisTime = Number(duration);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const fftCanvas = fftCanvasRef.current;
      const specCanvas = spectrogramCanvasRef.current;

      if (!fftCanvas || !specCanvas) return;

      const fftCtx = fftCanvas.getContext("2d");
      const specCtx = specCanvas.getContext("2d");

      if (!fftCtx || !specCtx) return;

      specCtx.clearRect(0, 0, specCanvas.width, specCanvas.height);
      let xOffset = 0;
      let animationId: number;

      let finalDominant = 0;
      let finalSecondary = 0;
      let finalAmplitude = 0;

      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        fftCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);

        let maxAmp = 0;
        let dominantIndex = 0;
        let secondAmp = 0;
        let secondIndex = 0;

        for (let i = 0; i < 300; i++) {
          const value = dataArray[i];

          if (value > maxAmp) {
            secondAmp = maxAmp;
            secondIndex = dominantIndex;
            maxAmp = value;
            dominantIndex = i;
          } else if (value > secondAmp) {
            secondAmp = value;
            secondIndex = i;
          }

          const barHeight = value * 1.4;
          fftCtx.fillStyle = `rgb(${value + 80}, 50, 220)`;
          fftCtx.fillRect(i * 3, fftCanvas.height - barHeight, 2, barHeight);

          specCtx.fillStyle = `rgb(${value}, 50, ${255 - value})`;
          specCtx.fillRect(xOffset, specCanvas.height - i, 2, 2);
        }

        xOffset += 2;
        const dominantFreq = (dominantIndex * audioContext.sampleRate) / analyser.fftSize;
        const secondFreq = (secondIndex * audioContext.sampleRate) / analyser.fftSize;

        setFrequency(Math.round(dominantFreq));
        setSecondaryFrequency(Math.round(secondFreq));
        setAmplitude(Math.round(maxAmp));

        finalDominant = Math.round(dominantFreq);
        finalSecondary = Math.round(secondFreq);
        finalAmplitude = Math.round(maxAmp);

        animationId = requestAnimationFrame(draw);
      };

      draw();

      setTimeout(async () => {
        cancelAnimationFrame(animationId);
        
        stream.getTracks().forEach(track => track.stop());
        await audioContext.close();
        setIsAnalyzing(false);

        setLastResult({
          dominant: finalDominant,
          secondary: finalSecondary,
          amplitude: finalAmplitude,
          duration: analysisTime
        });

        setSavedFFT(fftCanvas.toDataURL("image/png"));
      }, analysisTime * 1000);

    } catch (err) {
      console.error("Error accediendo al micro:", err);
      alert("Error al acceder al micrófono. Por favor permite los permisos.");
      setIsAnalyzing(false);
    }
  }

  function exportFFT() {
    if (!savedFFT) { alert("No hay FFT guardada"); return; }
    const link = document.createElement("a");
    link.download = "fft_resultado.png";
    link.href = savedFFT;
    link.click();
  }

  function exportSpectrogram() {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "espectrograma.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <h1 className="text-5xl font-bold mb-4 text-black">Laboratorio FFT Interactivo</h1>
          <p className="text-black mb-6">Proyecto universitario sobre análisis espectral y procesamiento digital de señales.</p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-100 rounded-2xl p-4 text-black">
              <h2 className="font-semibold mb-2">Frecuencia dominante</h2>
              <p className="text-4xl font-bold">{frequency} Hz</p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-4 text-black">
              <h2 className="font-semibold mb-2">Frecuencia secundaria</h2>
              <p className="text-4xl font-bold">{secondaryFrequency} Hz</p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-4 text-black">
              <h2 className="font-semibold mb-2">Intensidad</h2>
              <p className="text-4xl font-bold">{amplitude}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-4 items-center flex-wrap">
            <input
              type="number"
              placeholder="Segundos"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="border rounded-xl p-3 w-40 text-black"
              disabled={isAnalyzing}
            />
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className={`${isAnalyzing ? 'bg-gray-400' : 'bg-black'} text-white px-6 py-3 rounded-2xl transition-colors`}
            >
              {isAnalyzing ? "Analizando..." : "Iniciar análisis"}
            </button>
          </div>

          <div className="mt-6 bg-gray-100 rounded-2xl p-4 text-black">
            <h2 className="text-2xl font-bold mb-4">Último análisis guardado</h2>
            <div className="grid grid-cols-2 gap-2">
               <p>Dominante: {lastResult.dominant} Hz</p>
               <p>Secundaria: {lastResult.secondary} Hz</p>
               <p>Intensidad: {lastResult.amplitude}</p>
               <p>Tiempo: {lastResult.duration}s</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-black">Espectro FFT</h2>
            <canvas ref={fftCanvasRef} width={900} height={400} className="w-full bg-black rounded-2xl" />
            <button onClick={exportFFT} className="mt-4 bg-black text-white px-4 py-2 rounded-xl">Exportar FFT</button>
            {savedFFT && (
              <div className="mt-6">
                <h3 className="text-xl font-bold text-black mb-2">Última captura</h3>
                <img src={savedFFT} alt="FFT guardada" className="rounded-2xl border w-full" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-black">Espectrograma</h2>
            <canvas ref={spectrogramCanvasRef} width={900} height={400} className="w-full bg-black rounded-2xl" />
            <button onClick={exportSpectrogram} className="mt-4 bg-black text-white px-4 py-2 rounded-xl">Exportar Espectrograma</button>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-xl p-6 mt-6 flex flex-col items-center">
           <h2 className="text-2xl font-bold mb-4 text-black">Escanea el QR</h2>
           <img 
            src={`https://quickchart.io/qr?text=${encodeURIComponent("https://proyecto-fourier-web.vercel.app/")}&size=250`} 
            alt="QR" 
            className="rounded-2xl shadow-md"
           />
        </div>
      </div>
    </main>
  );
}