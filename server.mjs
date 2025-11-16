import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from current directory
app.use(express.static(__dirname));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use('/api/', limiter);

// ===== DATA STRUCTURES =====
let questions = [];
let links = [];
let responses = [];
let thinkingRooms = [];
let users = [];

// ===== SEMANTIC ANALYSIS HELPERS =====

// Enhanced word embeddings with semantic importance
function getWordWeight(word) {
  const highImportance = {
    // Action verbs
    'improve': 3, 'create': 3, 'develop': 3, 'implement': 3, 'build': 3,
    'design': 3, 'innovate': 3, 'optimize': 3, 'enhance': 3, 'transform': 3,
    // Strategic terms
    'strategy': 3, 'vision': 3, 'goal': 3, 'objective': 3, 'mission': 3,
    'future': 3, 'plan': 3, 'roadmap': 3, 'direction': 3,
    // Core concepts
    'team': 2.5, 'collaboration': 2.5, 'communication': 2.5, 'culture': 2.5,
    'innovation': 2.5, 'growth': 2.5, 'quality': 2.5, 'performance': 2.5,
    'customer': 2.5, 'user': 2.5, 'client': 2.5, 'experience': 2.5,
    // Max-Neef needs
    'health': 2, 'safety': 2, 'security': 2, 'learning': 2, 'education': 2,
    'creativity': 2, 'identity': 2, 'freedom': 2, 'participation': 2,
    // French equivalents
    'améliorer': 3, 'créer': 3, 'développer': 3, 'implémenter': 3,
    'stratégie': 3, 'vision': 3, 'équipe': 2.5, 'innovation': 2.5,
    'croissance': 2.5, 'qualité': 2.5, 'client': 2.5
  };
  
  return highImportance[word.toLowerCase()] || 1;
}

function extractKeyTerms(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may',
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais',
    'dans', 'sur', 'pour', 'avec', 'par', 'est', 'sont', 'être', 'avoir'
  ]);
  
  const words = text.toLowerCase()
    .match(/[a-zàâäéèêëïîôùûüÿæœç]+/g) || [];
  
  const keyTerms = words
    .filter(w => w.length > 3 && !stopWords.has(w))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + getWordWeight(word);
      return acc;
    }, {});
  
  return keyTerms;
}

