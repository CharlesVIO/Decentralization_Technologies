import express from "express";
import bodyParser from "body-parser";
import { exportSymKey } from "../crypto";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import {
  generateRsaKeyPair,
  exportPubKey,
  exportPrvKey,
  rsaDecrypt,
  importPrvKey,
  importSymKey,
  symDecrypt,
} from "../crypto";

let lastReceivedEncryptedMessage: string | null = null;
let lastReceivedDecryptedMessage: string | null = null;
let lastMessageDestination: number | null = null;
let privateKeyStr: string | null = null;

export async function simpleOnionRouter(nodeId: number) {
  const app = express();
  app.use(bodyParser.json());

  // 1. Génération des clés
  const { publicKey, privateKey } = await generateRsaKeyPair();
  const exportedPrv = await exportPrvKey(privateKey);
  if (!exportedPrv) {
    throw new Error("Erreur lors de l'export de la clé privée");
  }
  privateKeyStr = exportedPrv;
  if (!privateKeyStr) {
    throw new Error("Clé privée non exportée !");
  }

  // 2. Enregistrement auprès du registre
  const publicKeyStr = await exportPubKey(publicKey);
  await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeId,
      pubKey: publicKeyStr,
    }),
  });

  // 3. Routes GET pour debug/test
  app.get("/status", (req, res) => {
    res.send("live");
  });

  app.get("/getPrivateKey", async (req, res) => {
    try {
      if (!privateKeyStr) {
        return res.status(404).send({ result: "Private key not found" });
      }
      return res.send({ result: privateKeyStr });
    } catch (e) {
      console.error("❌ Erreur dans /getPrivateKey:", e);
      return res.status(500).send({ result: "Internal server error" });
    }
  });

  app.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  app.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  app.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  // 4. Route POST /message
  app.post("/message", async (req, res) => {
    try {
      const { message } = req.body;
      lastReceivedEncryptedMessage = message;
      const prvKey = await importPrvKey(privateKeyStr!);
      const fullBuffer = Buffer.from(message, "base64");
      const encryptedKeyLength = 256; // RSA 2048 = 256 bytes
      const encryptedSymKey = fullBuffer.slice(0, encryptedKeyLength);
      const encryptedPayload = fullBuffer.slice(encryptedKeyLength);

      let symKeyStr: string;
      try {
        // Passe directement le buffer à rsaDecrypt
        symKeyStr = await rsaDecrypt(encryptedSymKey, prvKey);
      } catch (e) {
        console.error("❌ Erreur lors du rsaDecrypt:", e);
        return res.status(500).send("rsaDecrypt failed");
      }

      const symKey = await importSymKey(Buffer.from(symKeyStr, "utf8").toString("base64"));
      const decryptedPayload = await symDecrypt(symKey, encryptedPayload.toString("base64"));
      lastReceivedDecryptedMessage = decryptedPayload;

      const destinationStr = decryptedPayload.slice(0, 10);
      const isPort = /^\d{4,5}$/.test(destinationStr.trim());
      if (!isPort) {
        console.warn("⚠️ Message final reçu :", decryptedPayload);
        lastReceivedDecryptedMessage = decryptedPayload;
        return res.status(200).send("Message reçu sans destination, traité localement.");
      }
      const destinationPort = parseInt(destinationStr);
      lastMessageDestination = destinationPort;
      const finalMessage = decryptedPayload.slice(10);
      await fetch(`http://localhost:${destinationPort}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: finalMessage }),
      });
      return res.status(200).send("Message forwarded");
    } catch (e) {
      console.error("❌ Erreur générale dans /message:", e);
      return res.status(500).send("Internal error");
    }
  });

  // 5. Lancement du serveur
  const port = BASE_ONION_ROUTER_PORT + nodeId;
  const server = app.listen(port, () => {
    console.log(`Onion router ${nodeId} is listening on port ${port}`);
  });
  return server;
}
