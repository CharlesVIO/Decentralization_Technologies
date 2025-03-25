import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MAX_ROUNDS = 20;

async function sendMessageWithRetry(nodeId: number, port: number, value: Value, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fetch(`http://localhost:${port}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      return;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`⚠️ Node ${nodeId} failed to contact port ${port} (attempt ${attempt}), retrying...`);
        await delay(100);
      } else {
        console.error(`❌ Node ${nodeId} failed to contact port ${port} after ${retries} attempts.`);
      }
    }
  }
}

export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
) {
  console.log(`🧪 Node ${nodeId} | Faulty: ${isFaulty} | Init value: ${initialValue}`);
  const app = express();
  app.use(express.json());
  app.use(bodyParser.json());

  let currentState = {
    killed: false,
    x: isFaulty ? null : initialValue,
    round: 0,
    decided: isFaulty ? null : false,
    k: isFaulty ? null : 0,
    stableCount: 0,
  };

  let receivedMessages: Value[] = [];

  app.get("/status", (req, res) => {
    if (isFaulty) return res.status(500).send("faulty");
    return res.status(200).send("live");
  });

  app.post("/message", (req, res) => {
    const { value } = req.body;
    if (!nodesAreReady()) return res.status(503).json({ error: "Not ready" });
    if (value === undefined) return res.status(400).json({ error: "No value" });
    if (!isFaulty) receivedMessages.push(value as Value);
    return res.status(200).json({ success: true });
  });

  app.get("/start", async (req, res) => {
    if (!nodesAreReady() || currentState.killed)
      return res.status(200).json({ skipped: true });

    currentState.round++;

    if (currentState.round > MAX_ROUNDS) {
      currentState.x = currentState.x ?? (Math.random() < 0.5 ? 0 : 1);
      currentState.decided = true;
      console.log(`⏹️ Node ${nodeId} reached max rounds (${MAX_ROUNDS}), forced decision to x=${currentState.x}.`);
      return res.status(200).json(currentState);
    }

    if (currentState.decided) {
      console.log(`✅ Node ${nodeId} already decided, skipping round ${currentState.round}`);
      return res.status(200).json(currentState);
    }

    if (!isFaulty && currentState.decided && currentState.round > 1) {
      return res.status(200).json(currentState);
    }

    if (!isFaulty && currentState.x !== null) {
      for (let i = 0; i < N; i++) {
        if (i === nodeId) continue;
        await sendMessageWithRetry(nodeId, BASE_NODE_PORT + i, currentState.x);
      }
      receivedMessages.push(currentState.x);
    }

    await delay(receivedMessages.length < N - F ? 300 : 150);

    receivedMessages = receivedMessages.filter((v): v is Value => v === 0 || v === 1);

    if (!isFaulty && !currentState.decided && receivedMessages.length >= N - F) {
      const count0 = receivedMessages.filter(v => v === 0).length;
      const count1 = receivedMessages.filter(v => v === 1).length;

      console.log(`🔍 Node ${nodeId} | round ${currentState.round} | votes: 0=${count0}, 1=${count1}`);

      const majority = Math.floor(N / 2) + 1;
      const prevX = currentState.x;

      if (count0 >= 2 * F + 1) {
        currentState.x = 0;
        currentState.decided = true;
      } else if (count1 >= 2 * F + 1) {
        currentState.x = 1;
        currentState.decided = true;
      } else if (count0 >= majority) {
        currentState.x = 0;
      } else if (count1 >= majority) {
        currentState.x = 1;
      } else {
        currentState.x = Math.random() < 0.5 ? 0 : 1;
      }

      if (currentState.x === prevX) {
        currentState.stableCount++;
      } else {
        currentState.stableCount = 1;
      }

      if (!currentState.decided && currentState.stableCount >= 2) {
        currentState.decided = true;
        console.log(`🧠 Node ${nodeId} decided after stable x=${currentState.x} for ${currentState.stableCount} rounds.`);
      }

      console.log(`💡 Node ${nodeId} | new x=${currentState.x} | decided=${currentState.decided}`);
    }

    if (!isFaulty) {
      if (currentState.decided && (currentState.k === null || currentState.k === 0)) {
        currentState.k = currentState.round;
      } else if (!currentState.decided) {
        currentState.k = (currentState.k ?? 0) + 1;
      }
    }

    console.log(
      `✅ Node ${nodeId} finished round ${currentState.round}, x=${currentState.x}, decided=${currentState.decided}`
    );

    receivedMessages = [];

    return res.status(200).json(currentState);
  });

  app.get("/stop", (req, res) => {
    currentState.killed = true;
    server.close();
    return res.status(200).json({ success: true });
  });

  app.get("/getState", (req, res) => {
    return res.status(200).json(currentState);
  });

  const server = app.listen(BASE_NODE_PORT + nodeId, () => {
    setNodeIsReady(nodeId);
  });

  return server;
}
