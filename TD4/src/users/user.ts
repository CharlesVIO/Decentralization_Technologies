import express from "express";
import bodyParser from "body-parser";
import {
  BASE_USER_PORT,
  BASE_ONION_ROUTER_PORT,
  REGISTRY_PORT,
} from "../config";

import {
  createRandomSymmetricKey,
  exportSymKey,
  rsaEncrypt,
  importPubKey,
  symEncrypt,
} from "../crypto";

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;
let lastCircuit: number[] | null = null;

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const app = express();
  app.use(bodyParser.json());

  // ✅ Route /status
  app.get("/status", (req, res) => {
    res.send("live");
  });

  // ✅ GET /getLastReceivedMessage
  app.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  // ✅ GET /getLastSentMessage
  app.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  // ✅ GET /getLastCircuit
  app.get("/getLastCircuit", (req, res) => {
    res.json({ result: lastCircuit });
  });

  // ✅ POST /message (réception finale)
  app.post("/message", (req, res) => {
    const { message } = req.body;
    lastReceivedMessage = message;
    res.send("success");
  });

  // ✅ POST /sendMessage (envoi initial vers 1er nœud)
  app.post("/sendMessage", async (req, res) => {
    const { message, destinationUserId } = req.body as SendMessageBody;
    lastSentMessage = message;

    // 1. Obtenir la liste des nœuds depuis le registre
    const registry = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);
    const data = await registry.json() as { nodes: { nodeId: number; pubKey: string }[] };
    const nodes = data.nodes;

    // 2. Sélectionner 3 nœuds distincts aléatoires
    const selected = new Set<number>();
    while (selected.size < 3 && selected.size < nodes.length) {
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      selected.add(randomNode.nodeId);
    }
    const circuit = Array.from(selected);
    lastCircuit = circuit;

    // 3. Créer les 3 couches de chiffrement (de l’intérieur vers l’extérieur)
    let payload = message;
    const finalDest = BASE_USER_PORT + destinationUserId;
    let destination = finalDest;

    for (let i = circuit.length - 1; i >= 0; i--) {
      const nodeId = circuit[i];
      const node = nodes.find((n: { nodeId: number }) => n.nodeId === nodeId);
      if (!node) continue;

      const symKey = await createRandomSymmetricKey();
      const symKeyStr = await exportSymKey(symKey);

      const paddedDest = destination.toString().padStart(10, "0");
      const toEncrypt = paddedDest + payload;

      const encryptedPayload = await symEncrypt(symKey, toEncrypt);
      const nodePubKey = await importPubKey(node.pubKey);
      const encryptedSymKey = await rsaEncrypt(symKeyStr, node.pubKey);


      payload = Buffer.concat([
        Buffer.from(encryptedSymKey, "base64"),
        Buffer.from(encryptedPayload, "base64"),
      ]).toString("base64");

      destination = BASE_ONION_ROUTER_PORT + nodeId;
    }

    // 4. Envoyer le message au 1er nœud
    await fetch(`http://localhost:${destination}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: payload }),
    });

    res.status(200).send("Message sent");
  });

  const port = BASE_USER_PORT + userId;
  const server = app.listen(port, () => {
    console.log(`User ${userId} is listening on port ${port}`);
  });

  return server;
}
