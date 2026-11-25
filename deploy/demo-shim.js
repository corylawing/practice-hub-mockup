/* HOME-BRACE PUBLIC DEMO - runs first on every demo page (deploy/build-demo.py puts it there; demo/ is a generated copy).
   1. A pretend Microsoft: a made-up admin is "signed in" and Microsoft's answers come from here, so the demo needs no
      account and NOTHING is sent anywhere - any other address is refused.
   2. Its own saved data: everything the demo remembers is kept under "hbdemo:" names, apart from the sandbox's
      (same website), and "Start over" in the banner clears it. */
(function(){
  'use strict';
  var W = window, P = 'hbdemo:';

  /* 2. saved data, kept apart */
  try {
    var S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem, k = S.key;
    var len = Object.getOwnPropertyDescriptor(S, 'length');
    var own = function(st){ var out = [], n = len.get.call(st); for (var i = 0; i < n; i++){ var key = k.call(st, i); if (key && key.indexOf(P) === 0) out.push(key); } return out; };
    S.getItem = function(key){ return g.call(this, P + key); };
    S.setItem = function(key, v){ return s.call(this, P + key, v); };
    S.removeItem = function(key){ return r.call(this, P + key); };
    S.key = function(i){ var o = own(this)[i]; return o == null ? null : o.slice(P.length); };
    S.clear = function(){ var st = this; own(st).forEach(function(key){ r.call(st, key); }); };
    Object.defineProperty(S, 'length', {configurable: true, get: function(){ return own(this).length; }});
  } catch (_) {}

  /* 1. a pretend Microsoft */
  var who = {id: 'demo-admin', displayName: 'Jordan Avery', mail: 'Consult@brightline.example', jobTitle: 'COO', department: 'Admin', officeLocation: 'All offices'};
  var acct = {homeAccountId: 'h-' + who.id, username: who.mail, name: who.displayName, localAccountId: who.id, tenantId: 'demo'};
  var tok = {accessToken: 'demo', idToken: 'demo', idTokenClaims: {exp: Math.floor(Date.now() / 1000) + 3600}, account: acct};
  var ok = function(){ return Promise.resolve(tok); };
  var app = {initialize: function(){ return Promise.resolve(); }, handleRedirectPromise: function(){ return Promise.resolve(null); },
    getAllAccounts: function(){ return [acct]; }, getActiveAccount: function(){ return acct; }, setActiveAccount: function(){},
    acquireTokenSilent: ok, acquireTokenPopup: ok, acquireTokenRedirect: ok, loginPopup: ok, loginRedirect: ok,
    logoutRedirect: function(){ return Promise.resolve(); }, logoutPopup: function(){ return Promise.resolve(); },
    addEventCallback: function(){ return null; }, removeEventCallback: function(){}};
  Object.defineProperty(W, 'msal', {configurable: true, get: function(){ return {PublicClientApplication: function(){ return app; }, InteractionRequiredAuthError: Error, BrowserAuthError: Error}; }, set: function(){}});

  var json = function(o, st){ return Promise.resolve(new Response(JSON.stringify(o), {status: st || 200, headers: {'Content-Type': 'application/json'}})); };
  var real = W.fetch.bind(W);
  var SAFE = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/;
  W.fetch = function(u, o){
    var url; try { url = new URL(String(u && u.url || u), location.href); } catch (_) { return real(u, o); }
    if (url.hostname === 'graph.microsoft.com'){
      if (/\/v1\.0\/me\/?$/.test(url.pathname)) return json({id: who.id, displayName: who.displayName, mail: who.mail, userPrincipalName: who.mail, jobTitle: who.jobTitle, department: who.department, officeLocation: who.officeLocation});
      if (/\/photo/.test(url.pathname)) return json({error: {code: 'ImageNotFound'}}, 404);
      return json({value: []});
    }
    if (url.origin === location.origin && url.pathname.indexOf('/api/') < 0) return real(u, o);
    if (SAFE.test(url.hostname)) return real(u, o);
    return Promise.reject(new TypeError('Home-Brace demo: nothing is sent anywhere'));
  };
  try { if (navigator.sendBeacon) navigator.sendBeacon = function(){ return true; }; } catch (_) {}

  /* the banner: "Start over", and nothing that would reach for the real Microsoft */
  var css = '[data-act="tryreal"],[data-demo-off]{display:none !important}' +
    '.ribbon .demo-reset{margin-left:10px;background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.15);border-radius:999px;' +
    'padding:2px 10px;font:inherit;font-weight:700;cursor:pointer;color:inherit}';
  var add = function(){
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var rb = document.querySelector('.ribbon');
    if (rb && !rb.querySelector('.demo-reset')){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'demo-reset'; b.textContent = 'Start over';
      b.title = 'Clear everything you changed in the demo';
      b.onclick = function(){ try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} location.href = 'home.html'; };
      rb.appendChild(b);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
