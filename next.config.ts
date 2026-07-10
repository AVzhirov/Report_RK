import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Разрешаем доступ с любых IP в локальной сети (для запуска на сервере/машине
  // и подключения с других устройств: телефонов, планшетов, других ПК).
  // Next.js 16 требует явного списка allowedDevOrigins для dev-сервера.
  allowedDevOrigins: ["*"],
  // Разрешаем CORS для API (чтобы можно было дёргать с других машин сети)
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
