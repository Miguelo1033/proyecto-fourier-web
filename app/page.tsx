"use client";

import { useRef, useState } from "react";

export default function Home() {

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [frequency, setFrequency] = useState(0);

  const [duration, setDuration] = useState(5);

  const [analyzing, setAnalyzing] = useState(false);

  async function startAnalysis() {

    setAnalyzing(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const audioContext = new AudioContext();

    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;

    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    let globalMax = 0;
    let dominantFreq = 0;

    function draw() {

      analyser.getByteFrequencyData(dataArray);

      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 300; i++) {

        const value = dataArray[i];

        const freq =
          i * audioContext.sampleRate / analyser.fftSize;

        if (value > globalMax) {
          globalMax = value;
          dominantFreq = freq;
        }

        const barHeight = value * 1.5;

        ctx.fillStyle = `rgb(${value + 100},50,200)`;

        ctx.fillRect(
          i * 3,
          canvas.height - barHeight,
          2,
          barHeight
        );
      }

      if (analyzing) {
        requestAnimationFrame(draw);
      }
    }

    draw();

    setTimeout(() => {

      setAnalyzing(false);

      setFrequency(Math.round(dominantFreq));

      stream.getTracks().forEach(track => track.stop());

    }, duration * 1000);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">

      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl p-6">

        <h1 className="text-4xl font-bold mb-4">
          Laboratorio FFT Interactivo
        </h1>

        <p className="text-gray-700 mb-6">
          Proyecto universitario sobre análisis espectral
          y resonancia acústica usando Fourier.
        </p>

        <div className="grid md:grid-cols-2 gap-6">

          <div>

            <label className="block mb-2 font-semibold">
              Tiempo de análisis (s)
            </label>

            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="border rounded-xl p-3 w-full mb-4"
            />

            <button
              onClick={startAnalysis}
              className="bg-black text-white px-6 py-3 rounded-2xl"
            >
              Iniciar análisis
            </button>

            <div className="mt-6">

              <h2 className="text-2xl font-semibold">
                Frecuencia dominante
              </h2>

              <p className="text-5xl font-bold">
                {frequency} Hz
              </p>

            </div>

          </div>

          <div className="flex flex-col items-center">

            <h2 className="text-2xl font-bold mb-4">
              Escanea el QR
            </h2>

            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://proyecto-fourier-web.vercel.app/"
              alt="QR"
              className="rounded-2xl shadow-md mb-4"
            />

          </div>

        </div>

        <canvas
          ref={canvasRef}
          width={1000}
          height={400}
          className="w-full border rounded-2xl bg-black mt-8"
        />

      </div>
    </main>
  );
}