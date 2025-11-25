module.exports = {
  apps: [{
    name: "SheetSync",
    script: "./server.js",
    cwd: "E:\\SheetSync",
    instances: 1,
    exec_mode: "fork",  // Explicitly set to fork mode
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,        // HTTPS port (main port)
      HTTP_PORT: 3001,   // HTTP redirect port
      CERT_PATH: '.certs'  // Path to your certificates
    }
  }]
};
