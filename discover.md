# Découverte du protocole sans coer

Dans un premier terminal, lancez la commande suivante:
```shell
nc -Cl 5050
```

Elle permet d'ouvrir un socket TCP en écoute sur le port 5050 (-C permet de convertir les retours chariot en CRLF). Dans un second terminal, dans un répertoire temporaire installez et lancez le serveur de langage Docker (c'est un exemple, d'autres serveurs de langage peuvent être utilisés) :
```shell
npm install dockerfile-language-server-nodejs
./node_modules/.bin/docker-langserver --socket=5050
```

au lancement du serveur rien ne se passe : c'est au client d'envoyer le premier message. Copier dans le premier terminal (celui qui exécute actuellement la commande nc) le message suivant au caractère prêt (depuis Content-Length jusqu'à la dernière }) :
```json
Content-Length: 101

{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "capabilities": {"workspace": {}}}}
```

Le premier échange est une négociation de capacités, le client et le serveur échangent leurs fonctionnalités respectives. On peut ensuite simuler l'ouverture d'un fichier depuis le client :
```json
Content-Length: 175

{"jsonrpc": "2.0", "method": "textDocument/didOpen", "params": { "textDocument": {"uri":"file:///tmp/Dockerfile","languageId":"dockerfile","version":1,"text":"HELLO tutu"}}}
```

Vous remarquerez que le message n'a pas d'identifiant : c'est une notification, aucune réponse n'est attendue. En réaction, le serveur notifie le client qu'il a analysé le document et que ce dernier contient des erreurs : l'instruction HELLO est inconnue et le document doit contenir une référence à une image avec l'instruction FROM. Le serveur est informé des modifications du document en temps réel :
```json
Content-Length: 247

{"jsonrpc": "2.0", "method": "textDocument/didChange", "params": { "textDocument": {"uri":"file:///tmp/Dockerfile","version":2}, "contentChanges": [{"range": {"start":{"line":0,"character":0},"end":{"line":0,"character":10}}, "text": "FROM "}]}}
```

C'est mieux : le document ne contient plus qu'une erreur. Il est possible de lui demander des propositions de complétion après le mot clé FROM :
```json
Content-Length: 167

{"jsonrpc": "2.0", "id": 2, "method": "textDocument/completion", "params": { "textDocument": {"uri":"file:///tmp/Dockerfile"}, "position": {"line":0,"character":5}}}
```

Le document peut de nouveau être modifié :
```json
Content-Length: 254

{"jsonrpc": "2.0", "method": "textDocument/didChange", "params": { "textDocument": {"uri":"file:///tmp/Dockerfile","version":2}, "contentChanges": [{"range": {"start":{"line":0,"character":0},"end":{"line":0,"character":10}}, "text": "FROM hello\n"}]}}
```

Il ne contient plus d'erreurs, on peut maintenant tenter une demande de complétion dans un autre contexte :
```json
Content-Length: 167

{"jsonrpc": "2.0", "id": 2, "method": "textDocument/completion", "params": { "textDocument": {"uri":"file:///tmp/Dockerfile"}, "position": {"line":1,"character":0}}}
```

Le serveur nous propose maintenant l'ensemble des mots clés pouvant être utilisé à cet endroit du document.