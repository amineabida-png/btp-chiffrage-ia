/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-parse', 'pdfkit', 'exceljs', 'mammoth', 'pdf2pic', 'sharp',
      'pdfjs-dist', '@huggingface/transformers', 'onnxruntime-node',
    ],
  },
};
module.exports = nextConfig;
