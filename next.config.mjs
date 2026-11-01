// The landing page lives at the root and the app at /app. Older links that opened the demo or
// returned an authentication error at the root keep working: they move to /app with their query.
const nextConfig = {
  async redirects() {
    return [
      { source: '/', has: [{ type: 'query', key: 'demo' }], destination: '/app', permanent: false },
      { source: '/', has: [{ type: 'query', key: 'authError' }], destination: '/app', permanent: false },
    ];
  },
};

export default nextConfig;