function semanticSimilarity(text1, text2) {
  const terms1 = extractKeyTerms(text1);
  const terms2 = extractKeyTerms(text2);
  
  const allTerms = new Set([...Object.keys(terms1), ...Object.keys(terms2)]);
  
  if (allTerms.size === 0) return 0;
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  allTerms.forEach(term => {
    const val1 = terms1[term] || 0;
    const val2 = terms2[term] || 0;
    dotProduct += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  });
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function analyzeCausalRelation(q1, q2) {
  const causalPatterns = {
    cause: /\b(cause|lead|result|enable|create|produce|generate|drive)\b/i,
    effect: /\b(impact|affect|influence|change|improve|reduce|increase)\b/i,
    dependency: /\b(require|need|depend|rely|based on|prerequisite)\b/i,
    solution: /\b(solve|address|fix|resolve|answer|handle)\b/i,
    problem: /\b(problem|issue|challenge|obstacle|difficulty|concern)\b/i
  };
  
  let relationScore = 0;
  let relationType = null;
  
  // Check if one is a problem and other is solution
  if (causalPatterns.problem.test(q1.text) && causalPatterns.solution.test(q2.text)) {
    relationScore += 0.3;
    relationType = 'problem-solution';
  }
  
  // Check cause-effect relationships
  if (causalPatterns.cause.test(q1.text) && causalPatterns.effect.test(q2.text)) {
    relationScore += 0.25;
    relationType = relationType || 'cause-effect';
  }
  
  // Check dependencies
  if (causalPatterns.dependency.test(q1.text) || causalPatterns.dependency.test(q2.text)) {
    relationScore += 0.2;
    relationType = relationType || 'dependency';
  }
  
  return { score: relationScore, type: relationType };
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
}

function simpleEmbed(text) {
  const words = text.toLowerCase().match(/\w+/g) || [];
  const vocab = {};
  words.forEach(w => vocab[w] = (vocab[w] || 0) + 1);
  const vec = new Array(100).fill(0);
  Object.entries(vocab).forEach(([word, count]) => {
    const hash = word.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
    vec[Math.abs(hash) % 100] += count;
  });
  return vec;
}

function classifyMaxNeef(text) {
  const lower = text.toLowerCase();
  
  const needPatterns = {
    SUBSISTENCE: /\b(food|health|shelter|work|income|salary|revenue|survive|basic|essential|subsistence|alimentation|santé|revenu)\b/,
    PROTECTION: /\b(safety|security|protect|risk|insurance|legal|rights|defense|care|sécurité|protection|défense)\b/,
    AFFECTION: /\b(love|friend|family|relationship|care|emotion|affection|belonging|connect|amour|amitié|famille|relation)\b/,
    UNDERSTANDING: /\b(learn|understand|educat|knowledge|training|skill|study|research|analyze|apprendre|comprendre|éducation|connaissance|formation)\b/,
    PARTICIPATION: /\b(participate|engage|involve|contribute|collaborate|team|group|community|vote|participer|engager|équipe|communauté)\b/,
    CREATION: /\b(create|innovate|design|build|develop|invent|art|imagine|express|créer|innover|concevoir|développer|inventer)\b/,
    IDENTITY: /\b(identity|who|self|personal|individual|unique|character|belong|culture|identité|personnel|individuel|culture)\b/,
    FREEDOM: /\b(freedom|choice|autonomy|independent|decide|liberty|flexible|option|liberté|choix|autonomie|indépendant)\b/,
    IDLENESS: /\b(rest|relax|leisure|play|fun|enjoy|vacation|hobby|entertain|game|repos|détente|loisir|jeu|vacances)\b/
  };

  const dimPatterns = {
    BEING: /\b(is|am|are|being|exist|state|condition|quality|attribute|être|état|qualité)\b/,
    HAVING: /\b(have|has|own|possess|resource|asset|tool|material|property|avoir|posséder|ressource|outil)\b/,
    DOING: /\b(do|does|action|activity|work|perform|execute|implement|practice|faire|action|activité|exécuter)\b/,
    INTERACTING: /\b(interact|with|between|relation|network|collaborate|communicate|meet|interagir|avec|entre|relation|communiquer)\b/
  };

  let need = 'UNKNOWN';
  let needScore = 0;
  for (const [n, pattern] of Object.entries(needPatterns)) {
    const matches = (lower.match(pattern) || []).length;
    if (matches > needScore) {
      needScore = matches;
      need = n;
    }
  }

  let dimension = 'UNKNOWN';
  let dimScore = 0;
  for (const [d, pattern] of Object.entries(dimPatterns)) {
    const matches = (lower.match(pattern) || []).length;
    if (matches > dimScore) {
      dimScore = matches;
      dimension = d;
    }
  }

  const strategicWords = /\b(strategy|vision|future|plan|goal|objective|why|purpose|mission|stratégie|vision|futur|objectif|mission)\b/g;
  const executionWords = /\b(implement|execute|deliver|now|today|urgent|deadline|task|action|implémenter|exécuter|livrer|urgent|tâche)\b/g;
  const stratCount = (lower.match(strategicWords) || []).length;
  const execCount = (lower.match(executionWords) || []).length;
  const pipelineScore = execCount > 0 || stratCount > 0 
    ? execCount / (stratCount + execCount + 1) 
    : 0.5;

  return { need, dimension, pipelineScore };
}

function calculatePosition(need, dimension) {
  const needs = ['SUBSISTENCE', 'PROTECTION', 'AFFECTION', 'UNDERSTANDING', 
                 'PARTICIPATION', 'CREATION', 'IDENTITY', 'FREEDOM', 'IDLENESS', 'UNKNOWN'];
  const dims = ['BEING', 'HAVING', 'DOING', 'INTERACTING', 'UNKNOWN'];
  
  const y = needs.indexOf(need) / (needs.length - 1 || 1);
  const x = dims.indexOf(dimension) / (dims.length - 1 || 1);
  
  const jitter = 0.02;
  return {
    x: Math.max(0, Math.min(1, x + (Math.random() - 0.5) * jitter)),
    y: Math.max(0, Math.min(1, y + (Math.random() - 0.5) * jitter))
  };
}

function generateLinks(baseThreshold = 0.2, limitPerNode = 8) {
  links = [];
  const linkMap = new Map();

  console.log(`🔗 Generating semantic links for ${questions.length} questions...`);

  questions.forEach((qa, i) => {
    const candidates = [];
    
    questions.forEach((qb, j) => {
      if (i >= j) return;
      
      // 1. Semantic similarity (40%)
      const semanticSim = semanticSimilarity(qa.text, qb.text);
      
      // 2. Traditional embedding similarity (20%)
      const embeddingSim = cosineSimilarity(qa.embedding, qb.embedding);
      
      // 3. Same need bonus (15%)
      const sameNeed = qa.need === qb.need ? 0.15 : 0;
      
      // 4. Same dimension bonus (10%)
      const sameDim = qa.dimension === qb.dimension ? 0.1 : 0;
      
      // 5. Pipeline proximity (10%)
      const pipelineDist = 1 - Math.abs((qa.pipelineScore || 0.5) - (qb.pipelineScore || 0.5));
      const pipelineScore = pipelineDist * 0.1;
      
      // 6. Causal relation detection (5%)
      const causalAnalysis = analyzeCausalRelation(qa, qb);
      
      // Combined weighted score
      const weight = 
        semanticSim * 0.4 + 
        embeddingSim * 0.2 + 
        sameNeed + 
        sameDim + 
        pipelineScore +
        causalAnalysis.score;
      
      if (weight >= baseThreshold) {
        candidates.push({ 
          target: qb.id, 
          weight,
          relationType: causalAnalysis.type,
          semanticScore: semanticSim,
          reason: `${(semanticSim * 100).toFixed(0)}% semantic similarity${causalAnalysis.type ? `, ${causalAnalysis.type} relationship` : ''}`
        });
      }
    });

    // Sort by weight and take top connections
    candidates.sort((a, b) => b.weight - a.weight);
    candidates.slice(0, limitPerNode).forEach(({ target, weight, relationType, semanticScore, reason }) => {
      const key = [qa.id, target].sort().join('-');
      if (!linkMap.has(key)) {
        linkMap.set(key, {
          id: nanoid(),
          source: qa.id,
          target,
          weight,
          relationType,
          semanticScore,
          reason
        });
      }
    });
  });

  links = Array.from(linkMap.values());
  console.log(`✅ Generated ${links.length} semantic connections`);
  
  // Log strongest connections
  const strongLinks = links.filter(l => l.weight > 0.5).slice(0, 5);
  if (strongLinks.length > 0) {
    console.log('🌟 Strongest connections:');
    strongLinks.forEach(link => {
      const q1 = questions.find(q => q.id === link.source);
      const q2 = questions.find(q => q.id === link.target);
      console.log(`  - "${q1?.text.slice(0, 40)}..." ↔ "${q2?.text.slice(0, 40)}..." (${(link.weight * 100).toFixed(0)}%)`);
      console.log(`    Reason: ${link.reason}`);
    });
  }
}

function detectThinkingRooms() {
  const clusters = [];
  const visited = new Set();
  
  questions.forEach(q => {
    if (visited.has(q.id)) return;
    
    const cluster = [q];
    visited.add(q.id);
    
    // Find strongly connected questions (weight > 0.45)
    const connectedLinks = links.filter(l => 
      (l.source === q.id || l.target === q.id) && l.weight > 0.45
    );
    
    connectedLinks.forEach(link => {
      const otherId = link.source === q.id ? link.target : link.source;
      const otherQ = questions.find(qu => qu.id === otherId);
      if (otherQ && !visited.has(otherId)) {
        cluster.push(otherQ);
        visited.add(otherId);
      }
    });
    
    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  });
  
  thinkingRooms = clusters.map((cluster, idx) => {
    const mainNeed = cluster[0].need;
    
    // Extract common themes from cluster
    const allTerms = cluster.map(q => extractKeyTerms(q.text));
    const termFrequency = {};
    allTerms.forEach(terms => {
      Object.keys(terms).forEach(term => {
        termFrequency[term] = (termFrequency[term] || 0) + 1;
      });
    });
    
    // Get most common terms
    const commonThemes = Object.entries(termFrequency)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term)
      .join(', ');
    
    return {
      id: nanoid(),
      name: `${mainNeed} Room ${idx + 1}`,
      theme: commonThemes || cluster.map(q => q.text.split(' ').slice(0, 3).join(' ')).join(', ').substring(0, 100),
      questionIds: cluster.map(q => q.id),
      participants: [],
      status: 'open',
      createdAt: Date.now(),
      strength: (cluster.length / questions.length) * 100 // % of total questions
    };
  });
  
  console.log(`🏠 Detected ${thinkingRooms.length} thinking rooms`);
}

