module.exports = {
  apps: [
    {
      name: "fate",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
      },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
