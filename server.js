// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialiser la base de données SQLite
const dbPath = path.resolve(__dirname, 'pacCoinLeaderboard.db');
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    return console.error('Erreur lors de la connexion à la base de données:', err.message);
  }
  console.log('Connecté à la base de données SQLite');
  
  // Créer la table si elle n'existe pas
  db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER DEFAULT 1,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Route pour récupérer le leaderboard (top 10)
app.get('/api/leaderboard', (req, res) => {
  db.all(`SELECT wallet_address, score, level, date_created 
          FROM leaderboard 
          ORDER BY score DESC
          LIMIT 10`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Route pour récupérer le meilleur score d'un utilisateur
app.get('/api/leaderboard/:wallet', (req, res) => {
  const wallet = req.params.wallet;
  
  db.get(`SELECT wallet_address, score, level, date_created 
          FROM leaderboard 
          WHERE wallet_address = ?
          ORDER BY score DESC
          LIMIT 1`, [wallet], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { wallet_address: wallet, score: 0, level: 1 });
  });
});

// Route pour enregistrer un score
// Route pour enregistrer un score
app.post('/api/score', (req, res) => {
    const { wallet_address } = req.body;
    // Convertir score et level en nombre
    const score = Number(req.body.score);
    const level = req.body.level ? Number(req.body.level) : 1;
  
    // Vérifier que wallet_address et score sont valides
    if (!wallet_address || req.body.score === undefined || isNaN(score)) {
      return res.status(400).json({ error: "Adresse de portefeuille et score requis" });
    }
  
    // Vérifier si l'utilisateur a déjà un score
    db.get(
      `SELECT id, score FROM leaderboard WHERE wallet_address = ? ORDER BY score DESC LIMIT 1`,
      [wallet_address],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
  
        if (!row || score > row.score) {
          // Si un score existe déjà, supprimer l'enregistrement
          if (row) {
            db.run(`DELETE FROM leaderboard WHERE id = ?`, [row.id]);
          }
          // Ajouter le nouveau score
          db.run(
            `INSERT INTO leaderboard (wallet_address, score, level) VALUES (?, ?, ?)`,
            [wallet_address, score, level],
            function (err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({
                id: this.lastID,
                message: "Score enregistré avec succès",
                isNewHighScore: true
              });
            }
          );
        } else {
          // Le score n'est pas supérieur au score actuel
          res.json({
            message: "Score non enregistré (inférieur au meilleur score)",
            isNewHighScore: false,
            currentHighScore: row.score
          });
        }
      }
    );
  });

// Route pour le leaderboard
app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});

// Fermer proprement la base de données lors de l'arrêt du serveur
process.on('SIGINT', () => {
  db.close(() => {
    console.log('Base de données fermée');
    process.exit(0);
  });
}); 