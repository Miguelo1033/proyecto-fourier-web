"use client";

import { useRef, useState } from "react";

export default function Home() {

  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);

  const [savedFFT, setSavedFFT] = useState("");

  const [frequency, setFrequency] = useState(0);
  const [secondaryFrequency, setSecondaryFrequency] = useState(0);
  const [amplitude, setAmplitude] = useState(0);

  const [duration, setDuration] = useState("");

  const [lastResult, setLastResult] = useState({
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

    const analysisTime = Number(duration);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const audioContext = new AudioContext();

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

    specCtx.clearRect(
      0,
      0,
      specCanvas.width,
      specCanvas.height
    );

    let xOffset = 0;

    let animationId = 0;

    let finalDominant = 0;
    let finalSecondary = 0;
    let finalAmplitude = 0;

    function draw() {

      analyser.getByteFrequencyData(dataArray);

      fftCtx.clearRect(
        0,
        0,
        fftCanvas.width,
        fftCanvas.height
      );

      let maxAmp = 0;
      let dominantIndex = 0;

      let secondAmp = 0;
      let secondIndex = 0;

      for (let i = 0; i < 300; i++) {

        const value = dataArray[i];

        if (value < 15) continue;

        if (value > maxAmp) {

          secondAmp = maxAmp;
          secondIndex = dominantIndex;

          maxAmp = value;
          dominantIndex = i;
        }

        const barHeight = value * 1.4;

        fftCtx.fillStyle = `rgb(${value + 80},50,220)`;

        fftCtx.fillRect(
          i * 3,
          fftCanvas.height - barHeight,
          2,
          barHeight
        );

        specCtx.fillStyle =
          `rgb(${value},50,${255 - value})`;

        specCtx.fillRect(
          xOffset,
          specCanvas.height - i,
          2,
          2
        );
      }

      xOffset += 2;

      const dominantFreq =
        dominantIndex * audioContext.sampleRate / analyser.fftSize;

      const secondFreq =
        secondIndex * audioContext.sampleRate / analyser.fftSize;

      setFrequency(Math.round(dominantFreq));

      setSecondaryFrequency(Math.round(secondFreq));

      setAmplitude(Math.round(maxAmp));

      finalDominant = Math.round(dominantFreq);
      finalSecondary = Math.round(secondFreq);
      finalAmplitude = Math.round(maxAmp);

      animationId = requestAnimationFrame(draw);
    }

    draw();

    setTimeout(() => {

      cancelAnimationFrame(animationId);

      stream.getTracks().forEach(track => track.stop());

      setLastResult({
        dominant: finalDominant,
        secondary: finalSecondary,
        amplitude: finalAmplitude,
        duration: analysisTime
      });

      const savedImage =
        fftCanvas.toDataURL("image/png");

      setSavedFFT(savedImage);

    }, analysisTime * 1000);
  }

  function exportFFT() {

    if (!savedFFT) {
      alert("No hay FFT guardada");
      return;
    }

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

          <h1 className="text-5xl font-bold mb-4 text-black">
            Laboratorio FFT Interactivo
          </h1>

          <p className="text-black mb-6">
            Proyecto universitario sobre análisis espectral,
            resonancia acústica y procesamiento digital de señales.
          </p>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-gray-100 rounded-2xl p-4">
              <h2 className="font-semibold mb-2 text-black">
                Frecuencia dominante
              </h2>

              <p className="text-4xl font-bold text-black">
                {frequency} Hz
              </p>
            </div>

            <div className="bg-gray-100 rounded-2xl p-4">
              <h2 className="font-semibold mb-2 text-black">
                Frecuencia secundaria
              </h2>

              <p className="text-4xl font-bold text-black">
                {secondaryFrequency} Hz
              </p>
            </div>

            <div className="bg-gray-100 rounded-2xl p-4">
              <h2 className="font-semibold mb-2 text-black">
                Intensidad
              </h2>

              <p className="text-4xl font-bold text-black">
                {amplitude}
              </p>
            </div>

          </div>

          <div className="mt-6 flex gap-4 items-center flex-wrap">

            <input
              type="number"
              placeholder="Tiempo en segundos"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="border rounded-xl p-3 w-56 text-black"
            />

            <button
              onClick={startAnalysis}
              className="bg-black text-white px-6 py-3 rounded-2xl"
            >
              Iniciar análisis
            </button>

          </div>

          <div className="mt-6 bg-gray-100 rounded-2xl p-4">

            <h2 className="text-2xl font-bold mb-4 text-black">
              Último análisis guardado
            </h2>

            <p className="text-black">
              Frecuencia dominante: {lastResult.dominant} Hz
            </p>

            <p className="text-black">
              Frecuencia secundaria: {lastResult.secondary} Hz
            </p>

            <p className="text-black">
              Intensidad máxima: {lastResult.amplitude}
            </p>

            <p className="text-black">
              Tiempo analizado: {lastResult.duration} s
            </p>

          </div>

        </div>

        <div className="grid md:grid-cols-2 gap-6">

          <div className="bg-white rounded-3xl shadow-xl p-6">

            <h2 className="text-2xl font-bold mb-4 text-black">
              Espectro FFT
            </h2>

            <canvas
              ref={fftCanvasRef}
              width={900}
              height={400}
              className="w-full bg-black rounded-2xl"
            />

            <button
              onClick={exportFFT}
              className="mt-4 bg-black text-white px-4 py-2 rounded-xl"
            >
              Exportar FFT
            </button>

            {savedFFT && (
              <div className="mt-6">

                <h3 className="text-xl font-bold text-black mb-2">
                  Última FFT guardada
                </h3>

                <img
                  src={savedFFT}
                  alt="FFT guardada"
                  className="rounded-2xl border"
                />

              </div>
            )}

          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6">

            <h2 className="text-2xl font-bold mb-4 text-black">
              Espectrograma
            </h2>

            <canvas
              ref={spectrogramCanvasRef}
              width={900}
              height={400}
              className="w-full bg-black rounded-2xl"
            />

            <button
              onClick={exportSpectrogram}
              className="mt-4 bg-black text-white px-4 py-2 rounded-xl"
            >
              Exportar espectrograma
            </button>

          </div>

        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 mt-6 flex flex-col items-center">

          <h2 className="text-2xl font-bold mb-4 text-black">
            Escanea el QR
          </h2>

          <img
            src="https://quickchart.io/qr?text=https://proyecto-fourier-web.vercel.app/&size=250"
            alt="QR"
            className="rounded-2xl shadow-md"
          />

        </div>

      </div>

    </main>
  );
}