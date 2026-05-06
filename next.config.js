/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Ensure Vercel includes /content/research/*.mdx in the serverless function
    // bundle for the research-index API and the [slug] page route.
    outputFileTracingIncludes: {
      "/api/research-index": ["./content/research/**/*"],
      "/research/[slug]": ["./content/research/**/*"],
    },
  },
};

module.exports = nextConfig;
