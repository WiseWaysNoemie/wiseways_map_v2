# WiseWays – Max-Neef Question Map v2 Enhanced

## 🎯 Vue d'ensemble

WiseWays est une plateforme de cartographie collaborative des questions organisationnelles basée sur le modèle des besoins fondamentaux de Max-Neef. Cette version améliorée introduit des **Thinking Rooms** (salles de réflexion collaborative), un système complet de réponse aux questions, et des outils avancés d'analyse et de navigation.

## 🚀 Nouvelles fonctionnalités

### 1. **Système de réponse aux questions**
- ✅ Interface intuitive pour répondre directement aux questions
- 📊 Suivi du statut : non répondu, en cours, complété
- 💾 Sauvegarde persistante des réponses
- 👤 Attribution des réponses par utilisateur

### 2. **Thinking Rooms (Salles de réflexion)**
- 🏠 Détection automatique de clusters de questions liées
- 👥 Espaces collaboratifs multi-utilisateurs
- 🔄 Mise à jour en temps réel des participants
- 🎯 Regroupement thématique intelligent

### 3. **Mode guidé**
- 🧭 Parcours structuré question par question
- 📈 Ordre logique : stratégique → exécution
- ⏭️ Navigation avant/arrière avec sauvegarde
- 📊 Barre de progression visuelle

### 4. **Filtres et navigation améliorés**
- 🔍 Filtrage par statut, besoin, dimension
- 🔗 Contrôle de densité des connexions
- 🗺️ Mini-carte pour la navigation globale
- 🔎 Recherche dans les Thinking Rooms

### 5. **Analytics et visualisation**
- 📊 Dashboard analytique complet
- 📈 Distribution des besoins et dimensions
- ✅ Taux de réponse et progression
- 🎨 Visualisations interactives

### 6. **UX améliorée**
- 🎨 Interface dark mode optimisée
- ⌨️ Raccourcis clavier (Ctrl+G, Ctrl+1/2/3, ESC)
- 🖱️ Drag & drop des questions sur la carte
- 🔍 Zoom intelligent avec détection automatique
- ⚡ Animations fluides et feedback visuel

## 📋 Installation et démarrage

### Prérequis
- Node.js 18+ ou 20+
- npm

### Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer le serveur
npm start

# 3. Ouvrir dans le navigateur
http://localhost:8080
```

## 🎮 Guide d'utilisation

### Ajouter une question

1. Tapez votre question dans la barre de saisie (EN ou FR)
2. Cliquez "Add Question" ou appuyez sur Entrée
3. La question est automatiquement classifiée et positionnée
4. Les connexions sont générées automatiquement

### Répondre aux questions

**Méthode 1 : Sélection manuelle**
1. Cliquez sur une question sur la carte
2. Le panneau latéral affiche les détails
3. Entrez votre réponse dans le formulaire
4. Cliquez "Save Answer"

**Méthode 2 : Mode guidé**
1. Cliquez "Guided Mode" ou appuyez sur Ctrl+G
2. Suivez le parcours question par question
3. Répondez ou passez à la suivante
4. Votre progression est sauvegardée automatiquement

### Utiliser les Thinking Rooms

1. Allez dans l'onglet "Thinking Rooms"
2. Les salles sont créées automatiquement selon les connexions
3. Cliquez sur une salle pour :
   - Voir les questions associées
   - Rejoindre la conversation
   - Collaborer avec d'autres participants
4. Les participants actifs sont affichés en temps réel

### Navigation sur la carte

**Contrôles de base:**
- 🖱️ **Molette** : Zoom in/out
- 🖱️ **Cliquer-glisser** : Déplacer la vue
- 🖱️ **Cliquer nœud** : Sélectionner une question
- 🖱️ **Cliquer lien** : Voir la connexion
- 🖱️ **Glisser nœud** : Repositionner manuellement

**Raccourcis clavier:**
- `Ctrl/Cmd + G` : Mode guidé
- `Ctrl/Cmd + 1/2/3` : Changer d'onglet
- `ESC` : Désélectionner
- `Enter` : Ajouter une question

### Filtrer les questions

**Par statut:**
- Toutes
- Répondues uniquement
- Non répondues

**Par besoin Max-Neef:**
- Tous
- Understanding, Participation, Creation, etc.

**Par densité de connexions:**
- Utilisez le slider pour afficher plus/moins de liens
- Valeurs basses : connexions fortes uniquement
- Valeurs élevées : toutes les connexions

## 🏗️ Architecture technique

### Backend (server.mjs)

**API Endpoints:**

```
POST   /api/questions              Ajouter une question
GET    /api/questions              Lister toutes les questions
PATCH  /api/questions/:id          Modifier une question
DELETE /api/questions/:id          Supprimer une question

