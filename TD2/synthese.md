Synthèse du TP2

Q1
torrent create chaton.jpeg -o chaton.torrent
Le fichier `.torrent` a été généré avec succès.

Q2
Copy-Item chaton.jpeg -Destination partition1\
torrent create partition1 -o partition1.torrent
le .torrent contient maintenant une structure de dossier

Q3
Copy-Item partition1 -Destination partition1_copy -Recurse
torrent create partition1_copy -o partition1_copy.torrent
Le contenu est identique.




IPFS

Q1
Ajout du fichier `chaton.jpeg` :
ipfs add chaton.jpeg
CID → `QmeJaufp9seXCpHMFwxX53P3oRQW8Ny1DduCXAxebEwxv7`

Q2
Ajout du dossier `partition1` :


ipfs add -r partition1
added QmeJaufp9seXCpHMFwxX53P3oRQW8Ny1DduCXAxebEwxv7 partition1/chaton.jpeg
added QmcqB8FRtJB7bHwM1yF5XNXm6hMMVz9Wv5d5Y5uCgHiaof partition1
On observation que les fichiers inchangés conservent leur CID.

Q3
Ajout de `partition1_copy` :
ipfs add -r partition1_copy
added QmeJaufp9seXCpHMFwxX53P3oRQW8Ny1DduCXAxebEwxv7 partition1_copy/chaton.jpeg
added QmcqB8FRtJB7bHwM1yF5XNXm6hMMVz9Wv5d5Y5uCgHiaof partition1_copy
On observation que IPFS génère des CIDs basés uniquement sur le contenu.




Pinata


https://ipfs.io/ipfs/bafybeietrjyavklospdb7jf5yu5h6y37jybcpbsq3cfk5q5y4upuopbq2u


