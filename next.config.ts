import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Les incidents sont relus à chaque revalidation : ils doivent faire partie du déploiement.
  outputFileTracingIncludes: { '/': ['./incidents/**/*.md'] },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
