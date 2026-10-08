import { prisma } from "@canopy/database";
import { startWorker, closeQueueConnections } from "./queue";

const worker = startWorker();
if (worker) console.log("Canopy worker started");
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await worker?.close();
  await closeQueueConnections();
  await prisma.$disconnect();
}
process.once("SIGINT", () => {
  void shutdown().catch(() => {
    process.exitCode = 1;
  });
});
process.once("SIGTERM", () => {
  void shutdown().catch(() => {
    process.exitCode = 1;
  });
});
