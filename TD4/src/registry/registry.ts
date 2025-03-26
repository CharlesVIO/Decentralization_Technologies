import express from "express";
import bodyParser from "body-parser";
import { REGISTRY_PORT } from "../config";

export type GetNodeRegistryBody = {
  nodes: {
    nodeId: number;
    pubKey: string;
  }[];
};


const registeredNodes: { nodeId: number; pubKey: string }[] = [];

export async function launchRegistry() {
  const app = express();
  app.use(bodyParser.json());

  // Route /status
  app.get("/status", (req, res) => {
    res.send("live");
  });

  // POST /registerNode
  app.post("/registerNode", (req, res) => {
    const { nodeId, pubKey } = req.body;
    const exists = registeredNodes.find(n => n.nodeId === nodeId);
    if (!exists) {
      registeredNodes.push({ nodeId, pubKey });
    }
    res.send("ok");
  });
  

  // GET /getNodeRegistry
  app.get("/getNodeRegistry", (req, res) => {
    res.json({ nodes: registeredNodes });
  });

  const server = app.listen(REGISTRY_PORT, () => {
    console.log(`Registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
