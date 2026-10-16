module.exports = {
  apps: [{ name: 'policy-management-api', script: 'src/server.js', instances: 1, exec_mode: 'fork', autorestart: true, restart_delay: 2000, max_restarts: 20 }]
};
