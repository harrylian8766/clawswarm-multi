module.exports = {
  apps: [
    {
      name: 'clawswarm-multi',
      script: '/home/harry/clawswarm-multi/clawswarm-multi/dist/index.js',
      cwd: '/home/harry/clawswarm-multi/clawswarm-multi',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
        DATABASE_URL: 'postgresql://clawswarm:ClawSwarm2026!@localhost:5432/clawswarm_multi',
        OPENCLAW_GATEWAY_URL: 'http://localhost:18789',
      },
      error_file: '/home/harry/clawswarm-multi/logs/error.log',
      out_file: '/home/harry/clawswarm-multi/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
