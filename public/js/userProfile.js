// public/js/userProfile.js
// Controller for viewing another user's public profile

(async function () {
  'use strict';

  /* ── Get username from URL ── */
  const params   = new URLSearchParams(window.location.search);
  const username = params.get('username');

  if (!username) {
    document.getElementById('user-display-name').textContent = 'User not found';
    document.getElementById('reviews-list').innerHTML = '<p class="empty-msg">No username specified.</p>';
    return;
  }

  /* ── Topbar: populate logged-in user info if available ── */
  const token = localStorage.getItem('jwtToken');
  if (token) {
    try {
      const meRes = await fetch('/api/profile', { headers: { Authorization: token } });
      if (meRes.ok) {
        const me = await meRes.json();
        const initEl = document.getElementById('topbar-initials');
        const nameEl = document.getElementById('topbar-username-label');
        if (nameEl) nameEl.textContent = me.username || '';
        if (initEl) {
          if (me.profile_photo) {
            initEl.style.backgroundImage = `url('${me.profile_photo}')`;
            initEl.style.backgroundSize  = 'cover';
            initEl.style.backgroundPosition = 'center';
            initEl.textContent = '';
          } else {
            const initials = ((me.first_name?.[0] || '') + (me.last_name?.[0] || '')).toUpperCase() || me.username?.slice(0, 2).toUpperCase() || '?';
            initEl.textContent = initials;
          }
        }
      }
    } catch (_) {}
  }

  /* ── Fetch public profile ── */
  try {
    const res  = await fetch(`/api/users/${encodeURIComponent(username)}/profile`);
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('user-display-name').textContent = 'User not found';
      document.getElementById('reviews-list').innerHTML = '<p class="empty-msg">This user could not be found.</p>';
      return;
    }

    const { user, reviews } = data;

    // submission count
    const submissionEl = document.getElementById("submission-count");
    if (submissionEl) {
      submissionEl.textContent = user.submission_count ?? 0;
    }

    // streak
    const streak = calcStreak(reviews);
    const streakEl = document.getElementById("week-streak");
    if (streakEl) {
      streakEl.textContent = `${streak} wk${streak !== 1 ? "s" : ""}`;
    }

    // rank
      try {
        const lbRes = await fetch("/api/leaderboard", token
          ? { headers: { Authorization: token } }
          : {}
        );

        if (lbRes.ok) {
          const { leaderboard } = await lbRes.json();

          const rankedUser = leaderboard.find(u => u.username === user.username);

          const rankEl = document.getElementById("rank");
          if (rankEl) {
            rankEl.textContent = rankedUser ? `#${rankedUser.rank}` : "—";
          }
        }
      } catch (e) {
        console.error("Could not load leaderboard:", e);
      }


    /* ── Render profile hero ── */
    document.title = `${user.username} – Plated`;

    const avatarEl = document.getElementById('user-avatar');
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

    document.getElementById('user-display-name').textContent = displayName;
    document.getElementById('user-username').textContent     = `@${user.username}`;
    document.getElementById('section-username').textContent  = user.username;
    document.getElementById('review-count').textContent      = reviews.length;

    if (user.profile_photo) {
      avatarEl.style.backgroundImage    = `url('${user.profile_photo}')`;
      avatarEl.style.backgroundSize     = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    } else {
      const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || user.username?.slice(0, 2).toUpperCase() || '?';
      avatarEl.textContent = initials;
    }

    /* ── Render reviews ── */
    const listEl = document.getElementById('reviews-list');

    if (reviews.length === 0) {
      listEl.innerHTML = '<p class="empty-msg">No reviews yet.</p>';
      return;
    }

    listEl.innerHTML = '';

    reviews.forEach(r => {
      const card = document.createElement('article');
      card.className = 'review-item';

      /* Stars */
      const starsHtml = r.stars
        ? `<span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>`
        : '';

      /* Sentiment badge */
      const sentimentMap = { positive: ['😊', 'positive'], neutral: ['😐', 'neutral'], negative: ['😞', 'negative'] };
      const [icon, cls]  = sentimentMap[r.sentiment] || ['', ''];
      const sentimentHtml = r.sentiment
        ? `<span class="sentiment-badge ${cls}">${icon} ${r.sentiment}</span>`
        : '';

      /* Date */
      const dateStr = r.visit_date
        ? new Date(r.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      /* Dishes */
      let dishesHtml = '';
      if (r.favorite_dishes) {
        const dishes = typeof r.favorite_dishes === 'string'
          ? r.favorite_dishes.split(',').map(d => d.trim()).filter(Boolean)
          : r.favorite_dishes;
        if (dishes.length) {
          dishesHtml = `<div class="review-dishes">${dishes.map(d => `<span class="dish-chip">${escapeHtml(d)}</span>`).join('')}</div>`;
        }
      }

      /* Photos */
      let photosHtml = '';
      if (r.photos && r.photos.length) {
        photosHtml = `<div class="review-photos">${r.photos.map(p => `<img src="${p}" alt="Review photo" loading="lazy" />`).join('')}</div>`;
      }

      /* Notes */
      const notesHtml = r.notes ? `<p class="review-notes">${escapeHtml(r.notes)}</p>` : '';

      card.innerHTML = `
        <div class="review-header">
          <a class="review-restaurant" href="restaurant.html?id=${r.restaurant_id}">${escapeHtml(r.restaurantName || 'Restaurant')}</a>
          <span class="review-date">${dateStr}</span>
        </div>
        <div class="review-meta">
          ${starsHtml}
          ${sentimentHtml}
        </div>
        ${notesHtml}
        ${dishesHtml}
        ${photosHtml}
      `;

      listEl.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load user profile:', err);
    document.getElementById('reviews-list').innerHTML = '<p class="empty-msg">Failed to load profile. Please try again.</p>';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function calcStreak(reviews) {
    if (!reviews.length) return 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    // Get Monday-based week start timestamp for a date
    const weekStart = (d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
        return date.getTime();
    };

    const weeks = new Set(reviews.map(r => weekStart(r.created_at)));
    const thisWeek = weekStart(new Date());
    const lastWeek = thisWeek - MS_WEEK;

    // Start from this week if it has a review, else last week
    let current = weeks.has(thisWeek) ? thisWeek : (weeks.has(lastWeek) ? lastWeek : null);
    if (!current) return 0;

    let streak = 0;
    while (weeks.has(current)) {
        streak++;
        current -= MS_WEEK;
    }
    return streak;
}


})();


