import { preview } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";
const server = await preview({
  configLoader: "runner",
  preview: { host: "127.0.0.1", port: 5173, strictPort: true },
});
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" },
});
child.on("exit", () => {
  server.httpServer.close();
  process.exit();
});
