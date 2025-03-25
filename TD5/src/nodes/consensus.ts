import { BASE_NODE_PORT } from "../config";

// Type du state attendu depuis les noeuds
type NodeState = {
  killed: boolean;
  x: number | null;
  round: number;
  decided: boolean | null;
  k: number | null;
};

// Petit delay utilitaire
async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Attend que tous les noeuds soient prêts
async function waitForAllNodesReady(N: number) {
  let allReady = false;

  while (!allReady) {
    allReady = true;
    for (let i = 0; i < N; i++) {
      try {
        const res = await fetch(`http://localhost:${BASE_NODE_PORT + i}/status`);
        if (!res.ok) throw new Error();
      } catch {
        allReady = false;
        break;
      }
    }
    if (!allReady) await delay(10);
  }
}

// Lancement du consensus pour tous les noeuds
export async function startConsensus(N: number, maxRounds: number = 300) {
  
  for (let round = 0; round < maxRounds; round++) {

    await waitForAllNodesReady(N);
    


    // Démarre un round de consensus sur chaque noeud
    await Promise.all(
      [...Array(N)].map((_, i) =>
        fetch(`http://localhost:${BASE_NODE_PORT + i}/start`).catch((err) =>
          console.error(`Erreur start node ${i}:`, err)
        )
      )
    );

    // Pause pour simuler le délai réseau
    console.log(`🌀 Round ${round + 1} started`);
    await delay(200);

    // Récupère les états des noeuds
    const states: (NodeState | null)[] = await Promise.all(
      [...Array(N)].map(async (_, i) => {
        try {
          const res = await fetch(`http://localhost:${BASE_NODE_PORT + i}/getState`);
          if (!res.ok) throw new Error();
          const state = (await res.json()) as NodeState;
          return state;
        } catch {
          return null;
        }
      })
    );

    // Vérifie si tous les noeuds honnêtes ont décidé
    const allDecided = states.every(s => s?.decided === true);
    const agreedValue = states[0]?.x;
    const allAgree = states.every(s => s?.x === agreedValue);
    console.log("States after round", round + 1, states.map(s => s?.x));


    if (allDecided && allAgree) break;
  }
}

// Arrête tous les noeuds proprement
export async function stopConsensus(N: number) {
  for (let i = 0; i < N; i++) {
    await fetch(`http://localhost:${BASE_NODE_PORT + i}/stop`).catch((err) =>
      console.error(`Erreur stop node ${i}:`, err)
    );
  }
}
