import { Value } from "../types";
import { node } from "./node";

/**
 * Lance N noeuds avec les configurations spécifiées.
 *
 * @param N Nombre total de noeuds dans le réseau
 * @param F Nombre de noeuds fautifs
 * @param initialValues Valeurs initiales de chaque noeud
 * @param faultyList Liste des noeuds fautifs (true = fautif)
 * @returns Liste des serveurs lancés
 */
export async function launchNodes(
  N: number,
  F: number,
  initialValues: Value[],
  faultyList: boolean[]
) {
  // Vérifications de cohérence des entrées
  if (initialValues.length !== faultyList.length || N !== initialValues.length) {
    throw new Error("Les tableaux ne correspondent pas en taille.");
  }

  if (faultyList.filter((el) => el).length !== F) {
    throw new Error("La liste des noeuds fautifs ne correspond pas à F.");
  }

  const nodeReadyStates: boolean[] = new Array(N).fill(false);

  // Vérifie si tous les noeuds sont prêts
  function nodesAreReady(): boolean {
    return nodeReadyStates.every((state) => state);
  }

  // Marque un noeud comme prêt
  function setNodeIsReady(index: number): void {
    nodeReadyStates[index] = true;
  }

  const promises: Promise<any>[] = [];

  // Lancement des noeuds avec leurs paramètres respectifs
  for (let index = 0; index < N; index++) {
    promises.push(
      node(
        index,
        N,
        F,
        initialValues[index],
        faultyList[index],
        nodesAreReady,
        setNodeIsReady
      )
    );
  }

  // Attente de tous les noeuds
  const servers = await Promise.all(promises);

  return servers;
}
