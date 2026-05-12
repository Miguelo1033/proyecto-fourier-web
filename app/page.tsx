export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">

        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h1 className="text-4xl font-bold mb-4">
            Análisis FFT del Sonido
          </h1>

          <p className="text-gray-700 mb-6">
            Proyecto universitario de física sobre análisis espectral,
            resonancia acústica y transformada rápida de Fourier.
          </p>

          <div className="space-y-4">

            <div className="bg-gray-100 p-4 rounded-2xl">
              <h2 className="font-semibold">
                Frecuencia dominante
              </h2>

              <p className="text-3xl">
                440 Hz
              </p>
            </div>

            <div className="bg-gray-100 p-4 rounded-2xl">
              <h2 className="font-semibold">
                Velocidad del sonido
              </h2>

              <p className="text-3xl">
                343 m/s
              </p>
            </div>

          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 flex flex-col items-center justify-center">

          <h2 className="text-2xl font-bold mb-4">
            Escanea el QR
          </h2>

          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://proyecto-fourier-web.vercel.app/"
            alt="QR"
            className="rounded-2xl shadow-md mb-4"
          />

          <p className="text-center text-gray-600">
            El código QR permitirá acceder al proyecto interactivo
            desde cualquier dispositivo móvil.
          </p>

        </div>

      </div>
    </main>
  );
}