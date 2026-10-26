// Leaderboard stored in the browser (localStorage). Top 10 only.

const KEY = 'timeTravelers.v1';

export function loadScores() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveScore(entry) {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {
    /* storage blocked: leaderboard just won't persist */
  }
  return top;
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function renderBoard(listEl) {
  const scores = loadScores();
  listEl.textContent = '';
  if (!scores.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Be the first traveler!';
    listEl.appendChild(li);
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'n';
    name.textContent = `${medals[i] || i + 1 + '.'} ${s.name}`; // textContent = safe from HTML injection
    const pts = document.createElement('span');
    pts.className = 'p';
    pts.textContent = s.score;
    li.append(name, pts);
    listEl.appendChild(li);
  });
}
