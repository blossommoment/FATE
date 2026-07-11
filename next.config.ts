import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit 在运行时从自身目录读取内置字体度量文件（.afm）；被 Next 打包后 __dirname 会解析成
  // C:\ROOT 导致 ENOENT。标为外部依赖后由 node_modules 原样 require，读文件路径恢复正常。
  serverExternalPackages: ["pdfkit"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};

export default nextConfig;
