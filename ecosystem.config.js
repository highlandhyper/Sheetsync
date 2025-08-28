
module.exports = {
  apps: [
    {
      name: "sheetsync-app",
      script: "./node_modules/next/dist/bin/next", // Point directly to the Next.js CLI
      args: "start -H 0.0.0.0 -p 3001",         // Arguments for 'next start'
      cwd: "E:\\SheetSync",                      // Explicit current working directory
      exec_mode: "fork",                         // fork_mode is usually better for Next.js
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
