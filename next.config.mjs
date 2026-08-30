/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Recipe images come from arbitrary recipe sites; serve them unoptimized.
    unoptimized: true,
  },
};

export default nextConfig;
