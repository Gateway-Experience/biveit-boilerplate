module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script : 'npm',
      args : 'run start',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
