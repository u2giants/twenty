/**
 * UI overlay script for the Twenty CRM deployment.
 *
 * Autocomplete features (existing):
 * - On focus: shows last 5 searched emails from history
 * - On type: filters history + known workspace member emails
 * - On selection / Enter / Search-button click: saves email to history
 *
 * New-tab impersonation (new):
 * - Each autocomplete suggestion has a "→ New tab" link
 * - Clicking it calls the Twenty impersonate mutation as admin, exchanges
 *   the resulting login token for a full token pair, and opens a new
 *   browser tab that starts a real session as that user — identical to
 *   if they had logged in themselves.
 *
 * Page-load handler:
 * - If the URL hash contains #__poc_su=<base64>, the script extracts the
 *   encoded tokenPair, writes it to the tokenPair cookie, strips the hash,
 *   and reloads so Twenty boots with that user's real session.
 *
 * Invite flow patch:
 * - The live frontend redirects social invite sign-in with `inviteToken=...`
 *   but the backend expects `workspacePersonalInviteToken=...`.
 * - This script intercepts invite-page Microsoft/Google auth clicks and
 *   rewrites the redirect so the invite token survives.
 *
 * Signed-in user indicator:
 * - Adds a small fixed badge at the top-left showing the logged-in user.
 */
(function () {
  'use strict';

  /* ── Constants ───────────────────────────────────────────────────────── */

  var PLACEHOLDER          = 'Enter user ID or email address';
  var GRAPHQL_URL          = ((window._env_ && window._env_.REACT_APP_SERVER_BASE_URL) || window.location.origin) + '/graphql';
  // impersonate mutation is a @MetadataResolver — it lives at /metadata, not /graphql
  var METADATA_URL         = ((window._env_ && window._env_.REACT_APP_SERVER_BASE_URL) || window.location.origin) + '/metadata';
  var HISTORY_KEY          = 'twenty_impersonate_history';
  var MAX_HISTORY          = 20;
  var MAX_SHOWN            = 5;
  var EMAIL_REGEX          = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  var EMAIL_GLOBAL_REGEX   = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig;
  var IMPERSONATION_TEXT   = /impersonation|impersonate/i;
  var NEW_TAB_HASH_KEY     = '__poc_su';
  var INVITE_AUTH_TEXT     = /continue with (microsoft|google)/i;
  var TOP_LEFT_TEXT_EXCLUDE = /^(search|settings|workspace|people|companies|opportunities|tasks|notes|favorites|add new|calculate)$/i;

  var MEMBERS_WITH_IDS_QUERY = [
    'query GetWorkspaceMembersForImpersonation {',
    '  workspaceMembers(first: 200) {',
    '    edges {',
    '      node {',
    '        id',
    '        userId',
    '        userEmail',
    '      }',
    '    }',
    '  }',
    '}'
  ].join('\n');

  var CURRENT_USER_QUERY = [
    'query GetCurrentUserForImpersonationAutocomplete {',
    '  currentUser {',
    '    id',
    '    firstName',
    '    lastName',
    '    email',
    '    workspaceMembers {',
      '      id',
      '      userEmail',
    '    }',
  '  }',
    '}'
  ].join('\n');

  var IMPERSONATE_MUTATION = [
    'mutation Impersonate($userId: UUID!, $workspaceId: UUID!) {',
    '  impersonate(userId: $userId, workspaceId: $workspaceId) {',
    '    workspace { id }',
    '    loginToken { token expiresAt }',
    '  }',
    '}'
  ].join('\n');

  var GET_TOKENS_MUTATION = [
    'mutation GetAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {',
    '  getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {',
    '    tokens {',
    '      accessOrWorkspaceAgnosticToken { token expiresAt }',
    '      refreshToken { token expiresAt }',
    '    }',
    '  }',
    '}'
  ].join('\n');

  /* ── Shared state ────────────────────────────────────────────────────── */

  var _origFetch        = window.fetch.bind(window);
  var _userListCache    = null;   // [{ email, id }]
  var _userListPromise  = null;
  var _capturedToken    = null;   // bearer token captured from outgoing requests
  var _currentUserInfo  = null;
  var _currentUserPromise = null;
  var _lastCurrentUserFetchAt = 0;

  /* ── Page-load handler: new-tab session bootstrap ────────────────────── */

  (function bootstrapNewTabSession() {
    var hash = window.location.hash || '';
    var prefix = '#' + NEW_TAB_HASH_KEY + '=';
    if (hash.indexOf(prefix) !== 0) return;

    var encoded = hash.slice(prefix.length);
    if (!encoded) return;

    try {
      var json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      var pair = JSON.parse(json);
      if (!pair || !pair.accessOrWorkspaceAgnosticToken) return;

      // Write the tokenPair cookie so Twenty's frontend picks it up on load
      document.cookie =
        'tokenPair=' + encodeURIComponent(JSON.stringify(pair)) +
        '; path=/; SameSite=Lax';

      // Clean the URL and reload as the impersonated user
      history.replaceState(null, '', window.location.pathname + window.location.search);
      window.location.reload();
    } catch (e) {
      console.warn('[poc-impersonate] Failed to bootstrap session from hash:', e);
    }
  })();

  /* ── Token capture from outgoing requests ────────────────────────────── */

  window.fetch = function (input, init) {
    // Capture bearer token from outgoing Authorization headers
    try {
      if (init && init.headers) {
        var auth = (
          (init.headers['authorization'] || '') ||
          (init.headers['Authorization'] || '')
        );
        if (typeof auth === 'string' && auth.indexOf('Bearer ') === 0) {
          _capturedToken = auth.slice(7);
        }
      }
    } catch (_) {}

    return _origFetch(input, init).then(function (response) {
      try {
        var contentType = response.headers && response.headers.get && response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
          response.clone().json().then(cacheEmailsFromUnknownPayload).catch(function () {});
        }
      } catch (_) {}
      return response;
    });
  };

  /* ── JWT helpers ─────────────────────────────────────────────────────── */

  function decodeJwtPayload(token) {
    try {
      var parts = (token || '').split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var padded = b64 + '==='.slice(0, (4 - b64.length % 4) % 4);
      return JSON.parse(atob(padded));
    } catch (_) { return null; }
  }

  function getTokenFromCookie() {
    try {
      var m = document.cookie.match(/(?:^|;\s*)tokenPair=([^;]+)/);
      if (!m) return null;
      var pair = JSON.parse(decodeURIComponent(m[1]));
      return (pair && pair.accessOrWorkspaceAgnosticToken && pair.accessOrWorkspaceAgnosticToken.token) || null;
    } catch (_) { return null; }
  }

  function getCurrentToken() {
    return _capturedToken || getTokenFromCookie();
  }

  function getWorkspaceId() {
    var token = getCurrentToken();
    if (!token) return null;
    var payload = decodeJwtPayload(token);
    return (payload && (payload.workspaceId || payload.workspace_id || payload.sub_workspace_id)) || null;
  }

  /* ── Email helpers ───────────────────────────────────────────────────── */

  function uniqueEmails(values) {
    var seen = new Set();
    var emails = [];
    for (var i = 0; i < values.length; i++) {
      var email = (values[i] || '').trim();
      if (!isEmail(email)) continue;
      var normalized = email.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      emails.push(email);
    }
    return emails;
  }

  function collectEmailsFromText(text) {
    if (!text) return [];
    var matches = text.match(EMAIL_GLOBAL_REGEX);
    return matches ? uniqueEmails(matches) : [];
  }

  function mergeEmails() {
    var values = [];
    for (var i = 0; i < arguments.length; i++) {
      var chunk = arguments[i] || [];
      for (var j = 0; j < chunk.length; j++) values.push(chunk[j]);
    }
    return uniqueEmails(values);
  }

  function isEmail(value) {
    return EMAIL_REGEX.test((value || '').trim());
  }

  /* ── History helpers ─────────────────────────────────────────────────── */

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function saveToHistory(email) {
    email = (email || '').trim();
    if (!email) return;
    var h = getHistory().filter(function(e) { return e !== email; });
    h.unshift(email);
    if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  }

  /* ── Member cache (email + id) ───────────────────────────────────────── */

  function cacheEmailsFromUnknownPayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.currentUser && typeof payload.currentUser === 'object') {
      _currentUserInfo = payload.currentUser;
    } else if (payload.data && payload.data.currentUser && typeof payload.data.currentUser === 'object') {
      _currentUserInfo = payload.data.currentUser;
    }
    var discovered = [];
    var queue = [payload];
    var visited = new Set();
    while (queue.length) {
      var current = queue.shift();
      if (!current || typeof current !== 'object') continue;
      if (visited.has(current)) continue;
      visited.add(current);
      if (Array.isArray(current)) {
        for (var i = 0; i < current.length; i++) queue.push(current[i]);
        continue;
      }
      for (var key in current) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
        var value = current[key];
        if (typeof value === 'string') {
          if (key === 'userEmail' || key === 'email' || isEmail(value)) {
            discovered.push(value);
          } else {
            var matches = collectEmailsFromText(value);
            for (var j = 0; j < matches.length; j++) discovered.push(matches[j]);
          }
        } else if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
    if (discovered.length) {
      _userListCache = _userListCache || [];
      var emailsOnly = _userListCache.map(function(m) { return m.email; });
      discovered.forEach(function(e) {
        if (!emailsOnly.includes(e.toLowerCase())) {
          _userListCache.push({ email: e, id: null });
          emailsOnly.push(e.toLowerCase());
        }
      });
    }
  }

  function getUserEmailsFromDom() {
    var emails = [];
    var selectors = [
      'input[type="email"]', 'a[href^="mailto:"]', 'table td',
      '[role="gridcell"]', '[role="cell"]', '[data-tooltip-content]', '[title]'
    ];
    var nodes = document.querySelectorAll(selectors.join(','));
    function extractEmailValue(node) {
      if (!node) return '';
      if (isEmail(node.value)) return node.value.trim();
      if (isEmail(node.textContent)) return node.textContent.trim();
      if (node.getAttribute) {
        var title = node.getAttribute('title');
        if (isEmail(title)) return title.trim();
        var aria = node.getAttribute('aria-label');
        if (isEmail(aria)) return aria.trim();
        var href = node.getAttribute('href');
        if (href && href.indexOf('mailto:') === 0) return href.slice(7).trim();
      }
      return '';
    }
    for (var i = 0; i < nodes.length; i++) {
      var email = extractEmailValue(nodes[i]);
      if (email) emails.push(email);
      var textMatches = collectEmailsFromText(nodes[i].textContent || '');
      for (var j = 0; j < textMatches.length; j++) emails.push(textMatches[j]);
    }
    return uniqueEmails(emails);
  }

  function gqlFetch(query, variables, url) {
    var token = getCurrentToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return _origFetch(url || GRAPHQL_URL, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ query: query, variables: variables || {} })
    }).then(function(res) { return res.ok ? res.json() : null; });
  }

  function fetchWorkspaceMembersFromApi() {
    // Try the workspace members connection query first (returns id, userId + userEmail)
    return gqlFetch(MEMBERS_WITH_IDS_QUERY)
      .then(function(json) {
        var edges = (((json || {}).data || {}).workspaceMembers || {}).edges || [];
        if (edges.length) return edges.map(function(e) { return e.node; });
        // Fallback: currentUser.workspaceMembers (flat array)
        return gqlFetch(CURRENT_USER_QUERY).then(function(json2) {
          var currentUser = (((json2 || {}).data || {}).currentUser || null);
          if (currentUser) _currentUserInfo = currentUser;
          return ((currentUser || {}).workspaceMembers || []);
        });
      })
      .catch(function() { return []; });
  }

  function fetchCurrentUserInfo(force) {
    var now = Date.now();
    if (!force && _currentUserInfo && (now - _lastCurrentUserFetchAt) < 30000) {
      return Promise.resolve(_currentUserInfo);
    }
    if (!force && _currentUserPromise) return _currentUserPromise;

    _currentUserPromise = gqlFetch(CURRENT_USER_QUERY)
      .then(function(json) {
        var currentUser = (((json || {}).data || {}).currentUser || null);
        if (currentUser) {
          _currentUserInfo = currentUser;
          _lastCurrentUserFetchAt = Date.now();
        }
        return _currentUserInfo;
      })
      .catch(function() {
        return _currentUserInfo;
      })
      .finally(function() {
        _currentUserPromise = null;
      });

    return _currentUserPromise;
  }

  function getCurrentUserDisplayName() {
    var currentUser = _currentUserInfo;
    if (!currentUser) return '';
    var firstName = (currentUser.firstName || '').trim();
    var lastName  = (currentUser.lastName || '').trim();
    var fullName  = (firstName + ' ' + lastName).trim();
    if (fullName) return fullName;
    if (isEmail(currentUser.email || '')) return (currentUser.email || '').trim();
    return '';
  }

  function isVisibleElement(el) {
    if (!el || !el.isConnected) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    var style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isInvitePage() {
    return /^\/invite\//i.test(window.location.pathname || '');
  }

  function getInviteHashFromPath() {
    var match = (window.location.pathname || '').match(/^\/invite\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function buildInviteSocialAuthUrl(provider) {
    var inviteHash = getInviteHashFromPath();
    var inviteToken = new URLSearchParams(window.location.search || '').get('inviteToken');
    if (!inviteHash || !inviteToken) return '';
    var url = new URL('/auth/' + provider, window.location.origin);
    url.searchParams.set('workspaceInviteHash', inviteHash);
    url.searchParams.set('workspacePersonalInviteToken', inviteToken);
    url.searchParams.set('action', 'join-workspace');
    return url.toString();
  }

  function interceptInviteSocialAuth(event) {
    if (!isInvitePage()) return;
    var target = event.target && event.target.closest && event.target.closest('button, a');
    if (!target) return;
    var text = (target.innerText || target.textContent || '').trim();
    if (!INVITE_AUTH_TEXT.test(text)) return;

    var provider = /microsoft/i.test(text) ? 'microsoft' : (/google/i.test(text) ? 'google' : '');
    if (!provider) return;

    var redirectUrl = buildInviteSocialAuthUrl(provider);
    if (!redirectUrl) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    window.location.assign(redirectUrl);
  }

  function findTopLeftLabelTarget() {
    var candidates = Array.prototype.slice.call(
      document.querySelectorAll('button, a, [role="button"], div, span')
    ).filter(function(el) {
      if (!isVisibleElement(el)) return false;
      var rect = el.getBoundingClientRect();
      if (rect.x > 320 || rect.y > 120) return false;
      var text = (el.innerText || '').trim();
      if (!text || text.indexOf('\n') !== -1) return false;
      if (text.length > 80 || TOP_LEFT_TEXT_EXCLUDE.test(text)) return false;
      if (isEmail(text)) return false;
      return !!(el.querySelector && el.querySelector('img, svg'));
    });

    candidates.sort(function(a, b) {
      var ar = a.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      if (ar.y !== br.y) return ar.y - br.y;
      if (ar.x !== br.x) return ar.x - br.x;
      return br.width - ar.width;
    });

    return candidates[0] || null;
  }

  function replaceLeafText(container, nextText) {
    var leafs = Array.prototype.slice.call(container.querySelectorAll('span, div, p'))
      .filter(function(el) {
        if (!isVisibleElement(el)) return false;
        var text = (el.innerText || '').trim();
        return !!text && text.indexOf('\n') === -1 && !TOP_LEFT_TEXT_EXCLUDE.test(text);
      });

    leafs.sort(function(a, b) {
      var ar = a.getBoundingClientRect();
      var br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });

    var target = leafs[0] || container;
    if (target.dataset && target.dataset.twentyUserLabelApplied === '1') return true;
    target.textContent = nextText;
    if (target.dataset) target.dataset.twentyUserLabelApplied = '1';
    return true;
  }

  function ensureSignedInBadge(displayName) {
    if (!displayName) return;

    var badge = document.getElementById('twenty-signed-in-user-badge');

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'twenty-signed-in-user-badge';
      badge.setAttribute('aria-live', 'polite');
      badge.style.position = 'fixed';
      badge.style.top = '10px';
      badge.style.left = '72px';
      badge.style.zIndex = '2147483647';
      badge.style.maxWidth = 'calc(100vw - 96px)';
      badge.style.padding = '6px 10px';
      badge.style.borderRadius = '999px';
      badge.style.background = 'rgba(15, 23, 42, 0.9)';
      badge.style.color = '#fff';
      badge.style.fontSize = '12px';
      badge.style.fontWeight = '600';
      badge.style.lineHeight = '1.2';
      badge.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.18)';
      badge.style.pointerEvents = 'none';
      badge.style.whiteSpace = 'nowrap';
      badge.style.overflow = 'hidden';
      badge.style.textOverflow = 'ellipsis';
      document.body.appendChild(badge);
    }

    badge.textContent = 'Signed in: ' + displayName;
  }

  function syncTopLeftUserLabel() {
    if (isInvitePage()) return;
    var displayName = getCurrentUserDisplayName();
    if (!displayName) return;
    ensureSignedInBadge(displayName);
    var target = findTopLeftLabelTarget();
    if (!target) return;
    replaceLeafText(target, displayName);
  }

  function scheduleUserLabelRefresh(force) {
    if (isInvitePage()) return;
    window.setTimeout(function() {
      fetchCurrentUserInfo(force).then(function() {
        syncTopLeftUserLabel();
      });
    }, 0);
  }

  function fetchUserList() {
    var domEmails = getUserEmailsFromDom();

    if (_userListCache && _userListCache.length) {
      // Merge in any DOM-scraped emails not yet in cache
      var known = new Set(_userListCache.map(function(m) { return (m.email || '').toLowerCase(); }));
      domEmails.forEach(function(e) {
        if (!known.has(e.toLowerCase())) _userListCache.push({ email: e, id: null });
      });
      return Promise.resolve(_userListCache);
    }

    if (_userListPromise) {
      return _userListPromise.then(function(list) {
        var known = new Set(list.map(function(m) { return (m.email || '').toLowerCase(); }));
        domEmails.forEach(function(e) {
          if (!known.has(e.toLowerCase())) list.push({ email: e, id: null });
        });
        _userListCache = list;
        return _userListCache;
      });
    }

    _userListPromise = fetchWorkspaceMembersFromApi()
      .then(function(members) {
        // Normalize to { email, id } shape
        var list = members.map(function(m) {
          return { email: (m.userEmail || m.email || '').trim(), id: m.id || null, userId: m.userId || null };
        }).filter(function(m) { return isEmail(m.email); });

        // Merge DOM emails
        var known = new Set(list.map(function(m) { return m.email.toLowerCase(); }));
        domEmails.forEach(function(e) {
          if (!known.has(e.toLowerCase())) list.push({ email: e, id: null });
        });

        _userListCache = list;
        return _userListCache;
      })
      .finally(function() { _userListPromise = null; });

    return _userListPromise;
  }

  /* ── Copyable error dialog ───────────────────────────────────────────── */

  function showError(message) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1f1f1f;border:1px solid #444;border-radius:10px;padding:24px 28px;max-width:480px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.6);font-family:Inter,sans-serif;';

    var title = document.createElement('div');
    title.textContent = 'Error';
    title.style.cssText = 'font-size:15px;font-weight:600;color:#e0e0e0;margin-bottom:12px;';

    var pre = document.createElement('pre');
    pre.textContent = message;
    pre.style.cssText = 'font-size:12px;color:#ccc;background:#141414;border:1px solid #333;border-radius:6px;padding:10px 12px;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text;margin:0 0 16px;max-height:200px;overflow-y:auto;';

    var hint = document.createElement('div');
    hint.textContent = 'Text above is selectable — you can copy it.';
    hint.style.cssText = 'font-size:11px;color:#666;margin-bottom:16px;';

    var btn = document.createElement('button');
    btn.textContent = 'OK';
    btn.style.cssText = 'background:#4a90d9;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:13px;cursor:pointer;float:right;';
    btn.addEventListener('click', function() { document.body.removeChild(overlay); });

    box.appendChild(title);
    box.appendChild(pre);
    box.appendChild(hint);
    box.appendChild(btn);
    overlay.appendChild(box);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
  }

  /* ── True new-tab impersonation ──────────────────────────────────────── */

  function openUserInNewTab(email, memberId) {
    var workspaceId = getWorkspaceId();
    var token = getCurrentToken();

    if (!token) {
      showError('Could not capture admin token — please navigate around the app first to prime the token cache, then try again.');
      return;
    }

    var resolveId;
    if (memberId) {
      resolveId = Promise.resolve(memberId);
    } else {
      // Look up by email in cache
      resolveId = fetchUserList().then(function(list) {
        var match = list.find(function(m) { return m.email.toLowerCase() === email.toLowerCase(); });
        return match ? (match.userId || match.id) : null;
      });
    }

    resolveId.then(function(userId) {
      if (!userId) {
        showError('Could not find user ID for ' + email + '. The user may not be a workspace member.');
        return;
      }
      if (!workspaceId) {
        showError('Could not determine workspace ID from the current session token.');
        return;
      }

      // Step 1: impersonate → loginToken  (lives on the /metadata schema)
      return gqlFetch(IMPERSONATE_MUTATION, { userId: userId, workspaceId: workspaceId }, METADATA_URL)
        .then(function(json) {
          var loginToken = (((json || {}).data || {}).impersonate || {}).loginToken;
          if (!loginToken || !loginToken.token) {
            var err = ((json || {}).errors || []).map(function(e) { return e.message; }).join('; ');
            throw new Error('Impersonate failed: ' + (err || 'no loginToken returned'));
          }
          return loginToken.token;
        })
        // Step 2: exchange loginToken → full tokenPair
        .then(function(loginTokenStr) {
          return gqlFetch(GET_TOKENS_MUTATION, {
            loginToken: loginTokenStr,
            origin: window.location.origin
          }).then(function(json) {
            var tokens = ((((json || {}).data || {}).getAuthTokensFromLoginToken || {}).tokens);
            if (!tokens || !tokens.accessOrWorkspaceAgnosticToken) {
              var err = ((json || {}).errors || []).map(function(e) { return e.message; }).join('; ');
              throw new Error('Token exchange failed: ' + (err || 'no tokens returned'));
            }
            return tokens;
          });
        })
        // Step 3: encode and open new tab
        .then(function(tokenPair) {
          var encoded = btoa(JSON.stringify(tokenPair))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          var url = window.location.origin + '/#' + NEW_TAB_HASH_KEY + '=' + encoded;
          window.open(url, '_blank', 'noopener');
          saveToHistory(email);
        });
    }).catch(function(err) {
      console.error('[poc-impersonate] openUserInNewTab error:', err);
      showError('Failed to open new tab as ' + email + ':\n' + err.message);
    });
  }

  /* ── Dropdown UI ─────────────────────────────────────────────────────── */

  var _dropdown = null;

  function getOrCreateDropdown() {
    if (_dropdown && _dropdown.isConnected) return _dropdown;
    _dropdown = document.createElement('div');
    _dropdown.id = 'twenty-impersonate-autocomplete';
    var s = _dropdown.style;
    s.position   = 'fixed';
    s.zIndex     = '99999';
    s.background = 'var(--twenty-background-secondary, #1f1f1f)';
    s.border     = '1px solid var(--twenty-border-color-medium, #3a3a3a)';
    s.borderRadius = '6px';
    s.boxShadow  = '0 8px 24px rgba(0,0,0,0.35)';
    s.padding    = '4px 0';
    s.display    = 'none';
    s.minWidth   = '220px';
    s.maxHeight  = '240px';
    s.overflowY  = 'auto';
    document.body.appendChild(_dropdown);
    return _dropdown;
  }

  function positionDropdown(input) {
    var dd   = getOrCreateDropdown();
    var rect = input.getBoundingClientRect();
    dd.style.top   = (rect.bottom + 4) + 'px';
    dd.style.left  = rect.left + 'px';
    dd.style.width = Math.max(rect.width, 280) + 'px';
  }

  function hideDropdown() {
    if (_dropdown) _dropdown.style.display = 'none';
  }

  function renderDropdown(items, input, onSelect) {
    var dd = getOrCreateDropdown();
    if (!items.length) { hideDropdown(); return; }

    dd.innerHTML = '';
    items.forEach(function(item) {
      var email = item.email || item;
      var memberId = item.userId || item.id || null;

      // ── Primary row: fills the input ──────────────────────────────────
      var emailRow = document.createElement('div');
      emailRow.setAttribute('data-role', 'email-row');
      emailRow.textContent = email;
      emailRow.style.cssText = [
        'padding:7px 12px 3px 12px',
        'cursor:pointer',
        'font-family:Inter,sans-serif',
        'font-size:13px',
        'line-height:1.4',
        'color:var(--twenty-font-color-primary,#e0e0e0)',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
      ].join(';');

      emailRow.addEventListener('mouseenter', function() {
        emailRow.style.background = 'var(--twenty-background-transparent-light,rgba(255,255,255,0.06))';
      });
      emailRow.addEventListener('mouseleave', function() {
        emailRow.style.background = 'transparent';
      });
      emailRow.addEventListener('mousedown', function(e) {
        e.preventDefault();
        onSelect(email);
      });

      // ── Action row: opens new tab — NOT part of keyboard nav ──────────
      var newTabRow = document.createElement('div');
      newTabRow.setAttribute('data-role', 'newtab-row');
      newTabRow.textContent = '\u2197 Open as ' + email + ' in new tab';
      newTabRow.style.cssText = [
        'padding:2px 12px 7px 24px',
        'cursor:pointer',
        'font-family:Inter,sans-serif',
        'font-size:11px',
        'line-height:1.4',
        'color:var(--twenty-color-blue,#4a90d9)',
        'white-space:nowrap',
        'overflow:hidden',
        'text-overflow:ellipsis',
        'opacity:0.8',
      ].join(';');

      newTabRow.addEventListener('mouseenter', function() {
        newTabRow.style.opacity = '1';
        newTabRow.style.background = 'var(--twenty-background-transparent-light,rgba(255,255,255,0.04))';
      });
      newTabRow.addEventListener('mouseleave', function() {
        newTabRow.style.opacity = '0.8';
        newTabRow.style.background = 'transparent';
      });
      newTabRow.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        hideDropdown();
        openUserInNewTab(email, memberId);
      });

      dd.appendChild(emailRow);
      dd.appendChild(newTabRow);
    });

    positionDropdown(input);
    dd.style.display = 'block';
  }

  /* ── React value injection ───────────────────────────────────────────── */

  var _nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;

  function setReactValue(input, value) {
    _nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findNearbyImpersonationSection(input) {
    var node = input;
    while (node && node !== document.body) {
      if (IMPERSONATION_TEXT.test((node.textContent || '').trim())) return node;
      node = node.parentElement;
    }
    return null;
  }

  function isImpersonationInput(input) {
    if (!input || input.disabled || input.readOnly) return false;
    if (input.matches('input[placeholder="' + PLACEHOLDER + '"]')) return true;
    var type = (input.getAttribute('type') || 'text').toLowerCase();
    if (type !== 'text' && type !== 'search' && type !== 'email') return false;
    var aria        = input.getAttribute('aria-label') || '';
    var name        = input.getAttribute('name') || '';
    var placeholder = input.getAttribute('placeholder') || '';
    if (IMPERSONATION_TEXT.test(aria) || IMPERSONATION_TEXT.test(name) || IMPERSONATION_TEXT.test(placeholder)) return true;
    return !!findNearbyImpersonationSection(input);
  }

  /* ── Core attachment ─────────────────────────────────────────────────── */

  function attachAutocomplete(input) {
    if (!isImpersonationInput(input)) return;
    if (input._twentyAcAttached) return;
    input._twentyAcAttached = true;
    var _activeIdx = -1;

    function resetActiveIndex() { _activeIdx = -1; }

    function getSuggestions(query, list) {
      var history = getHistory();
      var q = (query || '').trim().toLowerCase();
      var emailList = (list || []).map(function(m) { return m.email || m; });

      if (!q) {
        // Return history entries, enriched with ids from list
        return history.slice(0, MAX_SHOWN).map(function(e) {
          var match = (list || []).find(function(m) { return (m.email || m).toLowerCase() === e.toLowerCase(); });
          return match || { email: e, id: null };
        });
      }

      // History matches first
      var results = history
        .filter(function(e) { return e.toLowerCase().indexOf(q) !== -1; })
        .map(function(e) {
          var match = (list || []).find(function(m) { return (m.email || m).toLowerCase() === e.toLowerCase(); });
          return match || { email: e, id: null };
        });

      // Then API list matches not already in results
      var resultEmails = results.map(function(r) { return (r.email || r).toLowerCase(); });
      (list || []).forEach(function(m) {
        var email = m.email || m;
        if (email.toLowerCase().indexOf(q) !== -1 && resultEmails.indexOf(email.toLowerCase()) === -1) {
          results.push(m);
        }
      });

      return results.slice(0, MAX_SHOWN);
    }

    function onSelect(email) {
      setReactValue(input, email);
      hideDropdown();
      saveToHistory(email);
      resetActiveIndex();
    }

    input.addEventListener('focus', function() {
      resetActiveIndex();
      positionDropdown(input);
      fetchUserList().then(function(list) {
        renderDropdown(getSuggestions(input.value, list), input, onSelect);
      });
    });

    input.addEventListener('input', function() {
      resetActiveIndex();
      fetchUserList().then(function(list) {
        renderDropdown(getSuggestions(input.value, list), input, onSelect);
      });
    });

    input.addEventListener('blur', function() {
      setTimeout(hideDropdown, 160);
    });

    input.addEventListener('keydown', function(e) {
      var dd        = getOrCreateDropdown();
      // Keyboard nav only applies to email rows, not the "open in new tab" subrows
      var emailRows = Array.prototype.slice.call(dd.querySelectorAll('[data-role="email-row"]'));

      if (e.key === 'Escape') { hideDropdown(); return; }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!emailRows.length) return;
        emailRows.forEach(function(r) { r.style.background = 'transparent'; });
        if (e.key === 'ArrowDown') {
          _activeIdx = Math.min(_activeIdx + 1, emailRows.length - 1);
        } else {
          _activeIdx = Math.max(_activeIdx - 1, 0);
        }
        if (_activeIdx < 0) _activeIdx = 0;
        emailRows[_activeIdx].style.background =
          'var(--twenty-background-transparent-light, rgba(255,255,255,0.06))';
        setReactValue(input, emailRows[_activeIdx].textContent);
        return;
      }

      if (e.key === 'Enter') {
        _activeIdx = -1;
        var val = input.value.trim();
        if (val) saveToHistory(val);
        hideDropdown();
      }
    });

    // Save to history when the Search/Impersonate button is clicked
    var section = input.closest('section') || input.parentElement;
    while (section && section !== document.body) {
      section.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest && e.target.closest('button');
        if (btn) {
          var val = input.value.trim();
          if (val) saveToHistory(val);
        }
      });
      break;
    }

    window.addEventListener('scroll', function() {
      if (_dropdown && _dropdown.style.display !== 'none') positionDropdown(input);
    }, { passive: true });
    window.addEventListener('resize', function() {
      if (_dropdown && _dropdown.style.display !== 'none') positionDropdown(input);
    }, { passive: true });
  }

  /* ── DOM watcher ─────────────────────────────────────────────────────── */

  function scanForInput() {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) attachAutocomplete(inputs[i]);
    scheduleUserLabelRefresh(false);
  }

  document.addEventListener('click', interceptInviteSocialAuth, true);

  var _origPushState = history.pushState;
  history.pushState = function() {
    var result = _origPushState.apply(this, arguments);
    scheduleUserLabelRefresh(true);
    return result;
  };

  var _origReplaceState = history.replaceState;
  history.replaceState = function() {
    var result = _origReplaceState.apply(this, arguments);
    scheduleUserLabelRefresh(true);
    return result;
  };

  window.addEventListener('popstate', function() {
    scheduleUserLabelRefresh(true);
  });

  new MutationObserver(scanForInput)
    .observe(document.documentElement, { childList: true, subtree: true });

  scanForInput();

})();