POST   /api/responses              Sauvegarder une réponse
GET    /api/responses/question/:id Réponses d'une question
GET    /api/responses/user/:id     Réponses d'un utilisateur

POST   /api/auto-links             Générer les connexions
GET    /api/links                  Obtenir les connexions

GET    /api/graph                  Graphe complet (nœuds + liens + rooms)

GET    /api/thinking-rooms         Lister les Thinking Rooms
POST   /api/thinking-rooms/:id/join   Rejoindre une room
POST   /api/thinking-rooms/:id/leave  Quitter une room

GET    /api/analytics              Statistiques globales

POST   /api/seed-demo              Charger données de démo
POST   /api/reset                  Réinitialiser tout
```

**Algorithmes clés:**

1. **Classification Max-Neef:**
   - Analyse des mots-clés par besoin et dimension
   - Score de position dans la chaîne de valeur (0-1)
   - Attribution de profiles multidimensionnels

2. **Génération de connexions:**
   - Similarité textuelle (embeddings simplifiés)
   - Proximité thématique (need/dimension)
   - Distance dans la chaîne de valeur
   - Pondération composite : 40% texte + 25% need + 15% dim + 20% pipeline

3. **Détection de Thinking Rooms:**
   - Clustering par connexions fortes (>0.4)
   - Groupement par besoins/dimensions partagés
   - Minimum 2 questions par room

### Frontend (graph-enhanced.js)

**Composants principaux:**

- **GraphRenderer** : Visualisation D3.js avec zoom/pan
- **PanelManager** : Gestion des onglets et contenus
- **ResponseHandler** : Formulaires et sauvegarde de réponses
- **GuidedMode** : Flux de questions guidé
- **FilterEngine** : Système de filtrage multicritères
- **MinimapRenderer** : Mini-carte de navigation
- **AnalyticsDashboard** : Visualisations statistiques

**État de l'application:**

```javascript
{
  graphData: {
    nodes: [...],        // Questions avec métadonnées
    links: [...],        // Connexions pondérées
    thinkingRooms: [...] // Salles collaboratives
  },
  selectedNode: null,    // Question sélectionnée
  selectedLink: null,    // Connexion sélectionnée
  filters: {             // Filtres actifs
    status: 'all',
    need: 'all',
    dimension: 'all'
  },
  currentTab: 'question' // Onglet actif
}
```

## 🎨 Personnalisation visuelle

### Couleurs des besoins (bordures des nœuds)

```javascript
SUBSISTENCE: #4ad66d   // Vert
PROTECTION: #5cc1ff    // Bleu clair
AFFECTION: #ff7aa2     // Rose
UNDERSTANDING: #ffc64d // Jaune
PARTICIPATION: #9a7dff // Violet
CREATION: #ff8f42      // Orange
IDENTITY: #5ae0c0      // Turquoise
FREEDOM: #ff5757       // Rouge
IDLENESS: #7bd8ff      // Cyan
```

### Gradient de position (remplissage des nœuds)

- 🔵 **Bleu (#4fa3ff)** : Questions stratégiques (amont)
- 🟡 **Jaune (#ffdd55)** : Questions d'exécution (aval)

### Taille des nœuds

- Base : 18px
- +2px par connexion (max +16px)
- Formule : `18 + min(connexions × 2, 16)`

## 📊 Modèle de données

### Question

```javascript
{
  id: string,
  text: string,
  need: string,              // Max-Neef need
  dimension: string,         // BEING/HAVING/DOING/INTERACTING
  pipelineScore: number,     // 0-1 (strategic → execution)
  embedding: number[],       // Vector representation
  position: {x, y},          // Normalized 0-1 coordinates
  status: string,            // unanswered/in-progress/answered
  createdAt: timestamp
}
```

### Link

```javascript
{
  id: string,
  source: string,            // Question ID
  target: string,            // Question ID
  weight: number             // 0-1 similarity score
}
```

### Response

```javascript
{
  id: string,
  questionId: string,
  userId: string,
  answer: string,
  metadata: object,
  createdAt: timestamp
}
```

### Thinking Room

```javascript
{
  id: string,
  name: string,
  theme: string,
  questionIds: string[],
  participants: [{
    userId: string,
    userName: string,
    joinedAt: timestamp
  }],
  status: string,            // open/closed
  createdAt: timestamp
}
```

## 🔄 Workflow typique

### Atelier collaboratif

1. **Préparation (Facilitateur)**
   ```
   - Seed demo ou importer questions existantes
   - Vérifier la génération automatique des connexions
   - Identifier les Thinking Rooms principales
   ```

2. **Phase de contribution (Participants)**
   ```
   - Chaque participant ajoute ses questions
   - Le système classifie et connecte automatiquement
   - Exploration libre de la carte
   ```

3. **Phase de réponse collective**
   ```
   - Mode guidé pour structure
   - OU exploration libre par rooms
   - Discussions dans les Thinking Rooms actives
   ```

4. **Phase d'analyse**
   ```
   - Onglet Analytics : vue d'ensemble
   - Identification des besoins dominants
   - Gaps dans les réponses
   - Zones de forte connexion = priorités
   ```

### Travail asynchrone

1. Ajout continu de questions par l'équipe
2. Chacun répond à son rythme (mode guidé ou libre)
3. Auto-refresh des Thinking Rooms pour voir qui travaille sur quoi
4. Analytics pour suivre la progression globale

## 🚧 Limitations actuelles

- **Persistance** : Données en mémoire uniquement (redémarrage = perte)
- **Multi-langue** : Classification optimisée EN/FR, autres langues limitées
- **Scalabilité** : Testé jusqu'à 200 questions, performance à valider au-delà
- **Collaboration temps réel** : Polling simple, pas de WebSocket

## 🔮 Roadmap future

### Court terme
- [ ] Base de données persistante (SQLite/PostgreSQL)
- [ ] Export/Import (JSON, CSV, PDF)
- [ ] Annotations sur les liens
- [ ] Historique des modifications

### Moyen terme
- [ ] WebSocket pour collaboration temps réel
- [ ] Chat intégré dans les Thinking Rooms
- [ ] IA pour suggestions de réponses
- [ ] Templates de workshops

### Long terme
- [ ] Multi-projets avec isolation
- [ ] Système de droits/rôles
- [ ] Intégration Slack/Teams
- [ ] Machine learning pour classification avancée

## 🤝 Contribution

Les contributions sont bienvenues ! Zones prioritaires :

1. **Backend** : Persistance, authentification
2. **Frontend** : Accessibilité, mobile responsive
3. **Algorithmes** : Amélioration de la classification
4. **UX** : Tests utilisateurs, feedback

## 📄 Licence

MIT License - Voir LICENSE file

## 🙏 Remerciements

- Modèle Max-Neef : Manfred Max-Neef (Human Scale Development)
- Visualisation : D3.js
- Framework : Express.js

---

**WiseWays** - Transforming organizational questions into collective wisdom 🧠✨