// ===== API ENDPOINTS =====

app.post('/api/questions', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Text required' });
    }

    const classification = classifyMaxNeef(text);
    const embedding = simpleEmbed(text);
    const position = calculatePosition(classification.need, classification.dimension);

    const question = {
      id: nanoid(),
      text: text.trim(),
      ...classification,
      embedding,
      position,
      status: 'unanswered',
      createdAt: Date.now()
    };

    questions.push(question);
    
    console.log(`📝 Question added: "${text.slice(0, 50)}..." (${classification.need}/${classification.dimension})`);
    
    // Regenerate links with semantic analysis
    generateLinks(0.2, 8);
    detectThinkingRooms();
    
    res.json(question);
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

app.get('/api/questions', (req, res) => {
  res.json(questions);
});

app.patch('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const idx = questions.findIndex(q => q.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Question not found' });
  }
  
  questions[idx] = { ...questions[idx], ...updates };
  res.json(questions[idx]);
});

app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  questions = questions.filter(q => q.id !== id);
  links = links.filter(l => l.source !== id && l.target !== id);
  responses = responses.filter(r => r.questionId !== id);
  res.json({ success: true });
});

app.post('/api/responses', (req, res) => {
  try {
    const { questionId, userId, answer, metadata } = req.body;
    
    const response = {
      id: nanoid(),
      questionId,
      userId: userId || 'anonymous',
      answer,
      metadata: metadata || {},
      createdAt: Date.now()
    };
    
    responses.push(response);
    
    const question = questions.find(q => q.id === questionId);
    if (question) {
      question.status = 'answered';
      question.lastAnsweredAt = Date.now();
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

app.get('/api/responses/question/:questionId', (req, res) => {
  const { questionId } = req.params;
  const questionResponses = responses.filter(r => r.questionId === questionId);
  res.json(questionResponses);
});

app.get('/api/responses/user/:userId', (req, res) => {
  const { userId } = req.params;
  const userResponses = responses.filter(r => r.userId === userId);
  res.json(userResponses);
});

app.post('/api/auto-links', (req, res) => {
  try {
    const { baseThreshold = 0.2, limitPerNode = 8 } = req.body;
    generateLinks(baseThreshold, limitPerNode);
    detectThinkingRooms();
    res.json({ links, thinkingRooms });
  } catch (error) {
    console.error('Error generating links:', error);
    res.status(500).json({ error: 'Failed to generate links' });
  }
});

app.get('/api/links', (req, res) => {
  res.json(links);
});

app.get('/api/graph', (req, res) => {
  res.json({
    nodes: questions,
    links,
    thinkingRooms
  });
});

app.get('/api/thinking-rooms', (req, res) => {
  res.json(thinkingRooms);
});

app.post('/api/thinking-rooms/:id/join', (req, res) => {
  const { id } = req.params;
  const { userId, userName } = req.body;
  
  const room = thinkingRooms.find(r => r.id === id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (!room.participants.find(p => p.userId === userId)) {
    room.participants.push({
      userId,
      userName: userName || 'Anonymous',
      joinedAt: Date.now()
    });
  }
  
  res.json(room);
});

app.post('/api/thinking-rooms/:id/leave', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  const room = thinkingRooms.find(r => r.id === id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  room.participants = room.participants.filter(p => p.userId !== userId);
  res.json(room);
});

app.post('/api/seed-demo', async (req, res) => {
  questions = [];
  links = [];
  responses = [];
  thinkingRooms = [];

  const demoQuestions = [
    "How can we improve team collaboration and communication?",
    "What training programs do we need for skill development?",
    "How do we protect sensitive customer data?",
    "What's our strategy for market expansion next year?",
    "How can we foster innovation and creativity?",
    "What work-life balance policies should we implement?",
    "How do we measure employee satisfaction?",
    "What's our approach to sustainable business practices?",
    "How can we improve customer support response time?",
    "What recognition programs motivate our team?",
    "Comment améliorer la communication entre départements?",
    "Quels sont nos objectifs de croissance à 5 ans?",
    "Comment garantir la sécurité des données clients?",
    "Quelle culture d'entreprise voulons-nous développer?",
    "Comment encourager l'initiative personnelle?",
    "Quels outils collaboratifs adopter?",
    "Comment mesurer notre impact social?",
    "Quelle stratégie de recrutement pour 2025?",
    "Comment améliorer la rétention des talents?",
    "Quel processus d'innovation mettre en place?"
  ];

  for (const text of demoQuestions) {
    const classification = classifyMaxNeef(text);
    const embedding = simpleEmbed(text);
    const position = calculatePosition(classification.need, classification.dimension);

    questions.push({
      id: nanoid(),
      text,
      ...classification,
      embedding,
      position,
      status: Math.random() > 0.7 ? 'answered' : 'unanswered',
      createdAt: Date.now() - Math.random() * 86400000 * 30
    });
  }

  generateLinks(0.2, 8);
  detectThinkingRooms();

  res.json({ 
    message: 'Demo seeded with semantic analysis', 
    count: questions.length,
    links: links.length,
    rooms: thinkingRooms.length 
  });
});

app.post('/api/reset', (req, res) => {
  questions = [];
  links = [];
  responses = [];
  thinkingRooms = [];
  users = [];
  res.json({ message: 'Reset successful' });
});

app.get('/api/analytics', (req, res) => {
  const needDistribution = {};
  const dimensionDistribution = {};
  const statusDistribution = { answered: 0, unanswered: 0, in_progress: 0 };
  
  questions.forEach(q => {
    needDistribution[q.need] = (needDistribution[q.need] || 0) + 1;
    dimensionDistribution[q.dimension] = (dimensionDistribution[q.dimension] || 0) + 1;
    statusDistribution[q.status] = (statusDistribution[q.status] || 0) + 1;
  });
  
  // Analyze link strength distribution
  const linkStrength = {
    strong: links.filter(l => l.weight > 0.5).length,
    medium: links.filter(l => l.weight > 0.3 && l.weight <= 0.5).length,
    weak: links.filter(l => l.weight <= 0.3).length
  };
  
  res.json({
    totalQuestions: questions.length,
    totalResponses: responses.length,
    totalLinks: links.length,
    linkStrength,
    totalRooms: thinkingRooms.length,
    activeRooms: thinkingRooms.filter(r => r.participants.length > 0).length,
    needDistribution,
    dimensionDistribution,
    statusDistribution,
    responseRate: questions.length > 0 
      ? (statusDistribution.answered / questions.length * 100).toFixed(1) + '%'
      : '0%'
  });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 WiseWays server running on http://localhost:${PORT}`);
  console.log(`🧠 Semantic analysis engine: ACTIVE`);
  console.log(`🔗 Connection analysis: ENHANCED`);
});